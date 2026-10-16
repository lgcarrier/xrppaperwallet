const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { pathToFileURL } = require('node:url');
const { PNG } = require('pngjs');
const jsQR = require('jsqr');
const { expect } = require('@playwright/test');

const root = path.resolve(__dirname, '..');

async function createSite() {
  // Match the no-install, extracted ZIP experience, including a space in its path.
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'XRP paper wallet '));
  for (const name of ['index.html', 'css', 'js', 'img', 'vendor']) {
    fs.cpSync(path.join(root, name), path.join(directory, name), { recursive: true });
  }
  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = path.resolve(directory, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(directory + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      response.writeHead(404).end(); return;
    }
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png' };
    response.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    file: pathToFileURL(path.join(directory, 'index.html')).href,
    url: `http://127.0.0.1:${server.address().port}/`,
    close: async () => {
      await new Promise(resolve => server.close(resolve));
      fs.rmSync(directory, { recursive: true, force: true });
    },
  };
}

async function trackedPage(browser, { offline = false, viewport = { width: 1440, height: 1000 } } = {}) {
  const context = await browser.newContext({ offline, viewport });
  const requests = [];
  context.on('request', request => {
    if (/^(https?|wss?):/.test(request.url())) requests.push(request.url());
  });
  await context.addInitScript(() => {
    window.__networkAttempts = [];
    const track = name => window.__networkAttempts.push(name);
    const fetch = window.fetch;
    window.fetch = function (...args) { track('fetch'); return fetch.apply(this, args); };
    const open = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function (...args) { track('XHR'); return open.apply(this, args); };
    const beacon = navigator.sendBeacon;
    navigator.sendBeacon = function (...args) { track('beacon'); return beacon.apply(this, args); };
    window.WebSocket = new Proxy(window.WebSocket, {
      construct(target, args) { track('WebSocket'); return Reflect.construct(target, args); },
    });
    window.__prints = [];
    window.print = () => {
      window.dispatchEvent(new Event('beforeprint'));
      window.__prints.push(document.documentElement.dataset.printSide);
      window.dispatchEvent(new Event('afterprint'));
    };
  });
  const page = await context.newPage();
  return { context, page, requests };
}

async function generate(page, accept = true) {
  page.once('dialog', dialog => accept ? dialog.accept() : dialog.dismiss());
  await page.locator('#generate-paper-wallet').click();
  if (accept) await expect(page.locator('#wallet-result')).toBeVisible();
}

async function credentials(page) {
  return {
    address: (await page.locator('#wallet-address').textContent()).trim(),
    seed: (await page.locator('#wallet-seed').textContent()).trim(),
  };
}

function decodePNG(buffer) {
  const png = PNG.sync.read(buffer);
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  expect(Boolean(decoded), 'QR code must decode').toBe(true);
  return decoded.data;
}

async function assertNoAPINetwork(page) {
  expect(await page.evaluate(() => window.__networkAttempts)).toEqual([]);
}

module.exports = { root, createSite, trackedPage, generate, credentials, decodePNG, assertNoAPINetwork };
