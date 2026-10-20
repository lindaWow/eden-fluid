/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from "react";
import { FlowSeed, FluidWave } from "./types";
import { InteractiveCanvas } from "./components/InteractiveCanvas";
import { GestureTracker } from "./components/GestureTracker";
import { audioEngine } from "./utils/audio";
import { 
  Volume2, 
  VolumeX, 
  Camera, 
  MousePointer,
  Video,
  VideoOff,
  Sun,
  Moon,
  Mic,
  MicOff
} from "lucide-react";

export default function App() {
  // 1. 系统核心态: 运行状态 (单层极简)
  const [hasBegun] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false); // 全局开屏流沙动画状态，未交互时保持暗色背景
  const [isDarkNightMode, setIsDarkNightMode] = useState(false); // 暗夜模式切换，true时始终强制保持暗色背景
  const [useMouseMode, setUseMouseMode] = useState(true); // 默认开启鼠标模式作为易用起点
  const [volume, setVolume] = useState(0.5);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [showCameraPreview, setShowCameraPreview] = useState(true); // 摄像头悬浮窗显示控制
  const [isMicEnabled, setIsMicEnabled] = useState(false); // 麦克风拾音开关状态
  
  // 摄像头即时多模态脑电/面部/手势状态
  const [gazePoint, setGazePoint] = useState<{ x: number; y: number } | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [isSmiling, setIsSmiling] = useState(false);
  const [smileScore, setSmileScore] = useState(0.0);
  const [isPinching, setIsPinching] = useState(false);
  const [handAngle, setHandAngle] = useState(-Math.PI / 2);
  const [isGesture8, setIsGesture8] = useState(false);
  const [isHandDetected, setIsHandDetected] = useState(false);
  const [isIndexOnly, setIsIndexOnly] = useState(false);
  const [rightHandPoint, setRightHandPoint] = useState<{ x: number; y: number } | null>(null);
  const [isRightHandDetected, setIsRightHandDetected] = useState(false);
  const [gazeFocusId, setGazeFocusId] = useState<number | null>(null);

  // 鼠标模拟眼动流
  const [, setMousePoint] = useState<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  
  // HUD 动态诊断
  const [, setTrackerDiag] = useState<{
    cameraState: "idle" | "loading" | "active" | "denied";
    faceDetected: boolean;
    fps: number;
  }>({
    cameraState: "idle",
    faceDetected: false,
    fps: 0,
  });
  
  // HUD 动态时钟微动
  const [eqTime, setEqTime] = useState(0);

  // 2. 交互 Tips 循环状态 (空灵轻盈、有呼吸感)
  const [currentTipIndex, setCurrentTipIndex] = useState(0);
  const tips = [
    "试一试在镜头前左右挥动双手",
    "试一试在镜头前上下挥动双手",
    "试一试将食指和大拇指进行贴合捏合",
    "试一试张开手掌并在空中进行自旋",
    "试一试在镜头前合拢手指、捏紧拳头",
    "试一试把紧握的拳头重新大方舒展开",
    "试一试在屏幕前展露温柔微笑",
    "也可用鼠标对画面进行点击、拖拽或滚动"
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTipIndex(prev => (prev + 1) % tips.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [tips.length]);

  // 3. teamLab 禅意几何与本源种子配置 (唯美和谐渐变)
  const [seeds, setSeeds] = useState<FlowSeed[]>([
    {
      id: 0,
      x: 0.18,
      y: 0.45,
      radius: 250,
      bloomProgress: 0.0,
      active: false,
      name: "藤萝 · Purple Wisteria",
      color: "#CEBEFF", // Gentle Lavender Purple
      petalCount: 9,
    },
    {
      id: 1,
      x: 0.36,
      y: 0.25,
      radius: 250,
      bloomProgress: 0.0,
      active: false,
      name: "橘葵 · Apricot Camellia",
      color: "#FFAE8F", // Soft Apricot Orange / Gold
      petalCount: 5,
    },
    {
      id: 2,
      x: 0.82,
      y: 0.48,
      radius: 250,
      bloomProgress: 0.0,
      active: false,
      name: "晚樱 · Pale Cherry Blossom",
      color: "#FFB8C6", // Pale Rose Pink
      petalCount: 5,
    },
    {
      id: 3,
      x: 0.50,
      y: 0.78,
      radius: 250,
      bloomProgress: 0.0,
      active: false,
      name: "明葵 · Butter Sunflower",
      color: "#FFE8A3", // Gentle Butter Yellow
      petalCount: 12,
    },
    {
      id: 4,
      x: 0.65,
      y: 0.28,
      radius: 250,
      bloomProgress: 0.0,
      active: false,
      name: "织锦 · Water Mallow",
      color: "#91E3D5", // Water Mint Cyan
      petalCount: 8,
    }
  ]);

  // 4. Anadol 蝴蝶激流脉冲配置
  const [waves, setWaves] = useState<FluidWave[]>([]);
  const lastSmileStateRef = useRef(false);

  // 立即初始化及自动播放背景音乐（不依赖额外交互），同时保留点击作为后备浏览器安全启动机制
  useEffect(() => {
    try {
      audioEngine.init();
      audioEngine.setVolume(volume);
    } catch (e) {
      console.warn("Audio instant mount init skipped, waiting for backup click:", e);
    }
  }, []);

  // 增加全局交互以解除浏览器音频自动播放限制并确保唤醒及文字散去
  useEffect(() => {
    const handleInitialClick = () => {
      try {
        audioEngine.init();
        audioEngine.setVolume(volume);
        setHasInteracted(true);
        audioEngine.setHasInteracted(true);
      } catch (e) {
        console.warn("Audio early init failed:", e);
      }
      window.removeEventListener("click", handleInitialClick);
    };
    window.addEventListener("click", handleInitialClick);
    return () => window.removeEventListener("click", handleInitialClick);
  }, [volume]);

  // 监听手势开合 (拳头张开或握紧，表现为 isOpen 状态改变)
  const prevIsOpenRef = useRef(true);
  useEffect(() => {
    if (!hasInteracted) {
      if (isOpen !== prevIsOpenRef.current) {
        setHasInteracted(true);
        audioEngine.setHasInteracted(true);
        audioEngine.setOpenState(isOpen);
      }
    } else {
      if (isOpen !== prevIsOpenRef.current) {
        audioEngine.setOpenState(isOpen);
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, hasInteracted]);

  // 音频静音控制
  const handleToggleMute = () => {
    const nextMuted = !isAudioMuted;
    setIsAudioMuted(nextMuted);
    if (nextMuted) {
      audioEngine.setVolume(0);
    } else {
      audioEngine.setVolume(volume);
    }
  };

  // 音量调整
  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    if (!isAudioMuted) {
      audioEngine.setVolume(newVol);
    }
  };

  // 接收来自 GestureTracker 双重检测算法的回调
  const handleTrackingData = (data: {
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
  }) => {
    setGazePoint(data.gazePoint);
    setIsOpen(data.isOpen);
    setSmileScore(data.smileScore);
    setIsPinching(data.isPinching);
    setHandAngle(data.handAngle);
    setIsGesture8(!!data.isGesture8);
    setIsHandDetected(!!data.handDetected);
    setIsIndexOnly(!!data.isIndexOnly);
    setRightHandPoint(data.rightHandPoint || null);
    setIsRightHandDetected(!!data.isRightHandDetected);

    setTrackerDiag({
      cameraState: data.cameraState,
      faceDetected: data.faceDetected,
      fps: data.fps
    });

    // 当微笑或手指舒张从 false 跃升为 true 时，立即触发风铃声，并涌起惊澜蝴蝶流波
    if (data.isSmiling && !lastSmileStateRef.current) {
      setIsSmiling(true);
      audioEngine.triggerChime(data.smileScore || 0.85);

      const newWaveLeft: FluidWave = {
        id: Date.now(),
        progress: 0.0,
        startX: 0,
        startY: 120 + Math.random() * 480,
        direction: 1.0,
        speed: 0.62,
        particlesGenerated: false,
        color: { r: 248, g: 187, b: 208 } // 樱粉桃色
      };

      const newWaveRight: FluidWave = {
        id: Date.now() + 1,
        progress: 0.0,
        startX: window.innerWidth,
        startY: 180 + Math.random() * 420,
        direction: -1.0,
        speed: 0.62,
        particlesGenerated: false,
        color: { r: 224, g: 190, b: 231 } // 丁香紫蓝
      };

      setWaves(prev => [...prev, newWaveLeft, newWaveRight]);
    } else if (!data.isSmiling) {
      setIsSmiling(false);
    }

    lastSmileStateRef.current = data.isSmiling;
  };

  // 视线焦点计算
  useEffect(() => {
    if (!gazePoint && useMouseMode) return;
    if (!gazePoint) {
      setGazeFocusId(null);
      return;
    }

    let minDistance = 280;
    let closestId: number | null = null;

    seeds.forEach(s => {
      const distance = Math.hypot(gazePoint.x - s.x, gazePoint.y - s.y);
      if (distance < 0.24 && distance < minDistance) {
        closestId = s.id;
      }
    });

    setGazeFocusId(closestId);
  }, [gazePoint, seeds, useMouseMode]);

  // 注销全周期音频
  useEffect(() => {
    return () => {
      audioEngine.dispose();
    };
  }, []);

  // 画面同步波动计时
  useEffect(() => {
    let handle: any;
    if (hasBegun) {
      handle = setInterval(() => {
        setEqTime(t => t + 1);
      }, 100);
    }
    return () => clearInterval(handle);
  }, [hasBegun]);

  const activeFlora = seeds.find(s => s.bloomProgress > 0.02);
  const isDarkThemeActive = isDarkNightMode || !(hasInteracted && isOpen);

  const handleScreenMouseMove = (e: any) => {
    if (useMouseMode) {
      const x = Number((e.clientX / window.innerWidth).toFixed(3));
      const y = Number((e.clientY / window.innerHeight).toFixed(3));
      setMousePoint({ x, y });
    }
  };

  return (
    <div 
      onMouseMove={handleScreenMouseMove}
      className={`relative w-full h-screen overflow-hidden font-sans select-none transition-colors duration-1000 ${
        isDarkThemeActive ? "bg-[#040706] text-[#E0F2F1]" : "bg-neutral-100 text-neutral-800"
      }`} 
      id="eden-main-viewport"
    >
      
      {/* 渐变流线背景深浅屏慢 LERP 结合层 */}
      <div 
        className="absolute inset-0 z-0 select-none pointer-events-none transition-all duration-1000 overflow-hidden" 
        style={{
          background: !isDarkThemeActive 
            ? "radial-gradient(circle at 35% 25%, var(--mint) 0%, transparent 60%), radial-gradient(circle at 75% 75%, var(--sage) 0%, transparent 60%), radial-gradient(circle at 50% 50%, #FAF9F6 0%, 100%)"
            : "radial-gradient(circle at 35% 25%, #050a08 0%, transparent 65%), radial-gradient(circle at 75% 75%, #090f0d 0%, transparent 65%), radial-gradient(circle at 50% 50%, #030504 0%, 100%)"
        }}
      >
        {/* 数字高级感菲林颗粒 */}
        <div className="grain absolute inset-0 opacity-[0.038] mix-blend-overlay"></div>
        
        {/* teamLab 意象柔光核 */}
        <div className={`absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 w-[560px] h-[560px] blur-[75px] transition-all duration-1000 ${
          activeFlora ? "scale-110 opacity-45" : "scale-100 opacity-22"
        }`}>
          <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#F8BBD0]/40 to-[#E1BEE7]/40 scale-110 animate-pulse"></div>
          <div className="absolute inset-0 rounded-full bg-gradient-to-bl from-white/20 to-transparent scale-90 rotate-45"></div>
        </div>

        {/* 东方美学正弦写意极轻量曲线 */}
        <div className="absolute inset-0 flex items-center justify-center opacity-[0.22] mix-blend-overlay">
          <svg width="840" height="600" viewBox="0 0 800 600" className="w-[88vw] h-[66vh] transition-transform duration-[2000ms]" style={{ transform: `rotate(${isSmiling ? 3.5 : 0}deg) scale(${isOpen ? 1 : 0.94})` }}>
            <path d="M100,300 C150,110 350,90 400,300 C450,510 650,490 700,300" fill="none" stroke={isDarkThemeActive ? "#A7F3D0" : "#E5E7EB"} strokeWidth="0.5" />
            <path d="M100,320 C150,130 350,110 400,320 C450,530 650,510 700,320" fill="none" stroke="#F8BBD0" strokeWidth="0.5" opacity="0.5" />
            <path d="M100,280 C150,90 350,70 400,280 C450,470 650,450 700,280" fill="none" stroke="#E1BEE7" strokeWidth="0.5" opacity="0.5" />
          </svg>
        </div>
      </div>

      {/* 中心交互环扣靶标 (眼动中心轻度指引，极其低调不占眼球) */}
      <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 transition-all duration-1000 flex flex-col items-center select-none opacity-30">
        <div 
          className={`w-48 h-48 border rounded-full flex items-center justify-center transition-all duration-1000 ${
            isDarkThemeActive ? "border-[#A7F3D0]/10 bg-white/[0.003]" : "border-black/[0.03] bg-black/[0.003]"
          }`} 
          style={{ transform: `scale(${isSmiling ? 1.06 : 1.0}) rotate(${eqTime * 1.2}deg)` }}
        >
          <div className={`w-1 h-1 rounded-full transition-colors duration-1000 ${isDarkThemeActive ? "bg-[#A7F3D0]/20" : "bg-black/20"}`}></div>
          
          <div className={`absolute -top-1 left-1/2 -translate-x-1/2 w-[0.8px] h-3 transition-colors duration-1000 ${isDarkThemeActive ? "bg-[#A7F3D0]/20" : "bg-black/20"}`}></div>
          <div className={`absolute -bottom-1 left-1/2 -translate-x-1/2 w-[0.8px] h-3 transition-colors duration-1000 ${isDarkThemeActive ? "bg-[#A7F3D0]/20" : "bg-black/20"}`}></div>
          <div className={`absolute top-1/2 -left-1 -translate-y-1/2 w-3 h-[0.8px] transition-colors duration-1000 ${isDarkThemeActive ? "bg-[#A7F3D0]/20" : "bg-black/20"}`}></div>
          <div className={`absolute top-1/2 -right-1 -translate-y-1/2 w-3 h-[0.8px] transition-colors duration-1000 ${isDarkThemeActive ? "bg-[#A7F3D0]/20" : "bg-black/20"}`}></div>
          
          <div 
            className={`absolute w-20 h-20 border rounded-full border-dashed transition-all duration-1000 ${
              isDarkThemeActive ? "border-[#A7F3D0]/10" : "border-black/[0.02]"
            }`} 
            style={{ transform: `rotate(${-eqTime * 2}deg)` }}
          />
        </div>
      </div>

      {/* 全屏流沙金与多态繁花画布 */}
      <InteractiveCanvas
        gazePoint={useMouseMode ? null : gazePoint}
        gazeFocusId={gazeFocusId}
        isOpen={isOpen}
        isSmiling={isSmiling}
        smileScore={smileScore}
        useMouseMode={useMouseMode}
        seeds={seeds}
        waves={waves}
        onSeedsUpdate={(updatedSeeds) => setSeeds(updatedSeeds)}
        onWavesUpdate={(updatedWaves) => setWaves(updatedWaves)}
        isPinching={isPinching}
        handAngle={handAngle}
        hasInteracted={hasInteracted}
        onInteracted={() => setHasInteracted(true)}
        isDarkNightMode={isDarkNightMode}
        isGesture8={isGesture8}
        isHandDetected={isHandDetected}
        isIndexOnly={isIndexOnly}
        rightHandPoint={useMouseMode ? null : rightHandPoint}
        isRightHandDetected={isRightHandDetected}
        isMicEnabled={isMicEnabled}
      />

      {/* 主界面顶栏 - 仅保留中央呼吸交互提示词 */}
      <div 
        className={`absolute top-0 left-0 w-full z-20 p-8 flex items-start justify-center pointer-events-none transition-all duration-1000 ${
          hasBegun ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"
        }`} 
        id="eden-top-interface"
      >
        {/* 顶部中央：极具呼吸感、轻盈、纯粹的交互提示语，缓缓淡入淡出 */}
        <div className="absolute left-1/2 top-9 -translate-x-1/2 hidden md:flex items-center justify-center text-center max-w-2xl pointer-events-auto select-none px-6 py-1.5 rounded-full bg-white/5 dark:bg-black/25 border border-black/[0.03] dark:border-white/5 backdrop-blur-md transition-all duration-700 shadow-sm leading-relaxed">
          <span 
            key={currentTipIndex} 
            className="text-[11px] font-light tracking-[0.12em] text-neutral-500/80 dark:text-stone-300 animate-[pulse_3.5s_infinite] transition-opacity duration-1000"
          >
            {tips[currentTipIndex]}
          </span>
        </div>
      </div>

      {/* 底部功能盘 - 高端至臻半透明毛玻璃气泡槽 */}
      <div 
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex items-center gap-5 px-6 py-2.5 rounded-full border border-white/20 dark:border-white/10 bg-white/10 dark:bg-black/20 backdrop-blur-xl shadow-[0_8px_32px_0_rgba(0,0,0,0.18)] transition-all duration-700 hover:bg-white/15 dark:hover:bg-black/30" 
        id="eden-controls"
      >
        {/* 交互模式轻点切换 */}
        <button
          onClick={() => setUseMouseMode(!useMouseMode)}
          className="p-2.5 rounded-full text-neutral-700 dark:text-neutral-300 hover:bg-white/20 dark:hover:bg-white/10 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          id="select-interaction-mode-btn"
          title={useMouseMode ? "切换为镜头手势追踪" : "切换为鼠标触控模式"}
        >
          {useMouseMode ? <MousePointer size={14} /> : <Camera size={14} />}
        </button>

        {!useMouseMode && (
          <>
            <div className="w-px h-3.5 bg-black/[0.05] dark:bg-white/10" />
            {/* 摄像头的缩略框是否显示开关 */}
            <button
              onClick={() => setShowCameraPreview(!showCameraPreview)}
              className="p-2.5 rounded-full text-neutral-700 dark:text-neutral-300 hover:bg-white/20 dark:hover:bg-white/10 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              id="toggle-camera-preview-btn"
              title={showCameraPreview ? "隐藏摄像头缩略图" : "显示摄像头缩略图"}
            >
              {showCameraPreview ? <Video size={14} /> : <VideoOff size={14} />}
            </button>
          </>
        )}

        <div className="w-px h-3.5 bg-black/[0.05] dark:bg-white/10" />

        {/* 明暗模式切换：明亮模式 (默认，可交互变浅) 和 暗夜模式 (统一保持暗色背景) */}
        <button
          onClick={() => setIsDarkNightMode(!isDarkNightMode)}
          className="p-2.5 rounded-full text-neutral-700 dark:text-neutral-300 hover:bg-white/20 dark:hover:bg-white/10 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center"
          id="toggle-dark-night-mode-btn"
          title={isDarkNightMode ? "已开启暗夜模式，点击切换为明亮模式" : "已开启明亮模式，点击切换为暗夜模式"}
        >
          {isDarkNightMode ? (
            <Moon size={14} className="text-[#A7F3D0]" />
          ) : (
            <Sun size={14} />
          )}
        </button>

        <div className="w-px h-3.5 bg-black/[0.05] dark:bg-white/10" />

        {/* 麦克风极夜律动拾音开关 */}
        <button
          onClick={() => {
            const nextMic = !isMicEnabled;
            setIsMicEnabled(nextMic);
            if (nextMic && !hasInteracted) {
               setHasInteracted(true);
               audioEngine.setHasInteracted(true);
            }
          }}
          className={`p-2.5 rounded-full hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center justify-center ${
            isMicEnabled 
              ? "text-emerald-500 bg-emerald-500/10 border border-emerald-500/10" 
              : "text-neutral-700 dark:text-neutral-300 hover:bg-white/20 dark:hover:bg-white/10"
          }`}
          id="toggle-mic-listening-btn"
          title={isMicEnabled ? "已开启麦克风律动，点击关闭" : "点击开启麦克风律动，听音呈现涟漪震动"}
        >
          {isMicEnabled ? (
            <Mic size={14} className="animate-pulse" />
          ) : (
            <MicOff size={14} />
          )}
        </button>

        <div className="w-px h-3.5 bg-black/[0.05] dark:bg-white/10" />

        {/* 音量控制微推子 */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleMute}
            className="p-2 rounded-full text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white hover:scale-105 active:scale-95 transition-all cursor-pointer"
            id="toggle-mute-button"
          >
            {isAudioMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
          
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
            className="w-20 md:w-28 accent-neutral-600 dark:accent-neutral-300 cursor-pointer h-0.5 rounded bg-black/[0.08] dark:bg-white/10 hover:bg-black/[0.14] dark:hover:bg-white/25 transition-colors"
            id="volume-slider"
          />
        </div>
      </div>

      {/* 非鼠标模式下的摄像头精美流体双骨骼叠加窗 */}
      {!useMouseMode && (
        <div className={`absolute bottom-8 right-8 z-30 pointer-events-auto select-none transition-all duration-300 ${
          showCameraPreview ? "opacity-60 hover:opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none invisible"
        }`}>
          <GestureTracker
            onTrackingData={handleTrackingData}
            active={hasBegun && !useMouseMode}
            showMeshDebug={true}
          />
        </div>
      )}
    </div>
  );
}
