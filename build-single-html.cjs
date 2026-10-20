const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const {execSync} = require('child_process');

const ROOT = '/Users/yoyo/Downloads/伊甸流体-v4';
const OUT = path.join(ROOT, 'dist-single');

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, {recursive: true});

// Step 1: esbuild bundle JS only (no CSS)
console.log('[1/3] Bundling JS with esbuild...');
esbuild.buildSync({
  entryPoints: [path.join(ROOT, 'src/main.tsx')],
  bundle: true,
  minify: false,
  format: 'iife',
  outfile: path.join(OUT, 'bundle.js'),
  jsx: 'automatic',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  loader: {
    '.css': 'empty',  // skip CSS imports in JS
  },
  logLevel: 'info',
});
console.log('[1/3] JS bundle done.');

// Step 2: Process CSS with tailwindcss CLI
console.log('[2/3] Processing CSS with tailwindcss...');
let cssBuilt = false;

// Try oxide binary first
try {
  execSync(`"${ROOT}/node_modules/@tailwindcss/oxide-darwin-arm64/tailwindcss" -i "${ROOT}/src/index.css" -o "${OUT}/style.css"`, {
    cwd: ROOT,
    stdio: 'pipe',
    timeout: 60000,
  });
  const css = fs.readFileSync(path.join(OUT, 'style.css'), 'utf8');
  if (css.length > 200) { cssBuilt = true; console.log('[2/3] CSS done (oxide).'); }
  else { console.log('[2/3] oxide output too small, trying next...'); }
} catch(e) {
  console.log('[2/3] oxide failed:', (e.stderr || '').toString().slice(0,150));
}

// Try node-based tailwindcss
if (!cssBuilt) {
  try {
    execSync(`node "${ROOT}/node_modules/@tailwindcss/node/dist/index.js" -i "${ROOT}/src/index.css" -o "${OUT}/style.css"`, {
      cwd: ROOT,
      stdio: 'pipe',
      timeout: 60000,
    });
    const css = fs.readFileSync(path.join(OUT, 'style.css'), 'utf8');
    if (css.length > 200) { cssBuilt = true; console.log('[2/3] CSS done (node).'); }
  } catch(e) {
    console.log('[2/3] node tailwindcss failed:', (e.stderr || '').toString().slice(0,150));
  }
}

if (!cssBuilt) {
  console.log('[2/3] Will use Tailwind Play CDN fallback.');
}

// Step 3: Assemble single HTML
console.log('[3/3] Creating single HTML...');
const jsCode = fs.readFileSync(path.join(OUT, 'bundle.js'), 'utf8');
const cssCode = cssBuilt ? fs.readFileSync(path.join(OUT, 'style.css'), 'utf8') : '';

const hasCSS = cssCode.length > 200;

let styleBlock;
if (hasCSS) {
  styleBlock = `  <style>\n${cssCode}\n  </style>`;
} else {
  styleBlock = `  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>
:root { --mint: #E8F5E9; --sage: #CFD8DC; --pearl: #F5F5F5; --gold: rgba(212,175,55,0.4); --pink: #F8BBD0; --lilac: #E1BEE7; }
@theme { --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif; --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace; }
.grain { background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E"); }
.silk-flow { background: linear-gradient(90deg, transparent, var(--pink), var(--lilac), transparent); }
  </style>`;
}

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>伊甸流体：意向正念空间 | Eden Fluids</title>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/hands.js" crossorigin="anonymous"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/face_mesh.js" crossorigin="anonymous"><\/script>
${styleBlock}
</head>
<body>
  <div id="root"></div>
  <script>
${jsCode}
  <\/script>
</body>
</html>`;

const htmlPath = path.join(ROOT, '伊甸流体.html');
fs.writeFileSync(htmlPath, html);
console.log(`\nDONE! Single HTML: ${htmlPath}`);
console.log(`Size: ${(fs.statSync(htmlPath).size / 1024).toFixed(0)} KB`);

// Cleanup temp dir
try { fs.rmSync(OUT, {recursive: true}); } catch(e) {}
