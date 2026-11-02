// Genera TDDefense.exe (Windows) con Node SEA: juego + servidor local en un solo ejecutable.
// Uso: node scripts/build-exe.mjs [--linux-only]
import { execSync, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const BUILD = path.join(ROOT, 'build');
const OUT = path.join(ROOT, 'release');
const FUSE = 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2';
const WIN_NODE_PKG = 'node-win-x64@27.0.0-alpha.0.0.0';
const linuxOnly = process.argv.includes('--linux-only');

function run(cmd, cwd = ROOT) { console.log('> ' + cmd); execSync(cmd, { cwd, stdio: 'inherit' }); }

// Comprobaciones previas: las dependencias deben estar instaladas en este proyecto
const VITE = path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const POSTJECT = path.join(ROOT, 'node_modules', 'postject', 'dist', 'cli.js');
if (!fs.existsSync(VITE) || !fs.existsSync(POSTJECT)) {
  console.error('\nERROR: faltan dependencias. Ejecuta primero:  npm install\n');
  process.exit(1);
}

fs.rmSync(BUILD, { recursive: true, force: true });
fs.mkdirSync(BUILD, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

// 1) Compilar el juego
run(`"${process.execPath}" "${VITE}" build`);

// 2) Recoger todos los archivos de dist como assets embebidos
const DIST = path.join(ROOT, 'dist');
const assets = {};
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else assets[path.relative(DIST, full).split(path.sep).join('/')] = full;
  }
})(DIST);
console.log(`Assets embebidos: ${Object.keys(assets).length}`);

// 3) Blob SEA
fs.copyFileSync(path.join(ROOT, 'launcher', 'sea-main.cjs'), path.join(BUILD, 'sea-main.cjs'));
const seaConfig = { main: path.join(BUILD, 'sea-main.cjs'), output: path.join(BUILD, 'sea-prep.blob'), disableExperimentalSEAWarning: true, useSnapshot: false, useCodeCache: false, assets };
fs.writeFileSync(path.join(BUILD, 'sea-config.json'), JSON.stringify(seaConfig, null, 2));
// El blob SEA debe ser de la misma version de Node que el binario que se inyecta.
function fetchWinNode() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nodewin-'));
  execFileSync('npm', ['pack', WIN_NODE_PKG], { cwd: tmp, stdio: 'inherit', shell: true });
  const tgz = fs.readdirSync(tmp).find((f) => f.endsWith('.tgz'));
  execSync(`tar -xzf "${tgz}"`, { cwd: tmp, stdio: 'inherit' });
  return path.join(tmp, 'package', 'bin', 'node.exe');
}

const winNode = linuxOnly ? null : fetchWinNode();
// En Windows generamos el blob con el propio node.exe que se empaqueta (misma version exacta).
// En Linux (pruebas) usamos el node actual, que es la misma version (v22.22.3).
const blobGenerator = process.platform === 'win32' && winNode ? winNode : process.execPath;
run(`"${blobGenerator}" --experimental-sea-config "${path.join(BUILD, 'sea-config.json')}"`);

function inject(baseBinary, outFile) {
  fs.copyFileSync(baseBinary, outFile);
  if (process.platform !== 'win32' && !outFile.endsWith('.exe')) fs.chmodSync(outFile, 0o755);
  const blob = path.join(BUILD, 'sea-prep.blob');
  run(`"${process.execPath}" "${POSTJECT}" "${outFile}" NODE_SEA_BLOB "${blob}" --sentinel-fuse ${FUSE}`);
  console.log('OK: ' + outFile + ' (' + (fs.statSync(outFile).size / 1048576).toFixed(1) + ' MB)');
}

// 4) Ejecutable Linux (para pruebas en este entorno)
inject(process.execPath, path.join(BUILD, 'TDDefense-linux'));

// 5) Ejecutable Windows
if (!linuxOnly) {
  inject(winNode, path.join(OUT, 'TDDefense.exe'));
}
console.log('Listo.');
