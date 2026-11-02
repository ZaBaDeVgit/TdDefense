// Lanzador de TD Defense (Node SEA). Sirve los archivos del juego embebidos en el .exe
// en un servidor local (solo 127.0.0.1) y abre el juego en una ventana del navegador.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn, execFile } = require('node:child_process');
const sea = require('node:sea');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2',
};

const args = process.argv.slice(2);
const noOpen = args.includes('--no-open');

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (p === '/' || p === '') p = '/index.html';
  const key = p.replace(/^\/+/, '');
  let data;
  try { data = sea.getAsset(key); } catch (e) { data = undefined; }
  if (!data || key.includes('..')) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('No encontrado');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(key)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(Buffer.from(data));
});

function findBrowser() {
  const local = process.env.LOCALAPPDATA || '';
  const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const cands = [
    path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ];
  return cands.find((c) => fs.existsSync(c));
}

function openGame(url) {
  if (process.platform === 'win32') {
    const browser = findBrowser();
    if (browser) {
      spawn(browser, [`--app=${url}`, '--window-size=1600,900', '--new-window'], { detached: true, stdio: 'ignore' }).unref();
    } else {
      spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
    }
  } else if (process.platform === 'darwin') {
    execFile('open', [url]);
  } else {
    execFile('xdg-open', [url], () => {});
  }
}

const port = Number(process.env.TD_PORT) || 0;
server.listen(port, '127.0.0.1', () => {
  const { port: p } = server.address();
  const url = `http://127.0.0.1:${p}/`;
  console.log('TD Defense en ejecución en ' + url);
  console.log('Cierra esta ventana para salir del juego.');
  if (!noOpen) openGame(url);
});

process.on('SIGINT', () => { server.close(); process.exit(0); });
