/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";

interface GestureTrackerProps {
  onTrackingData: (data: {
    gazePoint: { x: number; y: number } | null;
    isOpen: boolean;
    isSmiling: boolean;
    smileScore: number;
    gazeFocusId: number | null;
    cameraState: "idle" | "loading" | "active" | "denied";
    faceDetected: boolean;
    fps: number;
    isPinching: boolean;
    handAngle: number;
    isGesture8?: boolean;
    handDetected?: boolean;
    isIndexOnly?: boolean;
    rightHandPoint?: { x: number; y: number } | null;
    isRightHandDetected?: boolean;
  }) => void;
  active: boolean; // 是否启用镜头追踪
  showMeshDebug: boolean; // 是否在小窗口绘制手势与面部网格
}

export const GestureTracker: React.FC<GestureTrackerProps> = ({
  onTrackingData,
  active,
  showMeshDebug,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const handsInstanceRef = useRef<any>(null);
  const faceInstanceRef = useRef<any>(null);

  const [cameraState, setCameraState] = useState<"idle" | "loading" | "active" | "denied">("idle");
  const [debugFps, setDebugFps] = useState<number>(0);
  const frameCountRef = useRef(0);
  const fpsIntervalRef = useRef<any>(null);

  // 独立状态存储（极客双爪模式：左手控制游标点击滑色，右手控制曼陀罗）
  const leftHandStateRef = useRef({
    detected: false,
    gazePoint: null as { x: number; y: number } | null,
    isPinching: false,
    isIndexOnly: false,
  });

  const rightHandStateRef = useRef({
    detected: false,
    gazePoint: null as { x: number; y: number } | null,
    isOpen: true,
    isSmiling: false,
    smileScore: 0.0,
    handAngle: -Math.PI / 2,
    isGesture8: false,
  });

  const faceStateRef = useRef({
    detected: false,
    isOpen: true,
    isSmiling: false,
    smileScore: 0.0,
    gazePoint: null as { x: number; y: number } | null,
  });

  // 临时存储以便在 Canvas 逐帧叠加绘制
  const vLeftHandLandmarksRef = useRef<any>(null);
  const vRightHandLandmarksRef = useRef<any>(null);
  const vFaceLandmarksRef = useRef<any>(null);

  // 惯性平滑追踪器
  const smoothedX = useRef<number>(0.5);
  const smoothedY = useRef<number>(0.5);

  // 手势 8 静止保持计时器以及坐标检测 refs
  const gesture8StartTimeRef = useRef<number | null>(null);
  const gesture8StartPosRef = useRef<{ x: number; y: number } | null>(null);
  const gesture8LastFramePosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    fpsIntervalRef.current = setInterval(() => {
      setDebugFps(frameCountRef.current);
      frameCountRef.current = 0;
    }, 1000);

    return () => {
      clearInterval(fpsIntervalRef.current);
      stopTracking();
    };
  }, []);

  useEffect(() => {
    if (active) {
      startTracking();
    } else {
      stopTracking();
    }
  }, [active]);

  const stopTracking = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (handsInstanceRef.current) {
      try {
        handsInstanceRef.current.close();
      } catch (e) {
        console.warn("Closing Hands failed:", e);
      }
      handsInstanceRef.current = null;
    }
    if (faceInstanceRef.current) {
      try {
        faceInstanceRef.current.close();
      } catch (e) {
        console.warn("Closing FaceMesh failed:", e);
      }
      faceInstanceRef.current = null;
    }
    setCameraState("idle");
    vLeftHandLandmarksRef.current = null;
    vRightHandLandmarksRef.current = null;
    vFaceLandmarksRef.current = null;
    onTrackingData({
      gazePoint: null,
      isOpen: true,
      isSmiling: false,
      smileScore: 0.0,
      gazeFocusId: null,
      cameraState: "idle",
      faceDetected: false,
      fps: 0,
      isPinching: false,
      handAngle: -Math.PI / 2,
      rightHandPoint: null,
      isRightHandDetected: false,
    });
  };

  const startTracking = async () => {
    const win = window as any;
    if (!win.Hands || !win.FaceMesh) {
      console.error("MediaPipe libraries make sure loaded globally.");
      setCameraState("denied");
      onTrackingData({
        gazePoint: null,
        isOpen: true,
        isSmiling: false,
        smileScore: 0.0,
        gazeFocusId: null,
        cameraState: "denied",
        faceDetected: false,
        fps: 0,
        isPinching: false,
        handAngle: -Math.PI / 2,
      });
      return;
    }

    setCameraState("loading");
    onTrackingData({
      gazePoint: null,
      isOpen: true,
      isSmiling: false,
      smileScore: 0.0,
      gazeFocusId: null,
      cameraState: "loading",
      faceDetected: false,
      fps: 0,
      isPinching: false,
      handAngle: -Math.PI / 2,
    });

    try {
      // 1. 初始化手势识别
      const hands = new win.Hands({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4/${file}`,
      });
      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.45,
        minTrackingConfidence: 0.45,
      });
      hands.onResults(handleHandsResults);
      handsInstanceRef.current = hands;

      // 2. 初始化面部识别
      const faceMesh = new win.FaceMesh({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4/${file}`,
      });
      faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.45,
        minTrackingConfidence: 0.45,
      });
      faceMesh.onResults(handleFaceResults);
      faceInstanceRef.current = faceMesh;

      if (!videoRef.current) return;

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
      animFrameRef.current = requestAnimationFrame(processFrame);
    } catch (err: any) {
      console.error("Camera dual pipeline startup failed:", err);
      setCameraState("denied");
      onTrackingData({
        gazePoint: null,
        isOpen: true,
        isSmiling: false,
        smileScore: 0.0,
        gazeFocusId: null,
        cameraState: "denied",
        faceDetected: false,
        fps: 0,
        isPinching: false,
        handAngle: -Math.PI / 2,
      });
    }
  };

  // 融合并回调状态
  const updateCombinedTracking = () => {
    const leftHand = leftHandStateRef.current;
    const rightHand = rightHandStateRef.current;
    const face = faceStateRef.current;

    // 1. 光标位置：优先用左手指尖，无左手则用面部
    let rawX = 0.5;
    let rawY = 0.5;
    let anyCursorDetected = false;

    if (leftHand.detected && leftHand.gazePoint) {
      rawX = leftHand.gazePoint.x;
      rawY = leftHand.gazePoint.y;
      anyCursorDetected = true;
    } else if (face.detected && face.gazePoint) {
      rawX = face.gazePoint.x;
      rawY = face.gazePoint.y;
      anyCursorDetected = true;
    }

    if (anyCursorDetected) {
      // 缓动平滑
      smoothedX.current = smoothedX.current + (rawX - smoothedX.current) * 0.16;
      smoothedY.current = smoothedY.current + (rawY - smoothedY.current) * 0.16;
    }

    // 2. 握拳触发入定/蒙尘，张手恢复（归入右手动作）
    const isOpen = rightHand.detected ? rightHand.isOpen : true;

    // 3. 右手舒张手掌或展颜欢笑触发飞花
    const smileScore = Math.max(rightHand.smileScore, face.smileScore);
    const isSmiling = rightHand.isSmiling || face.isSmiling;

    const isPinching = leftHand.detected ? leftHand.isPinching : false;
    const handAngle = rightHand.detected ? rightHand.handAngle : -Math.PI / 2;
    const isGesture8 = rightHand.detected ? rightHand.isGesture8 : false;
    const isIndexOnly = leftHand.detected ? !!leftHand.isIndexOnly : false;

    onTrackingData({
      gazePoint: anyCursorDetected ? { x: smoothedX.current, y: smoothedY.current } : null,
      isOpen,
      isSmiling,
      smileScore,
      gazeFocusId: null,
      cameraState: "active",
      faceDetected: anyCursorDetected || rightHand.detected,
      fps: debugFps,
      isPinching,
      handAngle,
      isGesture8,
      handDetected: leftHand.detected || rightHand.detected,
      isIndexOnly,
      rightHandPoint: rightHand.detected ? rightHand.gazePoint : null,
      isRightHandDetected: rightHand.detected,
    });

    // 4. 重绘骨骼画面
    drawCompositeWireframe();
  };

  // 手势回调
  const handleHandsResults = (results: any) => {
    // 默认重置左右手状态
    leftHandStateRef.current = {
      detected: false,
      gazePoint: null,
      isPinching: false,
      isIndexOnly: false,
    };
    rightHandStateRef.current = {
      detected: false,
      gazePoint: null,
      isOpen: true,
      isSmiling: false,
      smileScore: 0.0,
      handAngle: -Math.PI / 2,
      isGesture8: false,
    };
    vLeftHandLandmarksRef.current = null;
    vRightHandLandmarksRef.current = null;

    if (!results || !results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      gesture8StartTimeRef.current = null;
      gesture8StartPosRef.current = null;
      gesture8LastFramePosRef.current = null;
      updateCombinedTracking();
      return;
    }

    // 遍历所有检测到的手（最大支持 2 只）
    for (let h = 0; h < results.multiHandLandmarks.length; h++) {
      const landmarks = results.multiHandLandmarks[h];
      const handedness = results.multiHandedness ? results.multiHandedness[h] : null;
      
      // label === "Left" 物理左手，label === "Right" 物理右手
      const label = handedness ? handedness.label : (h === 0 ? "Right" : "Left");
      const isLeft = label === "Left";

      const wrist = landmarks[0];
      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];
      const middleTip = landmarks[12];
      const ringTip = landmarks[16];
      const pinkyTip = landmarks[20];

      const dist3D = (pt1: any, pt2: any) => Math.hypot(pt1.x - pt2.x, pt1.y - pt2.y, pt1.z - pt2.z);
      const indexExt = dist3D(indexTip, wrist) > dist3D(landmarks[6], wrist) * 1.05;
      const middleExt = dist3D(middleTip, wrist) > dist3D(landmarks[10], wrist);
      const ringExt = dist3D(ringTip, wrist) > dist3D(landmarks[14], wrist);
      const pinkyExt = dist3D(pinkyTip, wrist) > dist3D(landmarks[18], wrist);
      const thumbExt = dist3D(thumbTip, landmarks[2]) > 0.055 && dist3D(thumbTip, landmarks[5]) > 0.060;

      if (isLeft) {
        // ----------------- 左手：控制高精度游标与点击、色调 -----------------
        vLeftHandLandmarksRef.current = landmarks;

        const pinchDist = dist3D(thumbTip, indexTip);
        const isPinching = pinchDist < 0.048; // 指尖捏合

        // 仅食指伸出
        const isIndexOnly = indexExt && !middleExt && !ringExt && !pinkyExt && !thumbExt;

        // 指尖进行绝对游标定位
        const controlPoint = indexTip;
        let tx = 1.0 - controlPoint.x;
        let ty = controlPoint.y;

        tx = (tx - 0.15) / 0.7;
        ty = (ty - 0.1) / 0.8;
        tx = Math.max(0.01, Math.min(0.99, tx));
        ty = Math.max(0.01, Math.min(0.99, ty));

        leftHandStateRef.current = {
          detected: true,
          gazePoint: { x: tx, y: ty },
          isPinching,
          isIndexOnly,
        };
      } else {
        // ----------------- 右手：控制曼陀罗位置、张缩握拳、几何微调 -----------------
        vRightHandLandmarksRef.current = landmarks;

        // 计算 5 个指尖到手腕的距离来判断张拳 / 握拳
        const fingerTipsIndices = [4, 8, 12, 16, 20];
        let sumDist = 0;
        fingerTipsIndices.forEach((tipIndex) => {
          const lmk = landmarks[tipIndex];
          sumDist += Math.hypot(lmk.x - wrist.x, lmk.y - wrist.y, lmk.z - wrist.z);
        });
        const avgDist = sumDist / 5.0;
        const rightIsOpen = avgDist > 0.27; // 握拳为 false，展开为 true

        const palmCenter = landmarks[9];

        // 2D 镜像手势旋转角
        const rightHandAngle = Math.atan2(palmCenter.y - wrist.y, palmCenter.x - wrist.x);

        // 舒张伸展飞花系数
        const handSpan = dist3D(thumbTip, pinkyTip);
        const stretchMin = 0.24;
        const stretchMax = 0.50;
        const smileScore = Math.max(0, Math.min(1.0, (handSpan - stretchMin) / (stretchMax - stretchMin)));
        const rightIsSmiling = handSpan > 0.42;

        // 手势"8" 检测
        const isGesture8Instant = indexExt && thumbExt && !middleExt && !ringExt && !pinkyExt;
        let isGesture8 = false;
        const now = Date.now();

        if (isGesture8Instant) {
          if (gesture8StartTimeRef.current === null) {
            gesture8StartTimeRef.current = now;
            gesture8StartPosRef.current = { x: palmCenter.x, y: palmCenter.y };
          } else {
            const startPos = gesture8StartPosRef.current!;
            const totalDisplacement = Math.hypot(palmCenter.x - startPos.x, palmCenter.y - startPos.y);

            let instantDisplacement = 0;
            if (gesture8LastFramePosRef.current) {
              instantDisplacement = Math.hypot(palmCenter.x - gesture8LastFramePosRef.current.x, palmCenter.y - gesture8LastFramePosRef.current.y);
            }

            if (totalDisplacement > 0.06 || instantDisplacement > 0.035) {
              gesture8StartTimeRef.current = now;
              gesture8StartPosRef.current = { x: palmCenter.x, y: palmCenter.y };
            }
          }

          gesture8LastFramePosRef.current = { x: palmCenter.x, y: palmCenter.y };

          const elapsed = (now - gesture8StartTimeRef.current!) / 1000;
          if (elapsed >= 8.0) {
            isGesture8 = true;
            gesture8StartTimeRef.current = null;
            gesture8StartPosRef.current = null;
            gesture8LastFramePosRef.current = null;
          }
        }

        // 映射坐标（至曼陀罗定位区）
        let rx = 1.0 - palmCenter.x;
        let ry = palmCenter.y;
        rx = (rx - 0.15) / 0.7;
        ry = (ry - 0.1) / 0.8;
        rx = Math.max(0.01, Math.min(0.99, rx));
        ry = Math.max(0.01, Math.min(0.99, ry));

        rightHandStateRef.current = {
          detected: true,
          gazePoint: { x: rx, y: ry },
          isOpen: rightIsOpen,
          isSmiling: rightIsSmiling,
          smileScore,
          handAngle: rightHandAngle,
          isGesture8,
        };
      }
    }

    if (!rightHandStateRef.current.detected) {
      gesture8StartTimeRef.current = null;
      gesture8StartPosRef.current = null;
      gesture8LastFramePosRef.current = null;
    }

    updateCombinedTracking();
  };

  // 脸部回调
  const handleFaceResults = (results: any) => {
    if (!results || !results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      faceStateRef.current = {
        detected: false,
        isOpen: true,
        isSmiling: false,
        smileScore: 0.0,
        gazePoint: null,
      };
      vFaceLandmarksRef.current = null;
      updateCombinedTracking();
      return;
    }

    const landmarks = results.multiFaceLandmarks[0];
    vFaceLandmarksRef.current = landmarks;

    // 眨角计算
    const leftEyeHeight = Math.hypot(landmarks[159].x - landmarks[145].x, landmarks[159].y - landmarks[145].y);
    const leftEyeWidth = Math.hypot(landmarks[33].x - landmarks[133].x, landmarks[33].y - landmarks[133].y);
    const leftRatio = leftEyeWidth > 0 ? leftEyeHeight / leftEyeWidth : 0.24;

    const rightEyeHeight = Math.hypot(landmarks[386].x - landmarks[374].x, landmarks[386].y - landmarks[374].y);
    const rightEyeWidth = Math.hypot(landmarks[362].x - landmarks[263].x, landmarks[362].y - landmarks[263].y);
    const rightRatio = rightEyeWidth > 0 ? rightEyeHeight / rightEyeWidth : 0.24;

    const avgEyeRatio = (leftRatio + rightRatio) / 2.0;
    const faceIsOpen = avgEyeRatio > 0.125; // 超过该阈值为睁眼

    // 笑容计算 (嘴宽对应眼距)
    const eyesDist = Math.hypot(landmarks[33].x - landmarks[263].x, landmarks[33].y - landmarks[263].y);
    const mouthWidth = Math.hypot(landmarks[61].x - landmarks[291].x, landmarks[61].y - landmarks[291].y);
    const smileRatio = eyesDist > 0 ? mouthWidth / eyesDist : 0.65;
    
    const faceSmileScore = Math.max(0, Math.min(1.0, (smileRatio - 0.64) / 0.18));
    const faceIsSmiling = faceSmileScore > 0.38;

    // 鼻坐标
    const nose = landmarks[4];
    let fx = 1.0 - nose.x;
    let fy = nose.y;

    fx = (fx - 0.25) / 0.5;
    fy = (fy - 0.25) / 0.5;
    fx = Math.max(0.01, Math.min(0.99, fx));
    fy = Math.max(0.01, Math.min(0.99, fy));

    faceStateRef.current = {
      detected: true,
      isOpen: faceIsOpen,
      isSmiling: faceIsSmiling,
      smileScore: faceSmileScore,
      gazePoint: { x: fx, y: fy },
    };

    updateCombinedTracking();
  };

  // 高画质流体双骨骼叠加绘制
  const drawCompositeWireframe = () => {
    if (!showMeshDebug || !debugCanvasRef.current || !videoRef.current) return;
    const dbgCanvas = debugCanvasRef.current;
    const dbgCtx = dbgCanvas.getContext("2d");
    if (!dbgCtx) return;

    dbgCtx.clearRect(0, 0, dbgCanvas.width, dbgCanvas.height);

    // 1. 高品质镜像镜像叠加层
    dbgCtx.save();
    dbgCtx.globalAlpha = 0.88;
    dbgCtx.scale(-1, 1);
    dbgCtx.drawImage(videoRef.current, -dbgCanvas.width, 0, dbgCanvas.width, dbgCanvas.height);
    dbgCtx.restore();

    const drawHandMesh = (landmarks: any, isLeft: boolean) => {
      dbgCtx.strokeStyle = isLeft ? "rgba(0, 229, 255, 0.65)" : "rgba(212, 175, 55, 0.65)"; // 左手青绿色，右手香槟金
      dbgCtx.lineWidth = 1.3;

      const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4], 
        [0, 5], [5, 6], [6, 7], [7, 8], 
        [9, 10], [10, 11], [11, 12], 
        [13, 14], [14, 15], [15, 16], 
        [0, 17], [17, 18], [18, 19], [19, 20], 
        [5, 9], [9, 13], [13, 17]
      ];

      connections.forEach(([p1, p2]) => {
        const l1 = landmarks[p1];
        const l2 = landmarks[p2];
        dbgCtx.beginPath();
        dbgCtx.moveTo((1.0 - l1.x) * dbgCanvas.width, l1.y * dbgCanvas.height);
        dbgCtx.lineTo((1.0 - l2.x) * dbgCanvas.width, l2.y * dbgCanvas.height);
        dbgCtx.stroke();
      });

      // 关节点
      landmarks.forEach((lmk: any, idx: number) => {
        const lx = (1.0 - lmk.x) * dbgCanvas.width;
        const ly = lmk.y * dbgCanvas.height;
        dbgCtx.beginPath();
        dbgCtx.arc(lx, ly, [4, 8, 12, 16, 20].includes(idx) ? 2.5 : 1.3, 0, Math.PI * 2);
        dbgCtx.fillStyle = [4, 8, 12, 16, 20].includes(idx) ? "#FFFFFF" : (isLeft ? "#00E5FF" : "#E0B86E");
        dbgCtx.fill();
      });
    };

    // 绘制左手与右手骨骼
    if (vLeftHandLandmarksRef.current) {
      drawHandMesh(vLeftHandLandmarksRef.current, true);
    }
    if (vRightHandLandmarksRef.current) {
      drawHandMesh(vRightHandLandmarksRef.current, false);
    }

    // 3. 绘制面部骨骼 (精简关键五官以便优雅体现，不遮挡手部)
    if (vFaceLandmarksRef.current) {
      const landmarks = vFaceLandmarksRef.current;
      dbgCtx.strokeStyle = "rgba(121, 134, 203, 0.4)"; // 莫奈幽雅蓝
      dbgCtx.lineWidth = 1.0;

      // 双眼圈
      const leftEyeIndices = [33, 160, 158, 133, 153, 144];
      const rightEyeIndices = [362, 385, 387, 263, 373, 380];
      const outerLipIndices = [61, 37, 291, 321, 61];

      const drawLoop = (indices: number[]) => {
        dbgCtx.beginPath();
        indices.forEach((idx, i) => {
          const lmk = landmarks[idx];
          if (lmk) {
            const lx = (1.0 - lmk.x) * dbgCanvas.width;
            const ly = lmk.y * dbgCanvas.height;
            if (i === 0) dbgCtx.moveTo(lx, ly);
            else dbgCtx.lineTo(lx, ly);
          }
        });
        dbgCtx.closePath();
        dbgCtx.stroke();
      };

      drawLoop(leftEyeIndices);
      drawLoop(rightEyeIndices);
      drawLoop(outerLipIndices);

      // 眉毛
      const leftBrow = [70, 107];
      const rightBrow = [300, 336];

      const drawLine = (indices: number[]) => {
        if (!landmarks[indices[0]] || !landmarks[indices[1]]) return;
        const p1 = landmarks[indices[0]];
        const p2 = landmarks[indices[1]];
        dbgCtx.beginPath();
        dbgCtx.moveTo((1.0 - p1.x) * dbgCanvas.width, p1.y * dbgCanvas.height);
        dbgCtx.lineTo((1.0 - p2.x) * dbgCanvas.width, p2.y * dbgCanvas.height);
        dbgCtx.stroke();
      };

      drawLine(leftBrow);
      drawLine(rightBrow);
    }
  };

  return (
    <div
      className="relative flex flex-col items-center justify-center p-1 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md shadow-2xl overflow-hidden"
      id="camera-gesture-tracker-panel"
    >
      <video
        ref={videoRef}
        className="hidden"
        playsInline
        muted
        width={320}
        height={240}
        id="camera-capture-video"
      />

      {active ? (
        <div className="relative w-48 h-36 rounded-xl overflow-hidden bg-black/60">
          {cameraState === "loading" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/70">
              <div className="w-6 h-6 rounded-full border-2 border-[#E0B86E]/20 border-t-[#E0B86E] animate-spin" />
            </div>
          )}
          {cameraState === "denied" && (
            <div className="absolute inset-0 flex items-center justify-center bg-rose-950/40">
              <span className="w-3 h-3 bg-rose-500 rounded-full animate-ping" />
            </div>
          )}
          <canvas
            ref={debugCanvasRef}
            width={192}
            height={144}
            className="w-full h-full block"
            id="mesh-debug-canvas"
          />
        </div>
      ) : null}
    </div>
  );
};
