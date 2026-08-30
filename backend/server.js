const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
// The existing root index.html is the single frontend entry point.
const FRONTEND_DIR = ROOT;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const PORT = Number(process.env.PORT || 4173);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
// Change this with ADMIN_PATH before deployment if you want another private entry URL.
const ADMIN_PATH = `/${String(process.env.ADMIN_PATH || 'tbx-7f3c9a2e-d4b8-6e1a').replace(/^\/+|\/+$/g, '')}`;
// Local-only convenience default requested by the user. Set ADMIN_PASSWORD
// explicitly before any non-local deployment.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : '1234');
const sessions = new Set();

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function extractSeedProducts() {
  const html = fs.readFileSync(path.join(FRONTEND_DIR, 'index.html'), 'utf8');
  const marker = 'const defaultProductsData = ';
  const start = html.indexOf(marker);
  if (start < 0) throw new Error('defaultProductsData was not found in frontend/index.html');
  const arrayStart = html.indexOf('[', start + marker.length);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let i = arrayStart; i < html.length; i += 1) {
    const char = html[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '[') depth += 1;
    if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        const source = html.slice(arrayStart, i + 1);
        // This is a trusted local seed copied from the existing page, not user input.
        return Function(`"use strict"; return (${source});`)();
      }
    }
  }
  throw new Error('defaultProductsData array is incomplete');
}

const seedProducts = extractSeedProducts();
if (!fs.existsSync(PRODUCTS_FILE)) {
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(seedProducts, null, 2));
}

function readProducts() {
  try {
    const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
    return Array.isArray(products) ? products : [...seedProducts];
  } catch {
    return [...seedProducts];
  }
}

