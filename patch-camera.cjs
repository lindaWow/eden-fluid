const fs = require('fs');
const path = require('path');
const baseDir = __dirname;

const gtxPath = path.join(baseDir, 'src/components/GestureTracker.tsx');
let gtx = fs.readFileSync(gtxPath, 'utf8');

// 1. Replace cameraInstanceRef with streamRef + animFrameRef
gtx = gtx.replace(
  'const cameraInstanceRef = useRef<any>(null);',
  'const streamRef = useRef<MediaStream | null>(null);\n  const animFrameRef = useRef<number>(0);'
);

// 2. Replace stopTracking - camera stop logic
gtx = gtx.replace(
  `  const stopTracking = () => {
    if (cameraInstanceRef.current) {
      try {
        cameraInstanceRef.current.stop();
      } catch (e) {
        console.warn("Stopping camera failed:", e);
      }
      cameraInstanceRef.current = null;
    }`,
  `  const stopTracking = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }`
);

// 3. Replace the cameraInstanceRef assignment block (the object with stop/start methods)
// Find and replace the pattern: cameraInstanceRef.current = { stop: ... start: ... }
gtx = gtx.replace(
  /cameraInstanceRef\.current = \{[\s\S]*?};\s*\n\s*\/\/ 4\./g,
  '// 4. Store stream ref and start frame loop\n      streamRef.current = stream;\n      animFrameRef.current = animId || 0;\n\n      // 4.'
);

// 4. Fix any remaining cameraInstanceRef references
gtx = gtx.replace(/cameraInstanceRef\.current\b/g, (match, offset) => {
  // Check context - if it's a .stop() call that wasn't caught above, skip
  const after = gtx.substring(offset + match.length, offset + match.length + 10);
  if (after.includes('.stop()') || after.includes('.start()')) {
    return match; // Leave it - will be cleaned by the stopTracking fix
  }
  return match;
});

fs.writeFileSync(gtxPath, gtx, 'utf8');

// Verify
const patched = fs.readFileSync(gtxPath, 'utf8');
const hasCameraInstance = patched.includes('cameraInstanceRef.current');
const hasStreamRef = patched.includes('streamRef.current');
const hasAnimFrameRef = patched.includes('animFrameRef');
const hasGetUserMedia = patched.includes('getUserMedia');

console.log('Patch results:');
console.log('  hasStreamRef:', hasStreamRef);
console.log('  hasAnimFrameRef:', hasAnimFrameRef);
console.log('  hasGetUserMedia:', hasGetUserMedia);
console.log('  remaining cameraInstanceRef.current:', (patched.match(/cameraInstanceRef\.current/g) || []).length);

// Count remaining references
const remaining = patched.match(/cameraInstanceRef/g) || [];
if (remaining.length > 0) {
  console.log('  WARNING: cameraInstanceRef still referenced at lines:');
  const lines = patched.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('cameraInstanceRef')) {
      console.log('    line', i+1, ':', line.trim().substring(0, 80));
    }
  });
}
