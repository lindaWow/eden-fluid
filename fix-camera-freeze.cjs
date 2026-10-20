const fs = require('fs');
const srcPath = '/Users/yoyo/Downloads/伊甸流体-v4/伊甸流体.html';
const outPath = '/Users/yoyo/Downloads/伊甸流体-v4/伊甸流体-fixed.html';

let html = fs.readFileSync(srcPath, 'utf8');

const oldCode = `        const processFrame = async () => {
          const video = videoRef.current;
          if (video && video.readyState >= 2 && !video.paused) {
            frameCountRef.current += 1;
            try {
              if (handsInstanceRef.current) {
                await handsInstanceRef.current.send({ image: video });
              }
              if (faceInstanceRef.current) {
                await faceInstanceRef.current.send({ image: video });
              }
            } catch (err) {
              console.warn("Frame prediction failed:", err);
            }
          }
          animFrameRef.current = requestAnimationFrame(processFrame);
        };
        animFrameRef.current = requestAnimationFrame(processFrame);`;

const newCode = `        let _processing = false;
        const processFrame = () => {
          const video = videoRef.current;
          if (video && video.readyState >= 2 && !video.paused && !_processing) {
            frameCountRef.current += 1;
            _processing = true;
            (async () => {
              try {
                if (handsInstanceRef.current) {
                  await handsInstanceRef.current.send({ image: video });
                }
                if (faceInstanceRef.current) {
                  await faceInstanceRef.current.send({ image: video });
                }
              } catch (err) {
                console.warn("Frame prediction failed:", err);
              }
              _processing = false;
            })();
          }
          animFrameRef.current = requestAnimationFrame(processFrame);
        };
        animFrameRef.current = requestAnimationFrame(processFrame);`;

if (html.includes(oldCode)) {
    html = html.replace(oldCode, newCode);
    fs.writeFileSync(outPath, html, 'utf8');
    console.log('Done: ' + outPath);
} else {
    console.log('ERROR: target code block not found');
    if (html.includes('const processFrame = async')) {
        console.log('Found partial match: "const processFrame = async"');
    }
}
