const fs = require('fs');
const filePath = '/Users/yoyo/Downloads/伊甸流体-v4/src/components/GestureTracker.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Find the entire startTracking function and replace the camera section
// From "if (!videoRef.current) return;" to the closing of the try block

const oldBlock = `      if (!videoRef.current) return;

      // 3. 启动统一 Camera 流 (使用原生 getUserMedia 与 requestAnimationFrame 帧泵)
      let stream: MediaStream | null = null;
      let animId: number | null = null;
      let activeLoop = true;
      let isProcessing = false;

      const processFrame = async () => {
        if (!activeLoop) return;
        const video = videoRef.current;
        if (video && video.readyState >= 2 && !video.paused) {
          if (!isProcessing) {
            isProcessing = true;
            frameCountRef.current += 1;
            try {
              if (handsInstanceRef.current) {
                await handsInstanceRef.current.send({ image: video });
              }
              if (faceInstanceRef.current) {
                await faceInstanceRef.current.send({ image: video });
              }
            } catch (err) {
              console.warn("Unified prediction pass failed in frames:", err);
            } finally {
              isProcessing = false;
            }
          }
        }
        if (activeLoop) {
          animId = requestAnimationFrame(processFrame);
        }
      };

      try {
        if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("navigator.mediaDevices.getUserMedia is not supported or is blocked in this environment (HTTP context, camera hardware missing, or denied/restricted permissions).");
        }
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 320 },
            height: { ideal: 240 },
            facingMode: "user"
          },
          audio: false
        });
      } catch (mediaErr) {
        console.error("navigator.mediaDevices.getUserMedia failed:", mediaErr);
        throw mediaErr;
      }

      if (videoRef.current) {
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
      }

      streamRef.current = stream;
      animFrameRef.current = animId;

      setCameraState("active");`;

const newBlock = `      if (!videoRef.current) return;

      // 3. 用原生 getUserMedia 替代 @mediapipe/camera_utils 的 Camera 类
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, facingMode: "user" },
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      setCameraState("active");

      // 4. requestAnimationFrame 循环送帧
      const processFrame = async () => {
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

if (content.includes(oldBlock)) {
  content = content.replace(oldBlock, newBlock);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('SUCCESS: Replaced camera startup with v1-style simple flow');
  
  // Verify
  const updated = fs.readFileSync(filePath, 'utf8');
  if (updated.includes('activeLoop') || updated.includes('isProcessing')) {
    console.log('WARNING: Old variables still present');
  } else {
    console.log('VERIFIED: No activeLoop/isProcessing leftovers');
  }
  if (updated.includes('cameraInstanceRef')) {
    console.log('WARNING: cameraInstanceRef still present');
  } else {
    console.log('VERIFIED: No cameraInstanceRef');
  }
} else {
  console.log('ERROR: Could not find exact block to replace');
}
