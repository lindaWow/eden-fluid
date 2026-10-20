/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 经典的 1D/2D Perlin Noise 实现，用于生成极其逼真的高档丝绸流场 (Refik Anadol 风格)
class PerlinNoise {
  private p: Uint8Array;

  constructor() {
    this.p = new Uint8Array(512);
    const permutation = new Uint8Array([
      151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
      190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,
      136,171,168, 68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,
      46,245,40,244,102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,135,130,116,188,159,
      86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,
      150,80,22,30,9,58,252,24,144,38,206,120,40,113,81,167,29,187,104,65,51,19,124,144,115,171,40,140,212,18,251,5,
      253,207,24,244,40,144,224,115,188,145,116,103,134,234,208,211,234,149,150,224,81,176,118,122,149,146,80,111,229
    ]);
    for (let i = 0; i < 256; i++) {
      this.p[i] = permutation[i];
      this.p[256 + i] = permutation[i];
    }
  }

  private fade(t: number): number {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 7;
    const u = h < 4 ? x : y;
    const v = h < 4 ? y : x;
    return ((h & 1) ? -u : u) + ((h & 2) ? -2.0 * v : 2.0 * v);
  }

  public noise2D(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    const u = this.fade(xf);
    const v = this.fade(yf);

    const aa = this.p[this.p[X] + Y];
    const ab = this.p[this.p[X] + Y + 1];
    const ba = this.p[this.p[X + 1] + Y];
    const bb = this.p[this.p[X + 1] + Y + 1];

    const x1 = this.lerp(u, this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf));
    const x2 = this.lerp(u, this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1));

    return this.lerp(v, x1, x2);
  }
}

export const perlin = new PerlinNoise();

/**
 * 旋度流场 (Curl Noise) 生成器
 * 根据 Perlin Noise 的偏导数计算正交流向，可保证流体粒子绝不重叠堆积，生成如同真丝、星风般粘稠而顺滑的波动线纹
 */
export function getCurlNoise(x: number, y: number, time: number): { x: number; y: number } {
  // 设置噪声频率比例
  const s = 0.005;
  const t = time * 0.0003;
  
  const nx = x * s;
  const ny = y * s;
  
  const epsilon = 1.0; // 偏导数步长
  
  // 计算势场高度 H(x, y)
  const h = (nx_val: number, ny_val: number) => {
    // 多频噪声叠加，形成精细的多层波动质感
    return (
      perlin.noise2D(nx_val, ny_val + t) * 1.0 +
      perlin.noise2D(nx_val * 2.5, ny_val * 2.5 - t * 1.5) * 0.4 +
      perlin.noise2D(nx_val * 6.0, ny_val * 6.0 + t) * 0.15
    );
  };
  
  // 偏导数求旋度 F_curl = (dH/dy, -dH/dx)
  const dy = (h(nx, ny + epsilon) - h(nx, ny - epsilon)) / (2.0 * epsilon);
  const dx = (h(nx + epsilon, ny) - h(nx - epsilon, ny)) / (2.0 * epsilon);
  
  return {
    x: dy,
    y: -dx
  };
}

/**
 * 二维向量缓动，带物理阻尼和惯性 (LERP 变体)
 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return target + (current - target) * Math.exp(-lambda * dt);
}

/**
 * 参数化数学花瓣曲线 (teamLab 宣纸感数字抽象花卉结构)
 * r = cos(k * theta) 玫瑰线、外摆线与斐波那契螺旋的数字融合。
 * @param theta 极角 (0 ~ 2*PI)
 * @param bloomProgress 绽放进度 (0.0 ~ 1.0)
 * @param petalCount 花瓣数量
 * @param seedId 种子ID，用于区别花卉造型 (紫藤、山茶、晚樱)
 */
export function getFloralBoundaryPoint(
  theta: number,
  bloomProgress: number,
  petalCount: number,
  seedId: number,
  particleIndex?: number
): { x: number; y: number } {
  // 基础半径，所有的种子设定一致的 maxRadius = 145，确保大小极其一致
  const maxRadius = 145; 
  const baseR = maxRadius * Math.pow(bloomProgress, 1.4);
  
  let r = baseR;
  
  if (seedId === 0) {
    // 0. 藤萝 · Purple Wisteria (简约高雅的紫藤单线条花冠)
    const factor = 0.72 + 0.28 * Math.cos(petalCount * theta);
    r = baseR * factor;
    
  } else if (seedId === 1) {
    // 1. 橘葵 · Apricot Camellia (圆润单纯的山茶单线条勾勒)
    const factor = 0.76 + 0.24 * Math.cos(petalCount * theta + Math.PI / 5);
    r = baseR * factor;
    
  } else if (seedId === 2) {
    // 2. 晚樱 · Pale Cherry Blossom (经典单线条五瓣樱花，带有极细微的顶点爱心状凹口)
    const numPetals = 5;
    const lobe = 0.74 + 0.26 * Math.cos(numPetals * theta);
    // 在花瓣顶端附近增加轻微凹陷
    const notch = 0.08 * Math.pow(Math.abs(Math.sin((numPetals * theta) / 2)), 8.0);
    r = baseR * (lobe - notch);
    
  } else if (seedId === 3) {
    // 3. 明葵 · Butter Sunflower (单层清爽的明葵花冠，清秀多瓣)
    const factor = 0.75 + 0.25 * Math.abs(Math.cos((petalCount * theta) / 2));
    r = baseR * factor;
    
  } else if (seedId === 4) {
    // 4. 织锦 · Water Mallow (温婉起伏、极其简约的水色锦葵)
    const factor = 0.78 + 0.22 * Math.cos(petalCount * theta);
    r = baseR * factor;
  } else {
    r = baseR * (0.7 + Math.sin(6 * theta) * 0.2);
  }
  
  const x = Math.cos(theta) * r;
  const y = Math.sin(theta) * r;
  
  // 注入精妙而古朴的“笨拙”手绘微畸变 (手写稚嫩宣纸感)，打破绝对的几何对称
  const warp = 1.0 + 
    0.045 * Math.sin(3 * theta + seedId * 0.7) + 
    0.030 * Math.cos(2 * theta - seedId * 1.3) + 
    0.015 * Math.sin(5 * theta + seedId * 2.1) +
    0.012 * Math.sin(theta - 2.5);
    
  return { 
    x: x * warp, 
    y: y * warp 
  };
}