function writeProducts(products) {
  const temporary = `${PRODUCTS_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(products, null, 2));
  fs.renameSync(temporary, PRODUCTS_FILE);
}

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body)
  });
  response.end(body);
}

function readRequestBody(request, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', chunk => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('request too large'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

function parseJsonBody(request) {
  return readRequestBody(request).then(buffer => JSON.parse(buffer.toString('utf8')));
}

function parseMultipart(buffer, contentType) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!match) throw new Error('multipart boundary missing');
  const boundary = Buffer.from(`--${match[1] || match[2]}`);
  const parts = [];
  let cursor = 0;
  while (cursor < buffer.length) {
    const start = buffer.indexOf(boundary, cursor);
    if (start < 0) break;
    const headerStart = start + boundary.length + 2;
    if (buffer.slice(start + boundary.length, start + boundary.length + 2).toString() === '--') break;
    const headerEnd = buffer.indexOf(Buffer.from('\r\n\r\n'), headerStart);
    if (headerEnd < 0) break;
    const bodyEnd = buffer.indexOf(Buffer.concat([Buffer.from('\r\n'), boundary]), headerEnd + 4);
    if (bodyEnd < 0) break;
    const headers = buffer.slice(headerStart, headerEnd).toString('utf8');
    const body = buffer.slice(headerEnd + 4, bodyEnd);
    const nameMatch = headers.match(/(?:^|;)\s*name="([^"]+)"/i);
    const filenameMatch = headers.match(/(?:^|;)\s*filename="([^"]*)"/i);
    if (nameMatch) parts.push({ name: nameMatch[1], filename: filenameMatch ? filenameMatch[1] : '', body });
    cursor = bodyEnd + 2;
  }
  return parts;
}

function sniffImage(buffer) {
  if (buffer.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (buffer.slice(0, 3).equals(Buffer.from([255, 216, 255]))) return 'jpg';
  if (buffer.slice(0, 6).toString() === 'GIF87a' || buffer.slice(0, 6).toString() === 'GIF89a') return 'gif';
  if (buffer.slice(0, 4).toString() === 'RIFF' && buffer.slice(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}

function safePathFromUrl(urlPath) {
  const requested = decodeURIComponent(urlPath.split('?')[0]);
  const resolved = path.resolve(FRONTEND_DIR, requested === '/' ? 'index.html' : `.${requested}`);
  const relative = path.relative(FRONTEND_DIR, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return resolved;
}

function getCookie(request, name) {
  const cookies = request.headers.cookie || '';
  const entry = cookies.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : '';
}

function requireAdmin(request, response) {
  if (!ADMIN_PASSWORD) {
    sendJson(response, 503, { error: 'ADMIN_PASSWORD is not configured' });
    return false;
  }
  if (!sessions.has(getCookie(request, 'tb_session'))) {
    sendJson(response, 401, { error: 'admin authentication required' });
    return false;
  }
  return true;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

async function handle(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if ((pathname === ADMIN_PATH || pathname === `${ADMIN_PATH}/`) && (request.method === 'GET' || request.method === 'HEAD')) {
    const adminFile = path.join(__dirname, 'admin.html');
    const content = fs.readFileSync(adminFile);
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    if (request.method === 'HEAD') return response.end();
    return response.end(content);
  }

  if (pathname === '/api/auth/login' && request.method === 'POST') {
    try {
      const payload = await parseJsonBody(request);
      if (!ADMIN_PASSWORD || payload.password !== ADMIN_PASSWORD) return sendJson(response, 401, { error: 'invalid credentials' });
      const token = crypto.randomBytes(32).toString('hex');
      sessions.add(token);
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': `tb_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/`,
        'Cache-Control': 'no-store'
      });
      return response.end(JSON.stringify({ ok: true }));
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (pathname === '/api/products' && request.method === 'GET') return sendJson(response, 200, readProducts());

  if (pathname === '/api/products/reset' && request.method === 'POST') {
    if (!requireAdmin(request, response)) return;
    writeProducts(seedProducts);
    return sendJson(response, 200, seedProducts);
  }

  // JSON bulk import/export is intentionally not part of the admin API.
  if (pathname === '/api/products/bulk') {
    return sendJson(response, 405, { error: 'bulk JSON operations are disabled' });
  }

  const productMatch = pathname.match(/^\/api\/products\/([^/]+)$/);
  if (productMatch && ['PUT', 'DELETE'].includes(request.method)) {
    if (!requireAdmin(request, response)) return;
    const id = decodeURIComponent(productMatch[1]);
    const products = readProducts();
    const index = products.findIndex(product => product.id === id);
    if (request.method === 'DELETE') {
      if (index < 0) return sendJson(response, 404, { error: 'product not found' });
      products.splice(index, 1);
      writeProducts(products);
      return sendJson(response, 200, { ok: true });
    }
    try {
      const product = await parseJsonBody(request);
      if (!product || !product.name || !product.img) return sendJson(response, 400, { error: 'name and img are required' });
      product.id = id;
      if (index < 0) return sendJson(response, 404, { error: 'product not found' });
      products[index] = product;
      writeProducts(products);
      return sendJson(response, 200, product);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (pathname === '/api/products' && request.method === 'POST') {
    if (!requireAdmin(request, response)) return;
    try {
      const product = await parseJsonBody(request);
      if (!product || !product.name || !product.img) return sendJson(response, 400, { error: 'name and img are required' });
      product.id = product.id || `p_${crypto.randomUUID()}`;
      const products = readProducts();
      products.unshift(product);
      writeProducts(products);
      return sendJson(response, 201, product);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (pathname === '/api/upload' && request.method === 'POST') {
    if (!requireAdmin(request, response)) return;
    try {
      const body = await readRequestBody(request, MAX_UPLOAD_BYTES + 1024 * 1024);
      const [file] = parseMultipart(body, request.headers['content-type'] || '');
      if (!file || !file.filename || file.body.length === 0) return sendJson(response, 400, { error: 'image file is required' });
      if (file.body.length > MAX_UPLOAD_BYTES) return sendJson(response, 413, { error: 'image is too large' });
      const extension = sniffImage(file.body);
      if (!extension) return sendJson(response, 415, { error: 'unsupported image format' });
      const filename = `${crypto.randomUUID()}.${extension}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, filename), file.body);
      return sendJson(response, 201, { url: `/uploads/${filename}`, filename });
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (pathname.startsWith('/uploads/')) {
    const filename = path.basename(pathname);
    const file = path.join(UPLOAD_DIR, filename);
    if (!fs.existsSync(file)) return sendJson(response, 404, { error: 'file not found' });
    const extension = path.extname(file).toLowerCase();
    response.writeHead(200, { 'Content-Type': MIME[extension] || 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000, immutable' });
    return response.end(fs.readFileSync(file));
  }

  // Keep server source and the previous draft project out of the public static root.
  if (pathname.startsWith('/backend/') || pathname.startsWith('/taiping-blue-app/')) {
    return sendJson(response, 404, { error: 'not found' });
  }

  if (request.method !== 'GET' && request.method !== 'HEAD') return sendJson(response, 405, { error: 'method not allowed' });
  const file = safePathFromUrl(pathname);
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) return sendJson(response, 404, { error: 'not found' });
  const content = fs.readFileSync(file);
  response.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  if (request.method === 'HEAD') return response.end();
  return response.end(content);
}

const server = http.createServer((request, response) => {
  handle(request, response).catch(error => {
    console.error(error);
    sendJson(response, 500, { error: 'internal server error' });
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Taiping Blue frontend + API: http://127.0.0.1:${PORT}`);
  console.log(`Product data: ${PRODUCTS_FILE}`);
  console.log(`Uploads: ${UPLOAD_DIR}`);
});
