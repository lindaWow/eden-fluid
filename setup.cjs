const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const baseDir = __dirname;

// 1. Patch index.html - remove camera_utils.js if present
const htmlPath = path.join(baseDir, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
if (html.includes('camera_utils')) {
  html = html.replace(
    /<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@mediapipe\/camera_utils@0\.4\/camera_utils\.js" crossorigin="anonymous">\s*<\/script>\s*\n/,
    ''
  );
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('index.html patched - camera_utils removed');
} else {
  console.log('index.html already clean');
}

// 2. Copy node_modules from v2-clean
const nmDir = path.join(baseDir, 'node_modules');
if (!fs.existsSync(path.join(nmDir, 'vite'))) {
  const srcDir = '/Users/yoyo/Downloads/伊甸流体-v2-clean/node_modules';
  if (fs.existsSync(srcDir)) {
    console.log('Copying node_modules from v2-clean...');
    execSync(`cp -r "${srcDir}" "${nmDir}"`, { stdio: 'inherit' });
    console.log('node_modules copied');
  } else {
    console.log('ERROR: No source node_modules found');
  }
} else {
  console.log('node_modules already exists');
}

// 3. Verify vite works
try {
  const version = execSync(`node "${path.join(nmDir, 'vite/bin/vite.js')}" --version`, { encoding: 'utf8' }).trim();
  console.log('Vite version:', version);
  console.log('ALL READY - run: node node_modules/vite/bin/vite.js --port 3000 --host=0.0.0.0');
} catch (e) {
  console.log('ERROR: vite not working, need npm install');
}
