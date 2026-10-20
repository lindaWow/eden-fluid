const fs = require('fs');
const filePath = '/Users/yoyo/Downloads/伊甸流体-v4/src/components/GestureTracker.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const oldBlock = `      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.setAttribute("muted", "true");
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn("Initial direct video.play() failed, waiting for metadata:", playErr);
        }
        animId = requestAnimationFrame(processFrame);
      }`;

const newBlock = `      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.setAttribute("muted", "true");
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        
        // Wait for video to be ready before playing
        const video = videoRef.current;
        await new Promise<void>((resolve) => {
          if (video.readyState >= 2) {
            resolve();
          } else {
            video.addEventListener("loadeddata", () => resolve(), { once: true });
          }
        });
        try {
          await video.play();
        } catch (playErr) {
          console.warn("video.play() failed after loadeddata:", playErr);
        }
        animId = requestAnimationFrame(processFrame);
      }`;

if (content.includes(oldBlock)) {
  content = content.replace(oldBlock, newBlock);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('SUCCESS: Added loadeddata wait before video.play()');
} else {
  console.log('ERROR: Could not find exact block');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (line.includes('await videoRef.current.play') || line.includes('loadeddata') || line.includes('readyState')) {
      console.log('  line ' + (i+1) + ': ' + line.trim());
    }
  });
}
