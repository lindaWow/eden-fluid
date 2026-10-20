/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 植物种子状态类型 (teamLab 风格)
export interface FlowSeed {
  id: number;
  x: number; // 标量比率 [0, 1]
  y: number; // 标量比率 [0, 1]
  radius: number; // 影响范围系数
  bloomProgress: number; // 绽放进度 0-1 (视线聚焦 1.5s 后满)
  active: boolean; // 是否处于聚焦状态
  name: string; // 花卉名称 (紫藤, 山茶, 晚樱)
  color: string; // 代表颜色
  petalCount: number; // 花瓣数量 (参数化数学曲线)
}

// 蝴蝶流体激流类型 (Anadol 风格)
export interface FluidWave {
  id: number;
  progress: number; // 0 到 1
  startX: number;
  startY: number;
  direction: number; // 1 = 从左到右, -1 = 从右到左
  speed: number;
  particlesGenerated: boolean;
  color: { r: number; g: number; b: number };
}

// 涟漪圈类型 (眨眼触发)
export interface Ripple {
  id: number;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  strength: number;
  life: number; // 1 到 0
  isClick?: boolean;
}

// 粒子底层物理与渲染状态
export interface Particle {
  x: number; // 当前 Canvas 坐标
  y: number;
  baseX: number; // 基础漂移坐标
  baseY: number;
  vx: number; // 速度
  vy: number;
  ax: number; // 加速度
  ay: number;
  size: number;
  hue: number;
  saturation: number;
  brightness: number;
  alpha: number;
  targetAlpha: number;
  
  // 材质属性
  mass: number;
  friction: number;
  
  // 行为标记
  isBlooming: boolean;
  bloomSeedId: number | null; 
  petalIndex: number;
  petalDistance: number;
  isWhite?: boolean;
}
