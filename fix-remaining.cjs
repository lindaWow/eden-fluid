const fs = require('fs');
const filePath = '/Users/yoyo/Downloads/伊甸流体-v4/src/components/GestureTracker.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldBlock = `cameraInstanceRef.current = {
        stop: () => {
          activeLoop = false;
          if (animId !== null) {
            cancelAnimationFrame(animId);
            animId = null;
          }
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
          }
          if (videoRef.current) {
            videoRef.current.srcObject = null;
          }
        }
      };`;

const newBlock = `streamRef.current = stream;
      animFrameRef.current = animId;`;

if (content.includes(oldBlock)) {
  content = content.replace(oldBlock, newBlock);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('SUCCESS: Replaced cameraInstanceRef block');
  const remaining = content.match(/cameraInstanceRef/g);
  if (remaining) {
    console.log('WARNING: cameraInstanceRef still found:', remaining.length, 'times');
  } else {
    console.log('VERIFIED: No more cameraInstanceRef references');
  }
} else {
  console.log('ERROR: Could not find exact block');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('cameraInstanceRef')) {
      console.log('  line ' + (i+1) + ': ' + line.trim());
    }
  });
}
