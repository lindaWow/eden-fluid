/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { FlowSeed, FluidWave, Ripple, Particle } from "../types";
import { getCurlNoise, getFloralBoundaryPoint, damp } from "../utils/math";
import { audioEngine } from "../utils/audio";

interface InteractiveCanvasProps {
  gazePoint: { x: number; y: number } | null;
  gazeFocusId: number | null;
  isOpen: boolean; // 眨眼睁闭/握拳入定状态 (true = 睁开/舒展, false = 闭合/入定)
  isSmiling: boolean; // 笑容/舒掌标志
  smileScore: number;
  useMouseMode: boolean;
  seeds: FlowSeed[];
  waves: FluidWave[];
  onSeedsUpdate: (seeds: FlowSeed[]) => void;
  onWavesUpdate: (waves: FluidWave[]) => void;
  isPinching?: boolean;
  handAngle?: number;
  hasInteracted: boolean;
  onInteracted: () => void;
  isDarkNightMode?: boolean;
  isGesture8?: boolean;
  isHandDetected?: boolean;
  isIndexOnly?: boolean;
  rightHandPoint?: { x: number; y: number } | null;
  isRightHandDetected?: boolean;
  isMicEnabled?: boolean;
}

const getTitlePoints = (): { x: number; y: number }[] => {
  const points: { x: number; y: number }[] = [];
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");
  if (!tempCtx) return [];

  // 增大字体采样宽度与分辨率
  tempCanvas.width = 640;
  tempCanvas.height = 160;

  // 纯黑背景
  tempCtx.fillStyle = "black";
  tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

  // 渲染优雅中式行楷/雅黑流沙文字
  tempCtx.fillStyle = "white";
  tempCtx.font = "bold 72px 'STKaiti', 'Kaiti', 'KaiTi_GB2312', 'Microsoft YaHei', sans-serif";
  tempCtx.textAlign = "center";
  tempCtx.textBaseline = "middle";
  tempCtx.fillText("伊甸流沙", tempCanvas.width / 2, tempCanvas.height / 2);

  const imgData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
  const data = imgData.data;

  // 跨距间隔跨步采样，构造流沙颗粒的高密度微型点集群
  const step = 2;
  for (let y = 0; y < tempCanvas.height; y += step) {
    for (let x = 0; x < tempCanvas.width; x += step) {
      const idx = (y * tempCanvas.width + x) * 4;
      if (data[idx] > 110) {
        const nx = (x - tempCanvas.width / 2) / tempCanvas.width;
        const ny = (y - tempCanvas.height / 2) / tempCanvas.height;
        points.push({ x: nx, y: ny });
      }
    }
  }
  return points;
};

interface MandalaCoord {
  mr: number;
  mtheta: number;
}

const getMandalaState = (stateIdx: number, i: number, tVal: number, angleFactor: number): MandalaCoord => {
  const k = i % 4000;
  const subset = i % 5;
  let mr = 0;
  let mtheta = 0;

  switch (stateIdx) {
    case 1:
      if (subset === 0) {
        mr = 1.6 * Math.sqrt(k) + 12;
        mtheta = k * 137.5 * Math.PI / 180 + tVal * 0.0008;
      } else if (subset === 1) {
        mtheta = angleFactor - tVal * 0.0006;
        mr = 120 + 32 * Math.cos(8 * mtheta);
      } else if (subset === 2) {
        mtheta = angleFactor + tVal * 0.0005;
        mr = 190 + 40 * Math.abs(Math.sin(6 * mtheta));
      } else if (subset === 3) {
        mtheta = angleFactor - tVal * 0.0004;
        mr = 260 + 55 * Math.cos(16 * mtheta) * Math.sin(8 * mtheta);
      } else {
        mtheta = angleFactor + tVal * 0.0003;
        mr = 330 + 15 * Math.sin(32 * mtheta);
      }
      break;

    case 2:
      // Sacred Pentagon & Triquetra Spirals
      if (subset === 0) {
        mr = 2.4 * Math.sqrt(k) + 20;
        mtheta = k * 99.5 * Math.PI / 180 + tVal * 0.0012;
      } else if (subset === 1) {
        mtheta = angleFactor + tVal * 0.0004;
        mr = 110 + 45 * Math.cos(5 * mtheta);
      } else if (subset === 2) {
        mtheta = angleFactor - tVal * 0.0005;
        mr = 180 + 35 * Math.sin(10 * mtheta);
      } else if (subset === 3) {
        mtheta = angleFactor + tVal * 0.0006;
        mr = 270 + 40 * Math.cos(12 * mtheta + Math.sin(4 * mtheta));
      } else {
        mtheta = angleFactor - tVal * 0.0003;
        mr = 340 + 25 * Math.cos(24 * mtheta);
      }
      break;

    case 3:
      // Royal Clover & Hypnotic Gears
      if (subset === 0) {
        mr = 45 + 25 * Math.cos(3 * angleFactor);
        mtheta = angleFactor + tVal * 0.0015;
      } else if (subset === 1) {
        mtheta = angleFactor - tVal * 0.0008;
        mr = 115 + 24 * Math.sin(12 * mtheta);
      } else if (subset === 2) {
        mtheta = angleFactor + tVal * 0.0007;
        mr = 195 + 45 * Math.cos(6 * mtheta);
      } else if (subset === 3) {
        mtheta = angleFactor - tVal * 0.0005;
        mr = 255 + 50 * Math.sin(18 * mtheta);
      } else {
        mtheta = angleFactor + tVal * 0.0004;
        mr = 335 + 28 * Math.cos(40 * mtheta);
      }
      break;

    case 4:
      // Cosmic Butterfly & Sacred Lotus
      if (subset === 0) {
        mr = 50 + 20 * Math.cos(4 * angleFactor);
        mtheta = angleFactor - tVal * 0.0012;
      } else if (subset === 1) {
        mtheta = angleFactor + tVal * 0.0009;
        mr = 125 + 35 * (Math.cos(3 * mtheta) * Math.cos(5 * mtheta));
      } else if (subset === 2) {
        mtheta = angleFactor - tVal * 0.0008;
        mr = 185 + 40 * Math.cos(15 * mtheta);
      } else if (subset === 3) {
        mtheta = angleFactor + tVal * 0.0006;
        mr = 265 + 48 * Math.abs(Math.sin(10 * mtheta));
      } else {
        mtheta = angleFactor - tVal * 0.0005;
        mr = 345 + 16 * Math.sin(64 * mtheta);
      }
      break;

    case 5:
    default:
      // Infinite Sacred Vortex & Metatron Star
      if (subset === 0) {
        mr = 25 + 35 * Math.sin(2 * angleFactor + tVal * 0.002);
        mtheta = angleFactor + tVal * 0.0018;
      } else if (subset === 1) {
        mtheta = angleFactor - tVal * 0.0011;
        mr = 118 + 42 * Math.cos(7 * mtheta);
      } else if (subset === 2) {
        mtheta = angleFactor + tVal * 0.0009;
        mr = 192 + 38 * Math.cos(14 * mtheta);
      } else if (subset === 3) {
        mtheta = angleFactor - tVal * 0.0007;
        mr = 272 + 52 * Math.cos(28 * mtheta) * Math.cos(14 * mtheta);
      } else {
        mtheta = angleFactor + tVal * 0.0004;
        mr = 350 + 12 * Math.sin(128 * mtheta);
      }
      break;
  }

  return { mr, mtheta };
};

export const InteractiveCanvas: React.FC<InteractiveCanvasProps> = ({
  gazePoint,
  gazeFocusId,
  isOpen,
  isSmiling,
  smileScore,
  useMouseMode,
  seeds,
  waves,
  onSeedsUpdate,
  onWavesUpdate,
  isPinching = false,
  handAngle = -Math.PI / 2,
  hasInteracted,
  onInteracted,
  isDarkNightMode = false,
  isGesture8 = false,
  isHandDetected = false,
  isIndexOnly = false,
  rightHandPoint = null,
  isRightHandDetected = false,
  isMicEnabled = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 麦克风录音与低频/节奏分析
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const micContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (isMicEnabled) {
      const initMic = async () => {
        try {
          if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn("navigator.mediaDevices.getUserMedia is not supported or blocked in this environment (HTTP context, missing hardware, or denied permissions).");
            return;
          }
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micStreamRef.current = stream;
          
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          micContextRef.current = audioCtx;
          
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          // 用 512 FFT 大小，以确保频率分析相应速度极快
          analyser.fftSize = 512;
          analyser.smoothingTimeConstant = 0.65; // 轻度平滑，动作更具律动和张力
          source.connect(analyser);
          
          micAnalyserRef.current = analyser;
          console.log("Eden Mic Listening Engine activated successfully.");
        } catch (err) {
          console.error("Failed to start Eden mic listener:", err);
        }
      };
      initMic();
    } else {
      // 优雅清理所有录音轨道，完全杜绝红点常亮
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
      }
      if (micContextRef.current && micContextRef.current.state !== "closed") {
        micContextRef.current.close().catch(() => {});
        micContextRef.current = null;
      }
      micAnalyserRef.current = null;
    }

    return () => {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (micContextRef.current && micContextRef.current.state !== "closed") {
        micContextRef.current.close().catch(() => {});
      }
    };
  }, [isMicEnabled]);

  // 动画状态变量与曼达拉守序进度控制
  const particlesRef = useRef<Particle[]>([]);
  const ripplesRef = useRef<Ripple[]>([]);
  const mouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const lastMouseMoveTimeRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // 延后开屏文字散开：状态追踪 (未交互前一直保持优雅字形)
  const hasInteractedRef = useRef<boolean>(hasInteracted);
  const textDissolveProgress = useRef<number>(0);
  const initialFocusPointRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    hasInteractedRef.current = hasInteracted;
  }, [hasInteracted]);
  
  // 曼达拉几何锁定进度 (使用 ref 具有惯性与顺滑平漂阻尼物理)
  const targetMandalaProgress = useRef<number>(0);
  const currentMandalaProgress = useRef<number>(0);

  // 追踪与插值手势旋转角度 (满足需求 7)
  const currentHandRotation = useRef<number>(0);

  // 左右滚动和拖动调整整体色调 (无缝色彩过渡)
  const isDraggingRef = useRef<boolean>(false);
  const dragLastXRef = useRef<number>(0);
  const globalHueShiftRef = useRef<number>(0);
  const currentHueShift = useRef<number>(0);

  // 宁静度与运动幅度追踪：手掌在曼陀罗图案中央静息越久，流沙分子排列越晶莹守序規律
  const lastFocusXRef = useRef<number>(600);
  const lastFocusYRef = useRef<number>(400);
  const stationaryTimeRef = useRef<number>(0);
  const swingIntensityRef = useRef<number>(0);
  const currentStillnessRef = useRef<number>(0);
  const currentSwingRef = useRef<number>(0);

  // 追踪各个种子的悬停静息时长与聚焦度: 在起始光斑悬停越久，出来的花瓣线条分子排列越聚拢清晰
  const seedStillnessRef = useRef<Record<number, number>>({});

  // 5个植物粒子种子在光标经过时的拉扯变形位移 Ref (自然的弹性拖曳质感)
  const seedOffsetsRef = useRef<Record<number, { x: number; y: number }>>({
    0: { x: 0, y: 0 },
    1: { x: 0, y: 0 },
    2: { x: 0, y: 0 },
    3: { x: 0, y: 0 },
    4: { x: 0, y: 0 },
  });

  // 追踪已被点击、向周边无限消散到空间中的植物花朵种子 ID 状态
  const dispersedSeedsRef = useRef<Record<number, boolean>>({
    0: false,
    1: false,
    2: false,
    3: false,
    4: false,
  });

  // 追踪曼达拉模式下各个光晕的悬停慢速无声胀大进度 (0 ~ 1.0)
  const haloHoverProgressRef = useRef<number[]>([0, 0, 0, 0, 0]);

  // 烟花彩蛋状态
  const fireworkStateRef = useRef({
    phase: "idle" as "idle" | "aggregating" | "exploding" | "returning",
    progress: 0,
    cx: 0,
    cy: 0,
    timer: 0,
  });
  
  // 保持高粒子密度以渲染震撼的艺术效果
  const [particleCount] = useState<number>(20000);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 800 });

  // 统一交互触发：将 hasInteracted 设置为 true 并同步告知音频层，激活音效变化
  const setHasInteractedTrue = () => {
    if (!hasInteractedRef.current) {
      hasInteractedRef.current = true;
      onInteracted();
      audioEngine.setHasInteracted(true);
    }
  };

  // 1. 把手势的上下挥动与滚轮的上下滚动进行结合，共享相同的目标进度调节逻辑
  const adjustMandalaProgress = (step: number) => {
    targetMandalaProgress.current = Math.max(0.0, Math.min(6.0, targetMandalaProgress.current + step));
  };

  // 监听容器大小变更
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 监听触控板/鼠标滚轮动态滚动调制全局熵(控制混乱流体凝聚，以及色调在左右滑动时平滑过渡)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      if (!hasInteractedRef.current) return;
      e.preventDefault();
      
      // 左右滚动 (deltaX) 高灵敏度平滑色调调控
      if (Math.abs(e.deltaX) > 0.1) {
        globalHueShiftRef.current += e.deltaX * 0.28;
        audioEngine.triggerRapidShiftSound(Math.abs(e.deltaX * 0.28), e.deltaX > 0);
      }

      // 上下滚动 (deltaY) 调节全局守序进度 (曼达拉)
      if (Math.abs(e.deltaY) > 0.1) {
        // 因应不同硬件及滚动模式（如触控板自然滚动），将物理方向极性对齐用户习惯：
        // 向上滚动/向上扫拂时，增加 progress 激发展现多重极美神圣曼达拉并进行多重质变与无极几何重组；
        // 向下滚动/向下扫拂时，降低 progress 逐步消退，使曼达拉完全消散并重归为无序的散点沙粒。
        const step = e.deltaY * 0.0045;
        adjustMandalaProgress(step);
      }
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      canvas.removeEventListener("wheel", handleWheel);
    };
  }, [dimensions]);

  // 窗口高宽变换时更新 Canvas 的宽 and 高
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = dimensions.width;
    canvas.height = dimensions.height;
    
    if (particlesRef.current.length === 0) {
      initParticles();
    } else {
      particlesRef.current.forEach(p => {
        if (p.x > dimensions.width) p.x = Math.random() * dimensions.width;
        if (p.y > dimensions.height) p.y = Math.random() * dimensions.height;
      });
    }
  }, [dimensions]);

  const initParticles = () => {
    const arr: Particle[] = [];
    const count = particleCount;
    const textPoints = getTitlePoints();

    for (let i = 0; i < count; i++) {
      let x = Math.random() * dimensions.width;
      let y = Math.random() * dimensions.height;
      let startAsText = false;

      if (textPoints.length > 0 && i < count * 0.45) {
        const pt = textPoints[i % textPoints.length];
        
        // 占据画面宽度的 50%，根据 4:1 的比例计算高度并完全居中
        const targetTextWidth = dimensions.width * 0.50;
        const targetTextHeight = targetTextWidth * 0.25;
        
        x = dimensions.width / 2 + pt.x * targetTextWidth + (Math.random() - 0.5) * 4.0;
        y = dimensions.height / 2 + pt.y * targetTextHeight + (Math.random() - 0.5) * 4.0;
        startAsText = true;
      }
      
      const isWhiteParticle = !startAsText && (i % 6 === 0);
      
      const p: Particle = {
        x,
        y,
        baseX: x,
        baseY: y,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        ax: 0,
        ay: 0,
        size: startAsText ? Math.random() * 1.5 + 0.9 : 0.9 + Math.random() * 1.8,
        hue: startAsText ? 42 : 0, // 42 是奢奢流金的微醺琥珀橙金色，使文字更有生机与能量
        saturation: startAsText ? 85 : 0,
        brightness: startAsText ? 85 : 95,
        alpha: startAsText ? 0.0 : 0.14 + Math.random() * 0.28, // 启动时淡入
        targetAlpha: startAsText ? Math.random() * 0.75 + 0.25 : 0.14 + Math.random() * 0.28,
        mass: 0.82 + Math.random() * 1.35,
        friction: 0.93 + Math.random() * 0.04,
        isBlooming: false,
        bloomSeedId: null,
        petalIndex: i % 1000, 
        petalDistance: Math.random(),
        isWhite: isWhiteParticle
      };
      arr.push(p);
    }
    particlesRef.current = arr;
  };

  useEffect(() => {
    initParticles();
  }, [particleCount]);

  // 当眨眼/合眼发生状态改变，触发涟漪与音频状态切换
  const prevIsOpen = useRef(true);
  useEffect(() => {
    if (prevIsOpen.current && !isOpen) {
      audioEngine.setBlinkState(true);
    } else if (!prevIsOpen.current && isOpen) {
      audioEngine.setBlinkState(false);
      
      const isMouseActive = useMouseMode || (Date.now() - lastMouseMoveTimeRef.current < 2500) || !gazePoint;
      const rippleX = isMouseActive ? mouseRef.current.x : (gazePoint ? gazePoint.x * dimensions.width : dimensions.width / 2);
      const rippleY = isMouseActive ? mouseRef.current.y : (gazePoint ? gazePoint.y * dimensions.height : dimensions.height / 2);
      
      ripplesRef.current.push({
        id: Date.now(),
        x: rippleX,
        y: rippleY,
        radius: 6,
        maxRadius: 320,
        strength: 10.0,
        life: 1.0
      });
    }
    prevIsOpen.current = isOpen;
  }, [isOpen, gazePoint, dimensions, useMouseMode]);

  // 双指手势捏合，等效触发鼠标点击星芒涟漪效果 (满足需求 6)
  const prevIsPinching = useRef(false);
  useEffect(() => {
    if (!useMouseMode && !prevIsPinching.current && isPinching) {
      const rippleX = gazePoint ? gazePoint.x * dimensions.width : dimensions.width / 2;
      const rippleY = gazePoint ? gazePoint.y * dimensions.height : dimensions.height / 2;
      
      const isMandalaActive = currentMandalaProgress.current > 0.08;
      const maxRadius = isMandalaActive ? 385 : 300;
      const strength = isMandalaActive ? 9.2 : 8.0;

      ripplesRef.current.push({
        id: Date.now(),
        x: rippleX,
        y: rippleY,
        radius: 12,
        maxRadius: maxRadius,
        strength: strength,
        life: 1.0,
        isClick: true
      });
      audioEngine.triggerChime(1.0);
    }
    prevIsPinching.current = isPinching;
  }, [isPinching, gazePoint, dimensions, useMouseMode]);

  // 左右挥动挥扫调节颜色，上下挥动调节神圣几何进度 (满足需求 2 & 3)
  // 左手控制色调，右手（或者左手不捏合时）控制神圣曼达拉几何进度
  const prevGazePointRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!useMouseMode && gazePoint) {
      if (prevGazePointRef.current) {
        const dx = gazePoint.x - prevGazePointRef.current.x;
        const dy = gazePoint.y - prevGazePointRef.current.y;

        // 左右滑动：仅当左手捏合 (isPinching 为 true) 时控制色调滑动
        if (isPinching && Math.abs(dx) > 0.0005) {
          globalHueShiftRef.current += dx * 650.0;
          audioEngine.triggerRapidShiftSound(Math.abs(dx * 650.0), dx > 0);
        }

        // 给左手的捏合增加上下滑动：映射到鼠标滚轮上下滑动调节曼达拉几何外观
        if (isPinching && Math.abs(dy) > 0.0005) {
          const stepY = -dy * 5.0;
          adjustMandalaProgress(stepY);
        }

        // 上下滑动（未捏合）：如果无右手检测，则左手作为备用微调曼陀罗进度
        if (!isPinching && !rightHandPoint && Math.abs(dy) > 0.0005) {
          const stepY = -dy * 5.0; 
          adjustMandalaProgress(stepY);
        }
      }
      prevGazePointRef.current = { ...gazePoint };
    } else {
      prevGazePointRef.current = null;
    }
  }, [gazePoint, isPinching, useMouseMode, rightHandPoint]);

  // 新增：右手单独上下滑动调节神圣曼达拉几何进度
  const prevRightHandPointRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!useMouseMode && rightHandPoint) {
      if (prevRightHandPointRef.current) {
        const dy = rightHandPoint.y - prevRightHandPointRef.current.y;
        if (Math.abs(dy) > 0.0005) {
          const stepY = -dy * 5.0; 
          adjustMandalaProgress(stepY);
        }
      }
      prevRightHandPointRef.current = { ...rightHandPoint };
    } else {
      prevRightHandPointRef.current = null;
    }
  }, [rightHandPoint, useMouseMode]);

  // 2. 鼠标与触控拖拽左右移动色调，上下滚动几何
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setHasInteractedTrue();
    isDraggingRef.current = true;
    dragLastXRef.current = e.clientX;
    lastMouseMoveTimeRef.current = Date.now();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    lastMouseMoveTimeRef.current = Date.now();

    if (isDraggingRef.current) {
      const dx = e.clientX - dragLastXRef.current;
      dragLastXRef.current = e.clientX;
      globalHueShiftRef.current += dx * 0.55; // 左右调色高灵敏度
      if (Math.abs(dx) > 0.1) {
        audioEngine.triggerRapidShiftSound(Math.abs(dx * 0.55), dx > 0);
      }
    }
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    setHasInteractedTrue();
    if (e.touches.length > 0) {
      isDraggingRef.current = true;
      dragLastXRef.current = e.touches[0].clientX;
      lastMouseMoveTimeRef.current = Date.now();
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || e.touches.length === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    mouseRef.current = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
    lastMouseMoveTimeRef.current = Date.now();

    if (isDraggingRef.current) {
      const dx = touch.clientX - dragLastXRef.current;
      dragLastXRef.current = touch.clientX;
      globalHueShiftRef.current += dx * 0.55;
      if (Math.abs(dx) > 0.1) {
        audioEngine.triggerRapidShiftSound(Math.abs(dx * 0.55), dx > 0);
      }
    }
  };

  // 点击触发额外的星芒涟漪和花朵向周边的无限消散/凝聚交互
  const handleCanvasClick = () => {
    setHasInteractedTrue();
    lastMouseMoveTimeRef.current = Date.now();
    
    const isMandalaActive = currentMandalaProgress.current > 0.08;
    let maxRadius = isMandalaActive ? 580 : 300; // 曼达拉点击大幅度向外激震
    let strength = isMandalaActive ? 16.0 : 8.0;

    if (isMandalaActive) {
      // 曼陀罗大涟漪：恢鸣悠远水涟音效
      audioEngine.triggerMandalaRippleSound();
    } else {
      let dispersedAny = false;
      seeds.forEach(s => {
        const offset = seedOffsetsRef.current[s.id] || { x: 0, y: 0 };
        const sx = s.x * dimensions.width + offset.x;
        const sy = s.y * dimensions.height + offset.y;
        const dist = Math.hypot(mouseRef.current.x - sx, mouseRef.current.y - sy);
        
        // 只有开花进度大于一定程度时才可以点击花晕消散
        if (dist < 140 && s.bloomProgress > 0.02) {
          dispersedSeedsRef.current[s.id] = true;
          dispersedAny = true;
        }
      });
      
      if (dispersedAny) {
        audioEngine.triggerChime(1.2);
        maxRadius = 380;
        strength = 10.5;
      } else {
        audioEngine.triggerChime(1.0);
      }
    }

    ripplesRef.current.push({
      id: Date.now(),
      x: mouseRef.current.x,
      y: mouseRef.current.y,
      radius: 12,
      maxRadius: maxRadius,
      strength: strength,
      life: 1.0,
      isClick: true
    });
  };

  // 动力学与渲染计算主循环
  useEffect(() => {
    let animId: number;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    const frameStep = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = Math.min((timestamp - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = timestamp;
      timeRef.current += 1.0;

      // 1. 绘制背景 LERP 融合渐变
      ctx.save();
      const gradient = ctx.createLinearGradient(0, 0, dimensions.width, dimensions.height);
      const waveOffset = Math.sin(timestamp * 0.00015) * 6;
      
      if (hasInteractedRef.current && isOpen && !isDarkNightMode) {
        // 莫奈素雅清新珍珠白与浅绿渐变
        const g1 = `rgba(${Math.floor(233 + waveOffset)}, ${Math.floor(244 - waveOffset)}, ${Math.floor(234 + waveOffset)}, 0.15)`;
        const g2 = `rgba(${Math.floor(208 - waveOffset)}, ${Math.floor(217 + waveOffset)}, ${Math.floor(222)}, 0.15)`;
        const g3 = `rgba(246, 246, 246, 0.15)`;
        gradient.addColorStop(0, g1);
        gradient.addColorStop(0.5, g2);
        gradient.addColorStop(1, g3);
      } else {
        // 闭眼冥想般的深邃星野绿 (#080E0B)
        gradient.addColorStop(0, "rgba(5, 10, 8, 0.22)");
        gradient.addColorStop(0.5, "rgba(9, 15, 12, 0.22)");
        gradient.addColorStop(1, "rgba(13, 18, 20, 0.22)");
      }
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);
      ctx.restore();

      // 2. 推进圈圈涟漪
      ripplesRef.current = ripplesRef.current.filter(r => {
        r.radius += (r.maxRadius - r.radius) * 4.8 * dt;
        r.life -= 1.4 * dt;
        return r.life > 0;
      });

      // 3. 推进蝶翼大涌流
      const activeWaves = [...waves];
      const nextWaves = activeWaves.map(w => {
        w.progress += w.speed * dt;
        return w;
      }).filter(w => w.progress < 1.0);
      
      if (nextWaves.length !== waves.length) {
        onWavesUpdate(nextWaves);
      }

        // 4. 定位意向坐标 (食指光标控制或交互以后激活)
      let focusX = dimensions.width / 2;
      let focusY = dimensions.height / 2;
      let isFocusActive = false;

      // 决定在这种混合输入场景下，是否已激活鼠标且进行优先控制
      const isMouseActive = useMouseMode || (Date.now() - lastMouseMoveTimeRef.current < 2500) || (!gazePoint && !rightHandPoint);

      if (((isIndexOnly || !useMouseMode) && (gazePoint || rightHandPoint)) && !hasInteractedRef.current) {
        setHasInteractedTrue();
      }

      if (hasInteractedRef.current || isIndexOnly || (!useMouseMode && (gazePoint || rightHandPoint)) || isMouseActive) {
        if (isMouseActive) {
          focusX = mouseRef.current.x;
          focusY = mouseRef.current.y;
          isFocusActive = true;
        } else if (rightHandPoint) {
          focusX = rightHandPoint.x * dimensions.width;
          focusY = rightHandPoint.y * dimensions.height;
          isFocusActive = true;
        } else if (gazePoint) {
          focusX = gazePoint.x * dimensions.width;
          focusY = gazePoint.y * dimensions.height;
          isFocusActive = true;
        }
      }

      // 计算手势/光标静止时间与摆幅大小 (静止与有序回归)
      const centerDist = Math.hypot(focusX - dimensions.width / 2, focusY - dimensions.height / 2);
      const focusVel = dt > 0 ? Math.hypot(focusX - lastFocusXRef.current, focusY - lastFocusYRef.current) / dt : 0;
      lastFocusXRef.current = focusX;
      lastFocusYRef.current = focusY;

      if (isFocusActive && centerDist < 290) {
        if (focusVel < 75) {
          // 静止越久，静止分度累加越深
          stationaryTimeRef.current = Math.min(6.0, stationaryTimeRef.current + dt);
          swingIntensityRef.current = damp(swingIntensityRef.current, 0.0, 3.2, dt);
        } else {
          // 产生较大晃动/摆动时
          const speedRatio = Math.min(1.0, focusVel / 650);
          swingIntensityRef.current = Math.min(1.0, swingIntensityRef.current + speedRatio * dt * 4.5);
          // 静止积累快速退潮
          stationaryTimeRef.current = Math.max(0.0, stationaryTimeRef.current - dt * 2.8);
        }
      } else {
        // 离开曼陀罗核心区域
        stationaryTimeRef.current = Math.max(0.0, stationaryTimeRef.current - dt * 1.6);
        swingIntensityRef.current = damp(swingIntensityRef.current, 0.0, 2.2, dt);
      }

      currentStillnessRef.current = damp(currentStillnessRef.current, stationaryTimeRef.current / 6.0, 3.6, dt);
      currentSwingRef.current = damp(currentSwingRef.current, swingIntensityRef.current, 3.6, dt);

      // 同步告知音频层进行情绪调律
      audioEngine.setStillnessState(currentStillnessRef.current, currentSwingRef.current);

      // 如果交互确实触发，文字散开进度渐进递增 (4.0 秒平滑消散微积分物理机制)
      if ((hasInteractedRef.current || isIndexOnly) && textDissolveProgress.current < 1.0) {
        textDissolveProgress.current += dt / 4.0;
      }

      // 5. 更新植物种子的开花绽放进度，并求解焦点与各光源中心的最近触碰距离（用以唤醒、升腾悬停共鸣音效）
      let closestSeedId: number | null = null;
      let minDistance = Infinity;

      const updatedSeeds = seeds.map(s => {
        const sx = s.x * dimensions.width;
        const sy = s.y * dimensions.height;
        const dist = Math.hypot(focusX - sx, focusY - sy);
        
        // 计算物理弹性拉扯位移
        let targetOffsetX = 0;
        let targetOffsetY = 0;
        const pullRadius = 190;
        if (isFocusActive && dist < pullRadius && dist > 0.1) {
          const t = 1.0 - dist / pullRadius;
          const force = Math.sin(t * Math.PI / 2); // 经典正弦过渡，确保拉扯和释放的过程非常圆润
          const maxPull = 14.0; // 交互极其克制温顺，位移在 14 像素以内
          targetOffsetX = ((focusX - sx) / dist) * force * maxPull;
          targetOffsetY = ((focusY - sy) / dist) * force * maxPull;
        }

        const currentOffset = seedOffsetsRef.current[s.id] || { x: 0, y: 0 };
        // 拉拽进入相对敏锐，离开时光晕极其缓慢地收缩回归原位，变换幅度绝对微弱宁静
        const dampSpeed = (targetOffsetX === 0 && targetOffsetY === 0) ? 1.4 : 3.5;
        const nextOffsetX = damp(currentOffset.x, targetOffsetX, dampSpeed, dt);
        const nextOffsetY = damp(currentOffset.y, targetOffsetY, dampSpeed, dt);
        seedOffsetsRef.current[s.id] = { x: nextOffsetX, y: nextOffsetY };

        if (isFocusActive && dist < minDistance) {
          minDistance = dist;
          closestSeedId = s.id;
        }

        const isNear = isFocusActive && dist < 180;

        // 当光标/焦点再次回到这个区域时，让已经向外消散的粒子重新凝聚复原
        if (isFocusActive && dist < 130 && dispersedSeedsRef.current[s.id]) {
          dispersedSeedsRef.current[s.id] = false;
        }
        
        // 增加悬停静息计算：在起始光斑/光晕处时间越久、摆幅越小，出来的花瓣线条就越守序规整
        if (isNear) {
          const currentSteady = seedStillnessRef.current[s.id] || 0;
          if (focusVel < 75) {
            // 完美保持静止：清晰度累积，2.2 秒达到最高点 (1.0)
            seedStillnessRef.current[s.id] = Math.min(1.0, currentSteady + dt / 2.2);
          } else {
            // 产生微小晃动：清晰度缓慢流失
            const shrinkMultiplier = Math.min(1.0, focusVel / 500);
            seedStillnessRef.current[s.id] = Math.max(0.0, currentSteady - dt * shrinkMultiplier * 1.5);
          }
        } else {
          // 彻底远离：缓慢回归到0
          const currentSteady = seedStillnessRef.current[s.id] || 0;
          seedStillnessRef.current[s.id] = Math.max(0.0, currentSteady - dt * 0.8);
        }
        
        let newProgress = s.bloomProgress;
        const isMandalaMode = currentMandalaProgress.current > 0.08;

        // 曼达拉模式下，光标悬停在光晕上时，光晕慢慢胀大慢速浮升，但不触发任何粒子轨线及花瓣形状变换
        let hp = haloHoverProgressRef.current[s.id] || 0;
        if (isNear) {
          hp = Math.min(1.0, hp + dt / 1.2); // 1.2s hover expansion
        } else {
          hp = Math.max(0.0, hp - dt / 1.5); // 1.5s cool down decay
        }
        haloHoverProgressRef.current[s.id] = hp;

        if (isNear && isOpen && !isMandalaMode) {
          // 微笑或手指舒张能让开花快 2.5 倍，体验酣畅淋漓
          const rateMultiplier = isSmiling ? 2.5 : 1.0;
          newProgress = Math.min(1.0, s.bloomProgress + (dt / 1.6) * rateMultiplier);
          s.active = true;
        } else {
          newProgress = Math.max(0.0, s.bloomProgress - dt / 5.2);
          s.active = false;
        }
        s.bloomProgress = newProgress;
        return s;
      });

      // 计算悬停声学能量强度：在 140 像素的黄金共振场内，越贴近中心，和音振幅越澎湃
      let hoverIntensity = 0;
      const hoverRadius = 140;
      if (closestSeedId !== null && minDistance < hoverRadius) {
        hoverIntensity = Math.pow(1.0 - minDistance / hoverRadius, 1.8);
      } else {
        closestSeedId = null;
      }

      // 将最新悬停信息与能量级别注入音频引擎，触发动态和音升温
      audioEngine.setHoverState(closestSeedId, hoverIntensity);

      let hasSeedChanged = false;
      for (let k = 0; k < seeds.length; k++) {
        if (Math.abs(seeds[k].bloomProgress - updatedSeeds[k].bloomProgress) > 0.001) {
          hasSeedChanged = true;
          break;
        }
      }
      if (hasSeedChanged) {
        onSeedsUpdate(updatedSeeds);
      }

      // 6. 执行 20000 个精微流体粒子计算
      const particles = particlesRef.current;
      const tVal = timeRef.current;

      // 当在镜头模式下且没有手在取景框中时，自动且顺滑地将曼达拉进度向 0.0 方向衰减，模拟向下滚动滚轮以让粒子回归本源散点
      const isHandAbsent = !useMouseMode && !isHandDetected;
      if (isHandAbsent) {
        targetMandalaProgress.current = Math.max(0.0, targetMandalaProgress.current - dt * 2.0);
      }

      // 缓动更新当前曼达拉进度
      currentMandalaProgress.current = damp(currentMandalaProgress.current, targetMandalaProgress.current, 5.0, dt);

      // 缓动更新当前的全局色调偏移
      currentHueShift.current = damp(currentHueShift.current, globalHueShiftRef.current, 4.0, dt);

      // 缓动更新当前手掌张开旋转偏角度数 (满足需求 7)
      let targetRot = 0;
      if (handAngle !== undefined && !useMouseMode) {
        // -Math.PI / 2 是垂直朝上的平衡角
        targetRot = handAngle - (-Math.PI / 2);
      }
      currentHandRotation.current = damp(currentHandRotation.current, targetRot, 5.0, dt);

      // 将曼达拉百分比反馈给音频合成引擎，同步影响声调与谐和度
      audioEngine.setMandalaProgress(currentMandalaProgress.current);

      // 将当前的全局色调偏移反馈给音频合成引擎，触发背景音乐变调及动态滑动沙铃音效
      audioEngine.setHueShift(currentHueShift.current);

      // 烟花彩蛋状态机处理器
      const firework = fireworkStateRef.current;
      
      // 当检测到手势 8 且当前处于空闲状态，则开始聚合
      if (isGesture8 && firework.phase === "idle") {
        firework.phase = "aggregating";
        firework.timer = 0;
        firework.cx = dimensions.width / 2;
        firework.cy = dimensions.height * 0.45;
        firework.progress = 0;
        audioEngine.triggerChime(0.4);
      }

      if (firework.phase !== "idle") {
        firework.timer += 1;
        
        if (firework.phase === "aggregating") {
          firework.progress = Math.min(1.0, firework.timer / 80);
          if (firework.timer % 15 === 0) {
            audioEngine.triggerChime(0.4 + (firework.timer / 80) * 0.4);
          }
          
          if (firework.timer >= 80) {
            firework.phase = "exploding";
            firework.timer = 0;
            firework.progress = 0;
            
            // 震撼和弦音效爆发
            audioEngine.triggerChime(1.0);
            setTimeout(() => audioEngine.triggerChime(0.92), 100);
            setTimeout(() => audioEngine.triggerChime(0.85), 200);
            setTimeout(() => audioEngine.triggerChime(0.78), 300);

            // 粒子向前爆开
            for (let i = 0; i < particles.length; i++) {
              const p = particles[i];
              const angle = (i / particles.length) * Math.PI * 2 * 3.1415 + (Math.random() - 0.5) * 1.8;
              const speed = (3.0 + Math.random() * 9.0) * (p.mass || 1.0);
              p.vx = Math.cos(angle) * speed;
              p.vy = Math.sin(angle) * speed;
              
              p.hue = Math.floor(Math.random() * 360);
              p.saturation = 95;
              p.brightness = 95;
              p.alpha = 1.0;
            }
          }
        } else if (firework.phase === "exploding") {
          firework.progress = Math.min(1.0, firework.timer / 120);
          if (firework.timer >= 120) {
            firework.phase = "returning";
            firework.timer = 0;
            firework.progress = 0;
          }
        } else if (firework.phase === "returning") {
          firework.progress = Math.min(1.0, firework.timer / 60);
          if (firework.timer >= 60) {
            firework.phase = "idle";
            firework.timer = 0;
            firework.progress = 0;
          }
        }
      }

      // 整体和熙色调平滑偏移 (以 0~360 进行包裹，保持完美的相对色彩关系与无缝色彩周期)
      const globalShift = (currentHueShift.current % 360 + 360) % 360;

      // 提取实时麦克风拾音信号
      let micLevel = 0;
      let micLowFreqLevel = 0;
      if (isMicEnabled && micAnalyserRef.current) {
        const bufferLength = micAnalyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        micAnalyserRef.current.getByteFrequencyData(dataArray);

        let total = 0;
        let lowFreqTotal = 0;
        const lowFreqBoundary = Math.max(1, Math.floor(bufferLength * 0.15));
        for (let j = 0; j < bufferLength; j++) {
          total += dataArray[j];
          if (j < lowFreqBoundary) {
            lowFreqTotal += dataArray[j];
          }
        }
        micLevel = (total / bufferLength) / 255;
        micLowFreqLevel = (lowFreqTotal / lowFreqBoundary) / 255;
      }

      // 5 组独立植物花瓣分桶 + 雨滴分桶 + 飞花分桶 + 基础金砂分桶 + 5 层曼达拉分桶 + 8 组烟花多彩分桶
      const seedBuckets: Particle[][] = Array.from({ length: 5 }, () => []);
      const rainBuckets: Particle[] = [];
      const waveBuckets: Particle[] = [];
      const goldBuckets: Particle[] = [];
      const mandalaBuckets: Particle[][] = Array.from({ length: 5 }, () => []);
      const fireworkBuckets: Particle[][] = Array.from({ length: 8 }, () => []);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        if (firework.phase === "aggregating") {
          // 聚合阶段：全屏金粒徐徐拖拽成螺旋黑洞星系
          const dx = firework.cx - p.x;
          const dy = firework.cy - p.y;
          
          const pull = 0.003 * (1.1 + firework.progress * 1.5) * p.mass;
          p.vx += dx * pull;
          p.vy += dy * pull;
          
          const swirlAngle = Math.atan2(dy, dx);
          const swirlSpeed = 2.4 * (1.0 - firework.progress * 0.75);
          p.vx += Math.sin(swirlAngle) * swirlSpeed;
          p.vy -= Math.cos(swirlAngle) * swirlSpeed;
          
          p.vx *= 0.82;
          p.vy *= 0.82;
          
          p.hue = damp(p.hue, 42, 4.0, dt);
          p.saturation = damp(p.saturation, 90, 4.0, dt);
          p.brightness = damp(p.brightness, 96, 4.0, dt);
          p.alpha = damp(p.alpha, 0.95, 3.0, dt);
          
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0) p.x += dimensions.width;
          if (p.x > dimensions.width) p.x -= dimensions.width;
          if (p.y < 0) p.y += dimensions.height;
          if (p.y > dimensions.height) p.y -= dimensions.height;

          // 归并在传统的烟花多彩分层
          const zone = Math.floor(p.hue / 45) % 8;
          fireworkBuckets[zone].push(p);
          continue;
        } else if (firework.phase === "exploding") {
          // 狂野爆绽阶段：自由落体结合轻巧微重力
          p.vx *= 0.94;
          p.vy *= 0.94;
          p.vy += 0.045;
          
          p.x += p.vx;
          p.y += p.vy;
          
          p.alpha = Math.max(0.01, p.alpha * 0.965);

          // 归并在传统的烟花多彩分层
          const zone = Math.floor(p.hue / 45) % 8;
          fireworkBuckets[zone].push(p);
          continue;
        }

        if (p.isWhite) {
          // 1. 让白色粒子在光晕页面自然地漂浮
          const flow = getCurlNoise(p.x, p.y, tVal + p.petalIndex * 0.1);
          // 温和的随波逐流
          p.ax = flow.x * 0.45;
          p.ay = flow.y * 0.45 - 0.02; // 微弱的上升气流

          // 加上一点随机的小漂浮扰动，使其动作更古朴、质朴自然
          p.vx += (Math.random() - 0.5) * 0.12;
          p.vy += (Math.random() - 0.5) * 0.12;

          // 2. 它可以被光标驱散或者跟随光标，可以有一些和光标的交互
          if (isFocusActive) {
            const dx = p.x - focusX;
            const dy = p.y - focusY;
            const dist = Math.hypot(dx, dy);
            if (dist < 260 && dist > 5) {
              const factor = (1.0 - dist / 260);
              const isAlternate = (p.petalIndex % 3 === 0);
              if (isAlternate) {
                // 跟随光标：向光标位置拉扯并在外侧形成环绕
                const pullStr = factor * 2.5;
                p.ax += (-dx / dist) * pullStr;
                p.ay += (-dy / dist) * pullStr;

                // 增加螺旋轨道运动
                p.vx += (-dy / dist) * factor * 0.85;
                p.vy += (dx / dist) * factor * 0.85;
              } else {
                // 驱散：被光标大范围地推开
                const dispelStr = factor * 6.2;
                p.ax += (dx / dist) * dispelStr;
                p.ay += (dy / dist) * dispelStr;
              }
            }
          }

          // D. 在有涟漪点击时，白色粒子也应承受轻质冲击扩散
          ripplesRef.current.forEach(r => {
            const dx = p.x - r.x;
            const dy = p.y - r.y;
            const dist = Math.hypot(dx, dy);
            const ringWidth = r.isClick ? 75 : 55;
            const distFromWavefront = Math.abs(dist - r.radius);

            if (dist > 0 && distFromWavefront < ringWidth) {
              const pulseIntensity = (1.0 - distFromWavefront / ringWidth) * r.life;
              if (pulseIntensity > 0) {
                const force = pulseIntensity * r.strength * 1.5;
                const angle = Math.atan2(dy, dx);
                p.vx += Math.cos(angle) * force * 0.42;
                p.vy += Math.sin(angle) * force * 0.42;
              }
            }
          });

          // 3. 不要变成彩色，让它自己沿着自己的逻辑去和光标进行互动
          p.hue = 0;
          p.saturation = 0;

          if (!isOpen) {
            // 合眼入定：温柔下降并平息
            p.ay += 1.4;
            p.ax *= 0.5;
          } else {
            p.brightness = damp(p.brightness, 95, 2.0, dt);
            // 微微起伏半透明度
            const targetA = 0.22 + Math.sin(tVal * 0.002 + p.petalIndex) * 0.12;
            p.alpha = damp(p.alpha, targetA, 1.5, dt);
          }

          // 常规动力学 Euler
          p.vx += p.ax / p.mass;
          p.vy += p.ay / p.mass;
          p.vx *= p.friction * 0.98;
          p.vy *= p.friction * 0.98;
          p.x += p.vx;
          p.y += p.vy;

          // 边缘包裹
          if (p.x < -20) p.x = dimensions.width + 10;
          if (p.x > dimensions.width + 20) p.x = -10;
          if (p.y < -20) {
            p.y = dimensions.height + 10;
            p.x = Math.random() * dimensions.width;
          }
          if (p.y > dimensions.height + 20) {
            p.y = -10;
            p.x = Math.random() * dimensions.width;
          }

          goldBuckets.push(p);
          continue;
        }

        const pVal = currentMandalaProgress.current;
        let orderFactor = Math.min(1.0, pVal);
        if (pVal > 5.0) {
          orderFactor = Math.max(0.0, 1.0 - (pVal - 5.0)); // 5.0 到 6.0 随继续向上滚动而完美解体消散
        }

        // 追踪点击气浪在微观层面对曼陀罗归心引力的松绑
        let clickForceActive = false;
        let clickForceIntensity = 0;

        // A. 精微分形 CurlNoise 风力场 (随着曼达拉守序度提升，风场与混乱噪声相应骤减，流沙自动归集极规)
        // 增加静止状态对物理噪声的整肃效应 (静止时噪声几乎完全隐遁，剧摆时风卷尘沙风力加倍)
        // 对于悬停在繁花内的流沙，随着悬停静止度变深，其风力扰动将极大隐退，呈现清晰实线纹理
        let particleSeedStillness = 0;
        if (p.bloomSeedId !== null) {
          particleSeedStillness = seedStillnessRef.current[p.bloomSeedId] || 0;
        }

        const flow = getCurlNoise(p.x, p.y, tVal);
        const noiseStrength = 2.9 * (1.0 - orderFactor * 0.95) * (1.0 - currentStillnessRef.current * 0.96) * (1.0 - particleSeedStillness * 0.95) + currentSwingRef.current * 4.8;
        p.ax = flow.x * noiseStrength;
        p.ay = flow.y * noiseStrength;

        // 麦克风多频拾音动力学：高频微颤与低频/节奏空间正弦扩散涟漪
        if (isMicEnabled) {
          // 1. 低频/节奏：空间圆环正弦涟漪向外无极扩散 (利用 dist 和时间 tVal 计算出连续荡漾开去的完美波纹)
          if (micLowFreqLevel > 0.015) {
            const cx = dimensions.width / 2;
            const cy = dimensions.height / 2;
            const rdx = p.x - cx;
            const rdy = p.y - cy;
            const dist = Math.hypot(rdx, rdy);
            if (dist > 10) {
              const ripplePulse = Math.sin(dist * 0.045 - tVal * 0.28) * micLowFreqLevel * 5.5;
              p.ax += (rdx / dist) * ripplePulse * 18.0;
              p.ay += (rdy / dist) * ripplePulse * 18.0;
            }
          }
          // 2. 全频振幅：高频微沙振动物理，让线条或星夜散沙在声音中呈现细腻、极其逼真的“呼吸微颤”质感
          if (micLevel > 0.01) {
            const jitterStrength = micLevel * 5.2 * (Math.random() - 0.5) * p.mass;
            p.vx += jitterStrength;
            p.vy += jitterStrength;
          }
        }

        // A_2. 文字粒子“伊甸流沙”开屏定格及散开自然融合动效 (满足需求 5 & 优化)
        if (i < particleCount * 0.45) {
          // 初始逐步淡入文字，并使其比未交互前略显高透莹烁
          if (p.alpha < p.targetAlpha) {
            p.alpha = damp(p.alpha, p.targetAlpha, 2.5, dt);
          }

          if (textDissolveProgress.current < 1.0) {
            const attractStrength = 0.16 * (1.0 - textDissolveProgress.current);
            p.vx += (p.baseX - p.x) * attractStrength;
            p.vy += (p.baseY - p.y) * attractStrength;
          }
        }

        // B. 吸引与引力漩涡机制 (引意念为水，手势蓄能，随曼达拉成型温和消融)
        if (isFocusActive) {
          const dx = focusX - p.x;
          const dy = focusY - p.y;
          const distToCursor = Math.hypot(dx, dy);

          if (distToCursor < 320 && distToCursor > 10) {
            // 如果是食指专门控制光标状态，赋予更明显的吸引物理强度，复刻鼠标经过时的效果
            const boost = isIndexOnly ? 1.6 : 1.0;
            const pullFactor = (1.0 - distToCursor / 320) * (isSmiling ? 1.9 : 0.8) * (1.0 - orderFactor * 0.88) * boost;
            
            // 吸引拉扯力
            p.ax += (dx / distToCursor) * pullFactor * 4.5;
            p.ay += (dy / distToCursor) * pullFactor * 4.5;

            // 切线自旋漩涡力 (增加动能深度)
            const angle = Math.atan2(dy, dx);
            const swirlDirection = (p.petalIndex % 2 === 0 ? 1 : -1);
            p.vx += Math.sin(angle) * pullFactor * 1.35 * swirlDirection;
            p.vy -= Math.cos(angle) * pullFactor * 1.35 * swirlDirection;
          }
        }

        // C. 闭眼/入定：春雨垂直淘洗物理 (降噪并重置，也对曼达拉有自然剥落效能)
        if (!isOpen) {
          p.ay += 2.6 * (1.0 - orderFactor * 0.4);
          p.ax *= 0.4;
          
          p.hue = damp(p.hue, 202, 3.5, dt); // 四周深翠雨汽
          p.saturation = damp(p.saturation, 62, 3.5, dt);
          p.alpha = damp(p.alpha, 0.42, 2.5, dt);
        } else {
          // 慢速还原为温润纯白沙
          p.hue = damp(p.hue, 0, 1.4, dt);
          p.saturation = damp(p.saturation, 0, 1.4, dt);
          p.brightness = damp(p.brightness, 95, 1.4, dt);
          p.alpha = damp(p.alpha, p.targetAlpha, 1.0, dt);
        }

        // D. 眨眼爆发的星波冲击力 (或鼠标/手势点击引起的大涟漪冲击)
        ripplesRef.current.forEach(r => {
          const dx = p.x - r.x;
          const dy = p.y - r.y;
          const dist = Math.hypot(dx, dy);
          
          // 涟漪波峰宽度设定为 65px (温润而紧致的球形扩散面)
          const ringWidth = 65;
          const distFromWavefront = Math.abs(dist - r.radius);

          if (dist > 0 && distFromWavefront < ringWidth) {
            const isMandalaMode = currentMandalaProgress.current > 0.08;
            
            // 涟漪波峰位置所受的推力最高，两侧呈平滑双向衰退，形成真实流动的环状波纹
            const pulseIntensity = (1.0 - distFromWavefront / ringWidth) * r.life;
            
            if (pulseIntensity > 0) {
              const clickForceMultiplier = r.isClick ? (isMandalaMode ? 1.8 : 1.5) : 1.0;
              const orderSuppression = r.isClick ? 0.05 : 0.85; 

              const force = pulseIntensity * r.strength * (1.0 - orderFactor * orderSuppression) * clickForceMultiplier;
              const angle = Math.atan2(dy, dx);
              
              // 轻轻外推，使微观层面仍能完美看出并保留曼陀罗的本体几何形状
              p.vx += Math.cos(angle) * force * 0.45;
              p.vy += Math.sin(angle) * force * 0.45;
              
              if (r.isClick) {
                clickForceActive = true;
                clickForceIntensity = Math.max(clickForceIntensity, pulseIntensity);
              }

              // 快速而极其顺滑地渲染出耀金星芒，并且在点击中心时渲染出斑斓极光色彩
              const targetH = r.isClick ? (isMandalaMode ? 190 : 46) : 46; // 曼达拉点击呈深邃灵气翠蓝/琥珀金交融
              p.hue = damp(p.hue, targetH, r.isClick ? 13.0 : 9.0, dt);
              p.saturation = damp(p.saturation, r.isClick ? 92 : 82, 9.0, dt);
              p.brightness = damp(p.brightness, 96, 9.0, dt);
              p.alpha = damp(p.alpha, 0.88, 9.0, dt);
            }
          }
        });

        // E. 蝴蝶大狂澜推进 (只在守序曼达拉未完全合一前掀开)
        nextWaves.forEach(w => {
          const waveX = w.startX + w.direction * w.progress * dimensions.width;
          const dx = p.x - waveX;
          
          if (Math.abs(dx) < 260) {
            const distRatio = (1.0 - Math.abs(dx) / 260) * (1.0 - orderFactor * 0.9);
            const waveYOffset = Math.sin(p.x * 0.013 + w.progress * Math.PI * 4.5) * 130.0;
            const targetY = w.startY + waveYOffset;
            
            p.vy += (targetY - p.y) * 0.14 * distRatio;
            p.vx += w.direction * w.speed * 0.22 * distRatio;
            
            // 交替呈现温润紫藤、舒温落樱
            if (p.petalIndex % 2 === 0) {
              p.hue = damp(p.hue, 335, 4.2, dt);
              p.saturation = damp(p.saturation, 78, 4.2, dt);
            } else {
              p.hue = damp(p.hue, 276, 4.2, dt);
              p.saturation = damp(p.saturation, 78, 4.2, dt);
            }
            p.brightness = damp(p.brightness, 88, 4.2, dt);
            p.alpha = damp(p.alpha, 0.72, 3.2, dt);
          }
        });

        // F. teamLab 繁花织锦：极坐标锚位 (5色严格限定) 与点击消散极轻烟雾机制
        let inFlowerField = false;

        let isCurrentlyDispersing = false;
        let dispersingSeedId = -1;
        if (p.bloomSeedId !== null && dispersedSeedsRef.current[p.bloomSeedId]) {
          isCurrentlyDispersing = true;
          dispersingSeedId = p.bloomSeedId;
        }

        if (isCurrentlyDispersing) {
          inFlowerField = true;
          const seed = updatedSeeds[dispersingSeedId];
          const offset = seedOffsetsRef.current[seed.id] || { x: 0, y: 0 };
          const sx = seed.x * dimensions.width + offset.x;
          const sy = seed.y * dimensions.height + offset.y;
          const rdx = p.x - sx;
          const rdy = p.y - sy;
          const rdist = Math.hypot(rdx, rdy);

          // 1. 不是像线条那样运动，而是慢慢消散在整个空间：给一个微弱向外的放射散开趋势，并随机化
          const spreadAngle = (p.petalIndex / 1000) * Math.PI * 2 + (tVal * 0.002);
          const radialPush = 0.5 + Math.sin(spreadAngle * 3.0) * 0.2;
          p.vx += (rdx / (rdist || 1)) * radialPush * 0.15;
          p.vy += (rdy / (rdist || 1)) * radialPush * 0.15;

          // 2. 带着温和的 Curl Noise 风场
          p.vx += flow.x * 0.18;
          p.vy += flow.y * 0.18;

          // 3. 减小阻尼，使其获得足够的飘逸惯性直到扩散出画面
          p.vx *= 0.985;
          p.vy *= 0.985;

          // 4. 配色体系渐变退晕
          if (seed.id === 0) {
            p.hue = damp(p.hue, 255, 1.5, dt);
            p.saturation = damp(p.saturation, 32, 1.5, dt);
          } else if (seed.id === 1) {
            p.hue = damp(p.hue, 16, 1.5, dt);
            p.saturation = damp(p.saturation, 36, 1.5, dt);
          } else if (seed.id === 2) {
            p.hue = damp(p.hue, 346, 1.5, dt);
            p.saturation = damp(p.saturation, 32, 1.5, dt);
          } else if (seed.id === 3) {
            p.hue = damp(p.hue, 45, 1.5, dt);
            p.saturation = damp(p.saturation, 34, 1.5, dt);
          } else {
            p.hue = damp(p.hue, 170, 1.5, dt);
            p.saturation = damp(p.saturation, 32, 1.5, dt);
          }
          p.brightness = damp(p.brightness, 84, 1.5, dt);

          // 慢慢消散到空间里：根据距离降低 alpha
          const maxDispersalOpacity = 0.38;
          const distanceFade = Math.max(0.001, 1.0 - rdist / (dimensions.width * 0.95));
          p.alpha = damp(p.alpha, maxDispersalOpacity * distanceFade * 0.6, 1.0, dt);

        } else {
          for (let j = 0; j < updatedSeeds.length; j++) {
            const seed = updatedSeeds[j];
            if (seed.bloomProgress === 0) continue;
            
            // 如果该种子已被点击消散，则暂时屏蔽吸纳新粒子的过程
            if (dispersedSeedsRef.current[seed.id]) continue;

            const offset = seedOffsetsRef.current[seed.id] || { x: 0, y: 0 };
            const sx = seed.x * dimensions.width + offset.x;
            const sy = seed.y * dimensions.height + offset.y;
            const distToCenter = Math.hypot(p.x - sx, p.y - sy);

            if (distToCenter < 280) {
              inFlowerField = true;
              p.bloomSeedId = seed.id;
              
              const theta = (p.petalIndex / 1000) * Math.PI * 2 + (tVal * 0.003 * (p.petalIndex % 3 === 0 ? 1 : -1));
              const floralPt = getFloralBoundaryPoint(theta, seed.bloomProgress, seed.petalCount, seed.id, p.petalIndex);
              
              let targetX = sx + floralPt.x;
              let targetY = sy + floralPt.y;

              // 对繁花各单线条的粒子轮廓进行富有生命流动感的拉扯变形与圆顺微幅膨胀
              const offsetLen = Math.hypot(offset.x, offset.y);
              if (offsetLen > 0.05) {
                const ux = offset.x / offsetLen;
                const uy = offset.y / offsetLen;
                
                // 将原始的花瓣轮廓相对坐标投影至拉动矢量坐标系
                const dotLong = floralPt.x * ux + floralPt.y * uy;
                const dotTrans = -floralPt.x * uy + floralPt.y * ux;
                
                // 在拉合轴向上拉伸，在正交轴向上稍微微幅拉大，保证变形圆润晶莹
                const factorLong = 1.0 + (offsetLen / 45.0) * 0.12;
                const factorTrans = 1.0 + (offsetLen / 45.0) * 0.05;
                
                const stretchedLong = dotLong * factorLong;
                const stretchedTrans = dotTrans * factorTrans;
                
                // 解耦重投影回屏幕 2D 坐标系
                targetX = sx + (stretchedLong * ux - stretchedTrans * uy);
                targetY = sy + (stretchedLong * uy + stretchedTrans * ux);
              }

              // 依据各个花朵自己的悬停静息度(sStillness)，增加拉引力并附加极高阻尼，使分子排列形成完全清晰、无噪声、不摇摆飘散的花瓣线条 (类曼达拉逻辑)
              const sStillness = seedStillnessRef.current[seed.id] || 0;
              const pullStrength = Math.pow(seed.bloomProgress, 1.8) * 0.095 * p.mass * (1.0 - orderFactor * 0.9) * (1.0 + sStillness * 1.5);
              
              // 点击重聚过程为了避免边缘粒子在极大坐标差时速度爆炸引发跃变闪烁，限制极化偏移量
              let dxToTarget = targetX - p.x;
              let dyToTarget = targetY - p.y;
              const distToTarget = Math.hypot(dxToTarget, dyToTarget);
              if (distToTarget > 600) {
                dxToTarget = (dxToTarget / distToTarget) * 600;
                dyToTarget = (dyToTarget / distToTarget) * 600;
              }

              p.vx += dxToTarget * pullStrength;
              p.vy += dyToTarget * pullStrength;
              
              const baseDamping = 0.83 + (1.0 - seed.bloomProgress) * 0.11;
              const finalDamping = baseDamping * (1.0 - sStillness * 0.32);
              p.vx *= finalDamping;
              p.vy *= finalDamping;
              
              // 5种繁花色彩温润高度渐变退晕 (紫色、橙色、粉色、黄色、青色极为和谐高透)
              if (seed.id === 0) {
                // 紫色: Orchid Lavender
                p.hue = damp(p.hue, 255, 3.0, dt);
                p.saturation = damp(p.saturation, 32, 3.0, dt);
              } else if (seed.id === 1) {
                // 橙色: Soft Apricot Orange
                p.hue = damp(p.hue, 16, 3.0, dt);
                p.saturation = damp(p.saturation, 36, 3.0, dt);
              } else if (seed.id === 2) {
                // 粉色: Pale Salmon Rose Pink
                p.hue = damp(p.hue, 346, 2.5, dt);
                p.saturation = damp(p.saturation, 32, 2.5, dt);
              } else if (seed.id === 3) {
                // 黄色: Gentle Butter Yellow
                p.hue = damp(p.hue, 45, 3.0, dt);
                p.saturation = damp(p.saturation, 34, 3.0, dt);
              } else {
                // 青色: Water Mint Cyan (seed 4)
                p.hue = damp(p.hue, 170, 3.0, dt);
                p.saturation = damp(p.saturation, 32, 3.0, dt);
              }
              p.brightness = damp(p.brightness, 84, 3.0, dt);
              p.alpha = damp(p.alpha, 0.42 + seed.bloomProgress * 0.38, 1.5, dt);
              break; 
            }
          }
        }

        // F_2. 几何曼达拉归心引力控制 (当滚动解锁时，粒子平滑跃升并在圆盘几何上锚轨)
        if (currentMandalaProgress.current > 0.001) {
          const cx = dimensions.width / 2;
          const cy = dimensions.height / 2;
          
          const k = i % 4000;
          const subset = i % 5;
          const angleFactor = (k / 4000) * Math.PI * 2;

          const pVal = currentMandalaProgress.current;
          let mr = 0;
          let mtheta = 0;

          if (pVal <= 1.0) {
            // 0.0 到 1.0：从散沙有序凝聚到 1 阶基本曼达拉
            const state1 = getMandalaState(1, i, tVal, angleFactor);
            mr = state1.mr;
            mtheta = state1.mtheta;
          } else if (pVal >= 5.0) {
            // 5.0 到 6.0：保持在终极 5 阶图形造型，由 orderFactor / pull 负责控制消散解体
            const state5 = getMandalaState(5, i, tVal, angleFactor);
            mr = state5.mr;
            mtheta = state5.mtheta;
          } else {
            // 1.0 到 5.0：在多重极其精美宏伟的神圣几何形态间丝滑无缝重组与质变
            const lowerStateIdx = Math.max(1, Math.min(4, Math.floor(pVal)));
            const upperStateIdx = Math.max(1, Math.min(5, Math.ceil(pVal)));
            const s1 = getMandalaState(lowerStateIdx, i, tVal, angleFactor);
            const s2 = getMandalaState(upperStateIdx, i, tVal, angleFactor);
            
            const t = pVal - lowerStateIdx;
            // 线性缓动插值外圆半径 (mr)
            mr = (1.0 - t) * s1.mr + t * s2.mr;
            
            // 无极角度无缝平滑混合 (插值法线方位，消除在 180° / 360° 角附近的自转撕裂)
            let diff = s2.mtheta - s1.mtheta;
            diff = Math.atan2(Math.sin(diff), Math.cos(diff));
            mtheta = s1.mtheta + diff * t;
          }
          
          // 顺时针或逆时针旋转：将手势旋转角度(currentHandRotation)无缝叠加进 mtheta 中 (满足需求 7)
          let mx = cx + mr * Math.cos(mtheta + currentHandRotation.current);
          let my = cy + mr * Math.sin(mtheta + currentHandRotation.current);

          // (a) 当手掌在曼陀罗处静止时间长，粒子逐渐趋向形成完全精准规整、不飘散的线条
          // (b) 当摆幅大时，粒子的离散程度越大 (产生随机法线或自旋偏离)
          if (currentSwingRef.current > 0.02) {
            const dispersionRad = currentSwingRef.current * 75.0; // 离散偏斜最多 75 像素
            const scatterAngle = (i * 0.13) + tVal * 0.015;
            mx += Math.cos(scatterAngle) * dispersionRad;
            my += Math.sin(scatterAngle) * dispersionRad;
          }

          const stillnessSqueeze = currentStillnessRef.current;
          let pull = orderFactor * (1.1 + stillnessSqueeze * 0.72); // 静止时把牵引力加强
          
          if (clickForceActive) {
            // 点击中心处的爆发，轻度放松引力绑定，既显涟漪动态，又绝对能留下并看出曼陀罗的本体结构线条排布
            pull *= Math.max(0.62, 1.0 - clickForceIntensity * 0.42);
          }

          p.vx += (mx - p.x) * pull * 0.22;
          p.vy += (my - p.y) * pull * 0.22;
          
          // 在曼达拉完全锁死前维持流沙惯性
          // 当静止时，为了形成规整线条，降低微粒的随机漂移(即增加阻尼)
          const dampingValue = 0.18 + stillnessSqueeze * 0.25; // 阻尼随着静止程度高而增加，最高达 0.43
          p.vx *= (1.0 - pull * dampingValue);
          p.vy *= (1.0 - pull * dampingValue);
          
          // 曼达拉自然过渡五色高度晕染 (降低饱和度使过渡浑然一体)
          let targetHue = 42;
          if (subset === 0) targetHue = 48;       // 黄色
          else if (subset === 1) targetHue = 20;  // 橙色
          else if (subset === 2) targetHue = 336; // 粉色
          else if (subset === 3) targetHue = 268; // 紫色
          else targetHue = 142;                    // 绿色
          
          p.hue = damp(p.hue, targetHue, 3.0, dt);
          p.saturation = damp(p.saturation, 45, 3.0, dt);
          p.alpha = damp(p.alpha, 0.72, 2.0, dt);
        }

        // G. Euler 积分推演
        p.vx += p.ax / p.mass;
        p.vy += p.ay / p.mass;
        p.vx *= p.friction;
        p.vy *= p.friction;
        p.x += p.vx;
        p.y += p.vy;

        // Border bounds wrapping
        let bypassWrap = false;
        if (p.bloomSeedId !== null && dispersedSeedsRef.current[p.bloomSeedId]) {
          bypassWrap = true;
        }

        if (!bypassWrap) {
          if (p.x < -20) p.x = dimensions.width + 10;
          if (p.x > dimensions.width + 20) p.x = -10;
          if (p.y < -20) {
            p.y = dimensions.height + 10;
            p.x = Math.random() * dimensions.width;
          }
          if (p.y > dimensions.height + 20) {
            p.y = -10;
            p.x = Math.random() * dimensions.width;
          }
        }

        // H. 分门别类存储进行高性能批渲染绘制 (恢复上一个版本，极致鲜艳、清晰、非模糊)
        if (!isOpen) {
          rainBuckets.push(p);
        } else if (currentMandalaProgress.current > 0.08) {
          const subset = i % 5;
          mandalaBuckets[subset].push(p);
        } else if (inFlowerField && p.bloomSeedId !== null) {
          seedBuckets[p.bloomSeedId].push(p);
        } else if (p.hue > 260 && p.hue < 300) {
          waveBuckets.push(p);
        } else {
          goldBuckets.push(p);
        }
      }

      // 执行高性能集中填块绘制
      const drawBucket = (bucket: Particle[], fillStyleStr: string) => {
        if (bucket.length === 0) return;
        ctx.fillStyle = fillStyleStr;
        for (let idx = 0; idx < bucket.length; idx++) {
          const bp = bucket[idx];
          ctx.fillRect(bp.x, bp.y, bp.size, bp.size);
        }
      };

      // 0. 种子本源虚像微芒光环 (移到最底层，充当柔润呼吸背景，不影响、不切割上层的花瓣与曼达拉粒子图案)
      if (isOpen) {
        updatedSeeds.forEach(s => {
          const offset = seedOffsetsRef.current[s.id] || { x: 0, y: 0 };
          const sx = s.x * dimensions.width + offset.x;
          const sy = s.y * dimensions.height + offset.y;
          
          ctx.save();
          
          // 计算该种子的独特生命呼吸因子，周期在 3.5s ~ 4s 之间平滑错落
          const breathScale = 1.0 + 0.11 * Math.sin(timestamp * 0.0016 + s.id * 1.57);
          
          const isMandalaMode = currentMandalaProgress.current > 0.08;
          // 在曼达拉模式下使用慢速浮升放大进度 haloHoverProgress；在普通模式下使用 bloomProgress
          const hoverAddition = (isMandalaMode ? (haloHoverProgressRef.current[s.id] || 0) : s.bloomProgress) * 180;
          const glowRadius = (84 + hoverAddition) * breathScale;
          
          // 平移动态拉扯质心，从而应用旋转和比例拉伸，实现柔润的椭圆变形拉扯
          ctx.translate(sx, sy);
          
          const offsetLen = Math.hypot(offset.x, offset.y);
          if (offsetLen > 0.05) {
            const rotAngle = Math.atan2(offset.y, offset.x);
            const stretch = (offsetLen / 45.0) * 0.12; 
            ctx.rotate(rotAngle);
            ctx.scale(1.0 + stretch, 1.0 + stretch * 0.45); // X轴沿拉力方向舒展，Y轴在微弱膨胀，符合“拉扯且微微扩大”的细腻物理
          }
          
          ctx.beginPath();
          const radGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, glowRadius);
          
          let baseH = 45;
          let baseS = 100;
          let baseL = 82;
          if (s.id === 0) { baseH = 255; baseS = 100; baseL = 88; }
          else if (s.id === 1) { baseH = 16; baseS = 100; baseL = 78; }
          else if (s.id === 2) { baseH = 346; baseS = 100; baseL = 86; }
          else if (s.id === 3) { baseH = 45; baseS = 100; baseL = 82; }
          else if (s.id === 4) { baseH = 170; baseS = 56; baseL = 73; }

          const shiftedH = (baseH + globalShift) % 360;
          const hslCol = `hsla(${shiftedH}, ${baseS}%, ${baseL}%, `;

          // 调配轻微明显的中心柔和度，边缘漫化晕开
          radGrad.addColorStop(0, hslCol + "0.28)");
          radGrad.addColorStop(0.35, hslCol + "0.13)");
          radGrad.addColorStop(1, hslCol + "0.00)");
          
          ctx.fillStyle = radGrad;
          ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
          ctx.fill();

          // 同时也为各个核心种子晕染出一个玲珑静美的呼吸核心光斑，带来极佳的视觉定位与生机感
          const coreRadius = (4.0 + Math.sin(timestamp * 0.0022 + s.id * 1.2) * 1.0) * (1.0 + s.bloomProgress * 0.6);
          ctx.beginPath();
          const coreGrad = ctx.createRadialGradient(0, 0, 0.1, 0, 0, coreRadius * 2.8);
          coreGrad.addColorStop(0, hslCol + "0.72)");
          coreGrad.addColorStop(0.35, hslCol + "0.26)");
          coreGrad.addColorStop(1, hslCol + "0.00)");
          ctx.fillStyle = coreGrad;
          ctx.arc(0, 0, coreRadius * 2.8, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        });
      }

      // 0. 烟花彩蛋渲染层
      if (firework.phase === "aggregating" || firework.phase === "exploding") {
        for (let zone = 0; zone < 8; zone++) {
          const baseHue = zone * 45;
          let h = (baseHue + globalShift) % 360;
          let s = 90;
          let l = 78;
          let opacity = 0.88;
          if (firework.phase === "aggregating") {
            h = 42; // 神秘金砂色
            s = 85;
            l = 80;
            opacity = 0.75 + Math.random() * 0.15;
          } else {
            opacity = Math.max(0.01, 1.0 - firework.progress);
          }
          drawBucket(fireworkBuckets[zone], `hsla(${h}, ${s}%, ${l}%, ${opacity * 0.85})`);
        }
      }

      // 1. 晶莹纯细白砂 (保持莹白如雪的基底不变，呈温润剔透质感)
      drawBucket(goldBuckets, isOpen ? "rgba(255, 255, 255, 0.18)" : "rgba(255, 255, 255, 0.28)");
      
      // 2. 指令繁花瓣/几何轮廓 (多彩分层渲染 - 5色物理结构，与全屏移相平滑偏移)
      drawBucket(seedBuckets[0], `hsla(${(255 + globalShift) % 360}, 100%, 87%, 0.65)`); // 紫色 Lavender Wisteria
      drawBucket(seedBuckets[1], `hsla(${(16 + globalShift) % 360}, 100%, 78%, 0.65)`);  // 橙色 Eye of Horus
      drawBucket(seedBuckets[2], `hsla(${(346 + globalShift) % 360}, 100%, 86%, 0.65)`); // 粉色 Infinity Loop
      drawBucket(seedBuckets[3], `hsla(${(45 + globalShift) % 360}, 100%, 82%, 0.65)`);  // 黄色 Cosmic Vortex
      drawBucket(seedBuckets[4], `hsla(${(170 + globalShift) % 360}, 56%, 73%, 0.65)`);  // 青色 Zen Horizon

      // 3. 巨澜和雨露
      drawBucket(waveBuckets, `hsla(${(283 + globalShift) % 360}, 50%, 90%, 0.45)`); 
      drawBucket(rainBuckets, `hsla(${(153 + globalShift) % 360}, 76%, 80%, 0.35)`); 

      // 4. 曼达拉经典图谱集中渲染层 (黄金、亮橘、樱红、瑞紫、翠绿五色高度和谐过渡，高透低饱和，协同色彩周期偏移)
      if (currentMandalaProgress.current > 0.08) {
        drawBucket(mandalaBuckets[0], `hsla(${(48 + globalShift) % 360}, 100%, 76%, 0.72)`);  // 第 1 圈：金黄
        drawBucket(mandalaBuckets[1], `hsla(${(20 + globalShift) % 360}, 100%, 70%, 0.72)`);  // 第 2 圈：暖橘
        drawBucket(mandalaBuckets[2], `hsla(${(336 + globalShift) % 360}, 100%, 81%, 0.75)`); // 第 3 圈：樱粉
        drawBucket(mandalaBuckets[3], `hsla(${(268 + globalShift) % 360}, 100%, 82%, 0.72)`); // 第 4 圈：瑞紫
        drawBucket(mandalaBuckets[4], `hsla(${(142 + globalShift) % 360}, 100%, 73%, 0.68)`); // 第 5 圈：翠绿
      }



      // 8. 星芒视线引力源圈环 (Gaze cursor)
      if (isFocusActive && isOpen) {
        ctx.save();
        if (isIndexOnly) {
          // 只出现食指时的梦幻金徽光标：金色双环配合微光散发
          ctx.beginPath();
          ctx.arc(focusX, focusY, 8.0, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 215, 0, 0.85)"; // 璀璨星徽金
          ctx.shadowColor = "rgba(255, 170, 0, 0.95)";
          ctx.shadowBlur = 18;
          ctx.fill();

          ctx.beginPath();
          const outerBreath = 20 + Math.sin(timestamp * 0.006) * 3;
          ctx.strokeStyle = "rgba(255, 215, 0, 0.50)";
          ctx.lineWidth = 1.5;
          ctx.arc(focusX, focusY, outerBreath, 0, Math.PI * 2);
          ctx.stroke();

          ctx.beginPath();
          ctx.strokeStyle = "rgba(255, 240, 180, 0.20)";
          ctx.lineWidth = 3.0;
          ctx.arc(focusX, focusY, outerBreath + 8, 0, Math.PI * 2);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(focusX, focusY, 6.2, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(255, 255, 255, 0.68)";
          ctx.shadowColor = "#F9F9F9";
          ctx.shadowBlur = 14;
          ctx.fill();

          ctx.beginPath();
          const outerBreath = 16 + Math.sin(timestamp * 0.005) * 2;
          ctx.strokeStyle = "rgba(224, 224, 224, 0.55)";
          ctx.lineWidth = 1.0;
          ctx.arc(focusX, focusY, outerBreath, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.restore();
      }

      animId = requestAnimationFrame(frameStep);
    };

    animId = requestAnimationFrame(frameStep);
    return () => cancelAnimationFrame(animId);
  }, [dimensions, isOpen, gazePoint, seeds, waves, useMouseMode, isSmiling, isDarkNightMode, isGesture8, isHandDetected, isIndexOnly]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full overflow-hidden"
      id="canvas-container"
    >
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUpOrLeave}
        onClick={handleCanvasClick}
        className="block w-full h-full cursor-crosshair animate-fade-in"
        id="fluid-art-canvas"
      />
    </div>
  );
};
