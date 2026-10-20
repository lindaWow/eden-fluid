/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// 优雅的 Web Audio API 合成器，完全在客户端实时生成环境音乐和音效
class ArtAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private lowpassFilter: BiquadFilterNode | null = null;
  private delayLeft: DelayNode | null = null;
  private delayRight: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;
  private chimeGain: GainNode | null = null;
  private hasInteracted = false;

  // 基础环境合成器声音源
  private padOscillators: { osc: OscillatorNode; gain: GainNode }[] = [];
  
  // 曼达拉守序神圣和弦声轨
  private mandalaOsc1: OscillatorNode | null = null;
  private mandalaOsc2: OscillatorNode | null = null;
  private mandalaGain: GainNode | null = null;
  private lastTriggeredProgress = 0;

  // 鼠标悬停光斑中心极简共鸣音效
  private hoverOsc1: OscillatorNode | null = null;
  private hoverOsc2: OscillatorNode | null = null;
  private hoverFilter: BiquadFilterNode | null = null;
  private hoverGain: GainNode | null = null;
  private currentHoverSeedId: number | null = null;

  // 左右滑动调色相关的移调与璀璨沙铃音效
  private slideOsc: OscillatorNode | null = null;
  private slideGain: GainNode | null = null;
  private lastHueShift = 0;
  private lastRapidShiftTriggerTime = 0;

  // 宁静归一与运动摆幅状态追踪
  private lastStillnessLevel = 0;

  // 独立慢速手碟音轨状态
  private handpanIntervalId: any = null;
  private handpanStepIndex = 0;
  // D Integral / Kurd 和谐空灵九调手碟音阶序列 (搭配呼吸留白)
  private handpanSequence = [
    [146.83, 220.00], // Step 0: 定音(Ding) + 纯五度
    [],               // Step 1: 留白呼吸
    [293.66],         // Step 2: 宿中音
    [349.23],         // Step 3: 清亮音
    [440.00],         // Step 4: 悠远音
    [],               // Step 5: 留白呼吸
    [261.63],         // Step 6: 归依
    [],               // Step 7: 留白呼吸
    [146.83, 392.00], // Step 8: 定音(Ding) + 清越四度
    [],               // Step 9: 留白呼吸
    [329.63],         // Step 10: 婉转
    [349.23],         // Step 11: 连绵
    [220.00],         // Step 12: 宁静
    [],               // Step 13: 留白呼吸
    [233.08],         // Step 14: 冥想
    []                // Step 15: 留白呼吸
  ];
  
  // 慢动作和弦轮询状态
  private currentChordIndex = 0;
  private chordIntervalId: any = null;
  
  // 五合弦音高配置 (升至高八度，更显轻盈仙气、剔透轻空灵，避免低频沉闷)
  private chords = [
    // 1. Fmaj9 (空灵静雅，大调纯真)
    [349.23, 523.25, 659.25, 783.99, 1046.50, 1318.51], // F4, C5, E5, G5, C6, E6
    // 2. G6/9 (流光飘逸)
    [392.00, 493.88, 587.33, 783.99, 880.00, 1174.66], // G4, B4, D5, G5, A5, D6
    // 3. Am9 (意向深邃，小调正念)
    [220.00, 523.25, 659.25, 783.99, 880.00, 987.77], // A3, C5, E5, G5, A5, B5 - 略微丰富低音以让底蕴更深
    // 4. Cmaj9 (珍珠白光芒)
    [261.63, 392.00, 523.25, 659.25, 880.00, 1046.50]  // C4, G4, C5, E5, A5, C6
  ];

  // 触发风铃声的高频五声音阶 (Hz)
  private chimeScale = [1046.50, 1174.66, 1318.51, 1567.98, 1760.00, 2093.00, 2349.32, 2637.02, 3135.96];

  constructor() {}

  public setHasInteracted(val: boolean) {
    this.hasInteracted = val;
    if (val && this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(e => console.warn("Failed to resume context on setHasInteracted:", e));
    }
  }

  public init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(e => console.warn("Failed to resume AudioContext during init call:", e));
      }
      return;
    }

    // 1. 创建 AudioContext 与 主输出链路
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();
    
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.3, this.ctx.currentTime); // 主音量防过载
    
    // 2. 核心主低通滤波器 (眨眼时会向下扫频)
    this.lowpassFilter = this.ctx.createBiquadFilter();
    this.lowpassFilter.type = "lowpass";
    this.lowpassFilter.frequency.setValueAtTime(10000, this.ctx.currentTime);
    this.lowpassFilter.Q.setValueAtTime(1.2, this.ctx.currentTime);

    // 连接最终输出: 滤波器 -> 组增益 -> 扬声器
    this.lowpassFilter.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // 3. 建立乒乓延迟 (Ping-pong Delay) 节点链路 (带混响属性)
    this.delayLeft = this.ctx.createDelay(1.0);
    this.delayRight = this.ctx.createDelay(1.0);
    this.delayFeedback = this.ctx.createGain();
    this.chimeGain = this.ctx.createGain();

    const pannerLeft = this.ctx.createStereoPanner();
    const pannerRight = this.ctx.createStereoPanner();

    pannerLeft.pan.setValueAtTime(-0.8, this.ctx.currentTime);  // 声像偏左
    pannerRight.pan.setValueAtTime(0.8, this.ctx.currentTime);  // 声像偏右

    // 延迟时间
    this.delayLeft.delayTime.setValueAtTime(0.380, this.ctx.currentTime);
    this.delayRight.delayTime.setValueAtTime(0.380, this.ctx.currentTime);
    this.delayFeedback.gain.setValueAtTime(0.48, this.ctx.currentTime); // 恰到好处的余音

    // 交叉连接物理链路: 信号源 -> delayLeft -> pannerLeft -> delayRight -> pannerRight -> delayLeft (反馈循环)
    this.chimeGain.connect(this.delayLeft);
    this.delayLeft.connect(pannerLeft);
    pannerLeft.connect(this.lowpassFilter);

    // 交叉到右声道
    this.delayLeft.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delayRight);
    this.delayRight.connect(pannerRight);
    pannerRight.connect(this.lowpassFilter);

    // 将右声道延迟也引回左声道主线，形成回荡交织
    this.delayRight.connect(this.delayLeft);

    // 4. 立即开启 Ambient Pad 禅落底噪和弦、曼达拉几何声流、光圈悬停鸣音与独立手碟音轨
    this.setupPadSynth();
    this.setupMandalaSynth();
    this.setupHoverSynth();
    this.setupSlideSynth();
    this.startChordRotation();
    this.startHandpanSequencer();
  }

  private setupMandalaSynth() {
    if (!this.ctx || !this.lowpassFilter) return;

    this.mandalaGain = this.ctx.createGain();
    this.mandalaGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.mandalaOsc1 = this.ctx.createOscillator();
    this.mandalaOsc2 = this.ctx.createOscillator();

    this.mandalaOsc1.type = "sine";
    this.mandalaOsc2.type = "sine";

    // 优美的 Solfeggio 转换与契合频率 (黄金内核 528Hz，及第五度纯律泛音 792Hz)
    this.mandalaOsc1.frequency.setValueAtTime(528, this.ctx.currentTime);
    this.mandalaOsc2.frequency.setValueAtTime(792, this.ctx.currentTime);

    this.mandalaOsc1.connect(this.mandalaGain);
    this.mandalaOsc2.connect(this.mandalaGain);
    this.mandalaGain.connect(this.lowpassFilter);

    this.mandalaOsc1.start();
    this.mandalaOsc2.start();
  }

  private setupHoverSynth() {
    if (!this.ctx || !this.lowpassFilter) return;

    this.hoverGain = this.ctx.createGain();
    this.hoverGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    // 建立专用的共鸣滤波器
    this.hoverFilter = this.ctx.createBiquadFilter();
    this.hoverFilter.type = "lowpass";
    this.hoverFilter.frequency.setValueAtTime(1200, this.ctx.currentTime);
    this.hoverFilter.Q.setValueAtTime(3.0, this.ctx.currentTime); // 带有一定的谐振，使滤波器扫频更为空灵清脆

    this.hoverOsc1 = this.ctx.createOscillator();
    this.hoverOsc2 = this.ctx.createOscillator();

    this.hoverOsc1.type = "sine";
    this.hoverOsc2.type = "sine";

    this.hoverOsc1.frequency.setValueAtTime(523.25, this.ctx.currentTime);
    this.hoverOsc2.frequency.setValueAtTime(784.88, this.ctx.currentTime);

    this.hoverOsc1.connect(this.hoverFilter);
    this.hoverOsc2.connect(this.hoverFilter);
    this.hoverFilter.connect(this.hoverGain);
    this.hoverGain.connect(this.lowpassFilter);

    this.hoverOsc1.start();
    this.hoverOsc2.start();
  }

  private setupSlideSynth() {
    if (!this.ctx || !this.lowpassFilter) return;

    this.slideGain = this.ctx.createGain();
    this.slideGain.gain.setValueAtTime(0.0, this.ctx.currentTime);

    this.slideOsc = this.ctx.createOscillator();
    this.slideOsc.type = "triangle"; // 改为带有丰富高次谐频的三角波，令其能清澈地通过高通滤波器形成美声沙沙烁响
    this.slideOsc.frequency.setValueAtTime(1400, this.ctx.currentTime); // 晶莹高亢的沙铃核心频率

    // 通过高通滤波器，滤除低厚基音，留下晶透的流沙闪烁空气感
    const highpass = this.ctx.createBiquadFilter();
    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(2200, this.ctx.currentTime);

    this.slideOsc.connect(highpass);
    highpass.connect(this.slideGain);

    // 连接到混响反馈链路 (chimeGain) 中，让高频调色沙铃带有悠远的萦回延时
    this.slideGain.connect(this.chimeGain || this.lowpassFilter);

    this.slideOsc.start();
  }

  /**
   * 左右滑动调整色调时同步作用于背景音乐
   * 1. 背景 Ambient Pad 整体移调：将色相偏置 (Any real number) 平滑且连续地映射到 pad 的 detune，实现整体音调升降，极富共觉美感。
   * 2. 滑动动态音效：根据一阶变化率，呼吸式托起高频璀璨的类似风拂流沙的晶亮沙铃声线。
   * @param hueShift 当前色偏数值 (Unwrapped real number)
   */
  public setHueShift(hueShift: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // A. 移调背景音乐：每一个音色通过 detune 进行滑移，保持各和声间隔但全局转调 (限制在 ±1200 cents 即大二度至一个八度平滑游弋)
    const detuneCents = Math.max(-1200, Math.min(1200, hueShift * 1.5));
    this.padOscillators.forEach(({ osc }) => {
      osc.detune.setValueAtTime(detuneCents, now);
    });

    // B. 自适应璀璨沙铃风声 (根据当前帧的变化量计算滑动速率)
    const diff = Math.abs(hueShift - this.lastHueShift);
    const isPositive = hueShift > this.lastHueShift;
    this.lastHueShift = hueShift;

    // 如果变化进入快速变换状态 (调低阈值至 0.0018，使平滑的调色滑动也能细腻且真实地托起呼啸风声)
    if (this.hasInteracted && diff > 0.0018 && this.slideOsc && this.slideGain) {
      const targetVol = Math.max(0.0, Math.min(0.24, diff * 18.0));
      this.slideGain.gain.cancelScheduledValues(now);
      this.slideGain.gain.setValueAtTime(this.slideGain.gain.value, now);
      this.slideGain.gain.linearRampToValueAtTime(targetVol, now + 0.08);

      // 快速归零以保持短促璀璨的空气摩擦摩擦沙沙声
      this.slideGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
      
      this.slideOsc.frequency.cancelScheduledValues(now);
      this.slideOsc.frequency.setValueAtTime(this.slideOsc.frequency.value, now);
      const targetFreq = isPositive ? 1600 : 1200;
      this.slideOsc.frequency.exponentialRampToValueAtTime(targetFreq, now + 0.14);
    }
  }

  /**
   * 注入悬停目标和声能量
   * @param seedId 悬停的种子 ID (number | null)
   * @param intensity 悬停强度级别 (0.0 ~ 1.0)
   */
  public setHoverState(seedId: number | null, intensity: number) {
    if (!this.ctx || !this.hoverGain || !this.hoverOsc1 || !this.hoverOsc2 || !this.hoverFilter) return;
    const now = this.ctx.currentTime;

    if (seedId === null || intensity <= 0.001) {
      // 没有任何悬停或移出，平滑降噪归零，无 click 杂音
      this.hoverGain.gain.cancelScheduledValues(now);
      this.hoverGain.gain.setValueAtTime(this.hoverGain.gain.value, now);
      this.hoverGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
      this.currentHoverSeedId = null;
    } else {
      // 五种种子映射出 5 组具有突出特色、和谐且极具辨识度的空灵和音（不与低沉的背景 Pad/手碟产生混叠，高频清晰）
      // 0：藤萝 (模似温暖、呼吸感强的模拟声管/单簧管和弦)
      // 1：橘葵 (纯净星瀚的水晶磬钟/晶亮磬磐，带 11 度清澈高次谐波，点尘不染)
      // 2：晚樱 (柔美空灵的排箫木管流沙呼吸，带有木质低通空腔音)
      // 3：明葵 (太空迷幻 Phaser 周期性飞梭扫频，伴随着正弦 LFO)
      // 4：织锦 (深邃宏大、带有底蕴低频次谐波的藏地颂钵共鸣)
      
      const pitches = [523.25, 587.33, 659.25, 783.99, 880.00]; // C5, D5, E5, G5, A5
      const baseFreq = pitches[seedId] || 523.25;

      // 仅当切换悬停目标时，更新基础阻抗与振荡器波形类型，避免重复触发导致的 click 杂音
      if (this.currentHoverSeedId !== seedId) {
        if (seedId === 0) {
          // 藤萝: 三角波 + 正弦，带温暖的微微不协和
          this.hoverOsc1.type = "triangle";
          this.hoverOsc2.type = "sine";
          this.hoverOsc1.detune.setValueAtTime(10, now);
          this.hoverOsc2.detune.setValueAtTime(-10, now);
        } else if (seedId === 1) {
          // 橘葵: 双正弦晶亮叠层，超高空灵度，极易区别于背景
          this.hoverOsc1.type = "sine";
          this.hoverOsc2.type = "sine";
          this.hoverOsc1.detune.setValueAtTime(0, now);
          this.hoverOsc2.detune.setValueAtTime(0, now);
        } else if (seedId === 2) {
          // 晚樱: 双三角波，柔和木管空气感
          this.hoverOsc1.type = "triangle";
          this.hoverOsc2.type = "triangle";
          this.hoverOsc1.detune.setValueAtTime(-5, now);
          this.hoverOsc2.detune.setValueAtTime(5, now);
        } else if (seedId === 3) {
          // 明葵: 锯齿波 + 三角波，做扫频具有强辨识力
          this.hoverOsc1.type = "sawtooth";
          this.hoverOsc2.type = "triangle";
          this.hoverOsc1.detune.setValueAtTime(0, now);
          this.hoverOsc2.detune.setValueAtTime(15, now);
        } else if (seedId === 4) {
          // 织锦: 三角波低八度 + 正弦五度，超低沉颂钵，具有声学触感
          this.hoverOsc1.type = "triangle";
          this.hoverOsc2.type = "sine";
          this.hoverOsc1.detune.setValueAtTime(0, now);
          this.hoverOsc2.detune.setValueAtTime(0, now);
        }
        this.currentHoverSeedId = seedId;
      }

      // 动态滑移和声音频 (平滑变频，绝无瞬间突变)
      let currentFreq1 = baseFreq;
      let currentFreq2 = baseFreq * 1.5; // 完美五度
      
      if (seedId === 1) {
        // 橘葵：高亮水晶泛音，使用 3 倍频 (也就是基频以上的第 2 个八度 + 纯五度)
        currentFreq2 = baseFreq * 3.0; 
      } else if (seedId === 4) {
        // 织锦：一频降一倍八度 (0.5), 二主频回归，营造宽厚梵唱
        currentFreq1 = baseFreq * 0.5;
        currentFreq2 = baseFreq;
      }

      this.hoverOsc1.frequency.cancelScheduledValues(now);
      this.hoverOsc1.frequency.setValueAtTime(this.hoverOsc1.frequency.value, now);
      this.hoverOsc1.frequency.exponentialRampToValueAtTime(currentFreq1, now + 0.12);

      this.hoverOsc2.frequency.cancelScheduledValues(now);
      this.hoverOsc2.frequency.setValueAtTime(this.hoverOsc2.frequency.value, now);
      this.hoverOsc2.frequency.exponentialRampToValueAtTime(currentFreq2, now + 0.12);

      // 动态塑造专属的共鸣滤波器 (Biquad Filter) 参数，使声音具有极强的辨识度!
      this.hoverFilter.frequency.cancelScheduledValues(now);
      this.hoverFilter.Q.cancelScheduledValues(now);

      if (seedId === 0) {
        // 藤萝: 柔和中低通，温暖饱饱满
        this.hoverFilter.type = "lowpass";
        this.hoverFilter.frequency.exponentialRampToValueAtTime(650 + intensity * 600, now + 0.15);
        this.hoverFilter.Q.setValueAtTime(1.5, now);
      } else if (seedId === 1) {
        // 橘葵: 锐利晶带通，穿透力极强而优雅，与背景音乐形成极大反差
        this.hoverFilter.type = "bandpass";
        this.hoverFilter.frequency.exponentialRampToValueAtTime(1900 - intensity * 500, now + 0.15);
        this.hoverFilter.Q.setValueAtTime(4.2, now);
      } else if (seedId === 2) {
        // 晚樱: 极柔、富有声乐厚度的平滑低通
        this.hoverFilter.type = "lowpass";
        this.hoverFilter.frequency.exponentialRampToValueAtTime(350 + intensity * 250, now + 0.2);
        this.hoverFilter.Q.setValueAtTime(0.8, now);
      } else if (seedId === 3) {
        // 明葵: 太空迷幻 Phaser 周期性飞梭扫频，伴随着正弦 LFO
        const lfo = Math.sin(now * 7.5) * 350; // 7.5Hz 动能漩涡颤音
        this.hoverFilter.type = "lowpass";
        this.hoverFilter.frequency.exponentialRampToValueAtTime(Math.max(200, 800 + lfo + intensity * 500), now + 0.1);
        this.hoverFilter.Q.setValueAtTime(5.5, now); // 高 Resonance 形成清晰的科幻漩涡质感
      } else if (seedId === 4) {
        // 织锦: 低频颂钵，共频隆隆震鸣，声场宏大
        this.hoverFilter.type = "lowpass";
        this.hoverFilter.frequency.exponentialRampToValueAtTime(280 + intensity * 120, now + 0.25);
        this.hoverFilter.Q.setValueAtTime(4.8, now);
      }

      // 调整 hover 增益：随贴近中心，平滑托起和音
      const maxVol = seedId === 4 ? 0.11 : 0.08; 
      const targetVol = intensity * maxVol;

      this.hoverGain.gain.cancelScheduledValues(now);
      this.hoverGain.gain.setValueAtTime(this.hoverGain.gain.value, now);
      this.hoverGain.gain.linearRampToValueAtTime(targetVol, now + 0.22);
      this.currentHoverSeedId = seedId;
    }
  }

  public setMandalaProgress(progress: number) {
    if (!this.ctx || !this.mandalaGain || !this.mandalaOsc1 || !this.mandalaOsc2) return;
    const now = this.ctx.currentTime;

    // progress 在 0.0 到 5.0 时正常凝聚与演化；在 5.0 到 6.0 时随着曼达拉完全拆散消退而逐渐淡出至零
    let boundProgress = Math.min(1.0, progress);
    if (progress > 5.0) {
      boundProgress = Math.max(0.0, 1.0 - (progress - 5.0));
    }

    // 缓动控制增益：随着秩序凝聚，清爽温馨的曼达拉和弦音随之缓缓托起
    this.mandalaGain.gain.cancelScheduledValues(now);
    this.mandalaGain.gain.setValueAtTime(this.mandalaGain.gain.value, now);
    const targetVol = this.hasInteracted ? boundProgress * 0.14 : 0.0;
    this.mandalaGain.gain.linearRampToValueAtTime(targetVol, now + 0.1);

    // 熵值控制音高混沌微调 (Entropy Detuning):
    // progress 为 0.0 时，两阶音轨带有不协和的微失调 (detune = ±30 cents)
    // progress 变大时，音轨渐渐缩减失调，最终在 1.0 完美守序归于完美纯协音 (detune = 0)
    const detuneAmount = Math.max(0, (1.0 - boundProgress) * 30);
    this.mandalaOsc1.detune.setValueAtTime(detuneAmount, now);
    this.mandalaOsc2.detune.setValueAtTime(-detuneAmount, now);

    // 当曼达拉出现后续五重变形阶段时，音高根据变形精度产生泛音微升，达成视听共觉
    let freq1 = 528;
    let freq2 = 792;
    if (progress > 1.0) {
      const extra = progress - 1.0;
      freq1 = 528 + Math.sin(extra * Math.PI) * 24; // 在升降半音的范围内滑动泛音
      freq2 = 792 + Math.cos(extra * Math.PI) * 36;
    }
    
    this.mandalaOsc1.frequency.cancelScheduledValues(now);
    this.mandalaOsc2.frequency.cancelScheduledValues(now);
    this.mandalaOsc1.frequency.exponentialRampToValueAtTime(freq1, now + 0.15);
    this.mandalaOsc2.frequency.exponentialRampToValueAtTime(freq2, now + 0.15);

    // 滚动调节时，如果越过分阶，给予极其纤细的水晶钟鸣回馈
    const currentStep = Math.floor(progress * 10);
    const lastStep = Math.floor(this.lastTriggeredProgress * 10);
    if (currentStep !== lastStep && this.hasInteracted) {
      this.triggerChime(0.12 + boundProgress * 0.15);
      this.lastTriggeredProgress = progress;
    }
  }

  /**
   * 当手掌在曼陀罗的图案中央静止或高频运动时触发的音学反馈
   * @param stillness 静止度 (0.0 ~ 1.0)
   * @param swing 剧摆振幅 (0.0 ~ 1.0)
   */
  public setStillnessState(stillness: number, swing: number) {
    if (!this.ctx || !this.hasInteracted) return;
    const now = this.ctx.currentTime;

    // 当静止度突破一些里程碑节点时，触发纯净清脆的水晶钟鸣，让用户能感知分子正在完美排布
    if (stillness > 0.3 && this.lastStillnessLevel <= 0.3) {
      this.triggerStillnessChime(1, 0.4);
    } else if (stillness > 0.65 && this.lastStillnessLevel <= 0.65) {
      this.triggerStillnessChime(2, 0.65);
    } else if (stillness > 0.94 && this.lastStillnessLevel <= 0.94) {
      this.triggerStillnessChime(3, 0.92);
    }

    this.lastStillnessLevel = stillness;

    // 如果摆动幅度很大，可以触发风拂沙铃般的动态声响
    if (swing > 0.45 && this.slideOsc && this.slideGain) {
      const vol = Math.min(0.04, swing * 0.05);
      this.slideGain.gain.cancelScheduledValues(now);
      this.slideGain.gain.setValueAtTime(this.slideGain.gain.value, now);
      this.slideGain.gain.linearRampToValueAtTime(vol, now + 0.05);
      this.slideGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
    }
  }

  /**
   * 触发专属的宁静归一和音，代表分子由杂乱粒子聚为整齐美妙的几何图案
   */
  private triggerStillnessChime(stage: number, volume: number) {
    if (!this.ctx || !this.chimeGain || !this.hasInteracted) return;
    const now = this.ctx.currentTime;

    // 根据宁静阶段，播放越来越高亢、纯净、空灵的安全和谐阳脉音程
    // Stage 1: 温柔完满大三度 -> 528Hz, 660Hz (Solfeggio 528 + MI 660)
    // Stage 2: 幽静清亮五度/八度 -> 528Hz, 792Hz, 1056Hz
    // Stage 3: 归一结晶神圣大和音 -> 528Hz, 792Hz, 1056Hz, 1320Hz, 1584Hz
    let freqs = [528, 660];
    if (stage === 2) {
      freqs = [528, 792, 1056];
    } else if (stage === 3) {
      freqs = [528, 792, 1056, 1320, 1584];
    }

    freqs.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gainNode = this.ctx!.createGain();
      const timeOffset = idx * 0.085; // 竖琴顺音般拨响
      const playTime = now + timeOffset;

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, playTime);

      // 泛音副振荡器以营造微光漂浮残响
      const chorusOsc = this.ctx!.createOscillator();
      const chorusGain = this.ctx!.createGain();
      chorusOsc.type = "sine";
      chorusOsc.frequency.setValueAtTime(freq * 1.002 + 0.8, playTime);

      const maxGain = 0.06 * volume;
      gainNode.gain.setValueAtTime(0, playTime);
      gainNode.gain.linearRampToValueAtTime(maxGain, playTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, playTime + 2.8);

      chorusGain.gain.setValueAtTime(0, playTime);
      chorusGain.gain.linearRampToValueAtTime(maxGain * 0.38, playTime + 0.1);
      chorusGain.gain.exponentialRampToValueAtTime(0.0001, playTime + 2.2);

      osc.connect(gainNode);
      chorusOsc.connect(chorusGain);

      gainNode.connect(this.chimeGain!);
      chorusGain.connect(this.chimeGain!);

      osc.start(playTime);
      chorusOsc.start(playTime);

      osc.stop(playTime + 3.2);
      chorusOsc.stop(playTime + 2.8);
    });
  }

  private setupPadSynth() {
    if (!this.ctx || !this.lowpassFilter) return;

    // 生成6个清澈高雅的正弦波（Sine Wave）振荡器，声音纯净无杂质，极其轻盈
    for (let i = 0; i < 6; i++) {
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();
      
      osc.type = "sine"; // 使用纯净无低频杂音的正弦波，剔透轻灵
      osc.frequency.setValueAtTime(220, this.ctx.currentTime); // 占位，之后会被和弦覆盖
      oscGain.gain.setValueAtTime(0.0, this.ctx.currentTime); // 默认静音，通过 envelope 控制

      osc.connect(oscGain);
      oscGain.connect(this.lowpassFilter);
      osc.start();

      this.padOscillators.push({ osc, gain: oscGain });
    }
  }

  // 循环更换和弦 (和弦在 8 秒的时间轴上进行无限 LERP 缓动呼吸)
  private startChordRotation() {
    const cycleTime = 7000; // 每 7 秒呼吸切换一次
    
    const triggerNextChord = () => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const targetChord = this.chords[this.currentChordIndex];
      
      this.padOscillators.forEach(({ osc, gain }, idx) => {
        const freq = targetChord[idx] || 220;
        // 频率滑动：非极速变化，2.5s 缓慢滑动，极其柔丝
        osc.frequency.exponentialRampToValueAtTime(freq, now + 3.0);
        
        // 振幅呼吸: 产生潮汐般涨落的效果
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        // 和弦音色根据高低频动态调整增益
        const targetVol = idx < 2 ? 0.08 : 0.045 - (idx * 0.005);
        
        gain.gain.linearRampToValueAtTime(targetVol, now + 2.5);
        gain.gain.setValueAtTime(targetVol, now + 4.5);
        gain.gain.linearRampToValueAtTime(0.001, now + cycleTime / 1000);
      });

      this.currentChordIndex = (this.currentChordIndex + 1) % this.chords.length;
    };

    triggerNextChord();
    this.chordIntervalId = setInterval(triggerNextChord, cycleTime);
  }

  /**
   * 触发微笑特技 —— 精灵般的五声水晶风铃波 (Ping-pong 延迟混响)
   * @param intensity 微笑张力系数 (0.6 ~ 1.0)
   */
  public triggerChime(intensity: number) {
    if (!this.ctx || !this.chimeGain || !this.hasInteracted) return;

    const now = this.ctx.currentTime;
    
    // 生成 4~6 粒随机剔透水晶音，并自带小幅时间偏置
    const grainCount = 4 + Math.floor(Math.random() * 3);
    
    for (let k = 0; k < grainCount; k++) {
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      
      // 选取极高的水晶音高
      const randFreqIdx = Math.floor(Math.random() * this.chimeScale.length);
      const freq = this.chimeScale[randFreqIdx];
      
      osc.type = "sine"; // 纯净的正弦波
      osc.frequency.setValueAtTime(freq, now + k * 0.08); // 弹拨感
      
      gainNode.gain.setValueAtTime(0, now + k * 0.08);
      // 声音攻击与消散曲线
      gainNode.gain.linearRampToValueAtTime(0.18 * intensity, now + k * 0.08 + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + k * 0.08 + 1.2);
      
      osc.connect(gainNode);
      // 直接并联到乒乓延迟总线
      gainNode.connect(this.chimeGain);
      
      osc.start(now + k * 0.08);
      osc.stop(now + k * 0.08 + 1.3);
    }
  }

  /**
   * 触发曼陀罗神圣点击时的恢鸣水涟音效 — 结合深邃手碟低频基音与璀璨层叠和弦
   */
  public triggerMandalaRippleSound() {
    if (!this.ctx || !this.chimeGain || !this.hasInteracted) return;
    const now = this.ctx.currentTime;

    // 1. 深厚悠扬的禅意低频根音 (充满温暖回荡的手碟中心音)
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(146.83, now); // D3
    
    subGain.gain.setValueAtTime(0, now);
    subGain.gain.linearRampToValueAtTime(0.55, now + 0.08);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);

    subOsc.connect(subGain);
    subGain.connect(this.lowpassFilter || this.ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 3.0);

    // 2. 璀璨、飞流直下的圣域五声水晶和弦 (仙气高频 D-A 守序和弦)
    const chords = [293.66, 440.00, 587.33, 659.25, 880.00, 1174.66, 1760.00];
    
    chords.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gainNode = this.ctx!.createGain();
      
      const timeOffset = idx * 0.045;
      const playTime = now + timeOffset;

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, playTime);
      
      const detourOsc = this.ctx!.createOscillator();
      const detourGain = this.ctx!.createGain();
      detourOsc.type = "sine";
      detourOsc.frequency.setValueAtTime(freq * 1.002, playTime);

      gainNode.gain.setValueAtTime(0, playTime);
      gainNode.gain.linearRampToValueAtTime(0.24, playTime + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, playTime + 2.2);

      detourGain.gain.setValueAtTime(0, playTime);
      detourGain.gain.linearRampToValueAtTime(0.12, playTime + 0.02);
      detourGain.gain.exponentialRampToValueAtTime(0.0001, playTime + 1.8);

      osc.connect(gainNode);
      detourOsc.connect(detourGain);

      gainNode.connect(this.chimeGain!);
      detourGain.connect(this.chimeGain!);

      osc.start(playTime);
      detourOsc.start(playTime);

      osc.stop(playTime + 2.4);
      detourOsc.stop(playTime + 2.0);
    });
  }

  /**
   * 触发快速变色时的流光水晶音效 — 根据旋转和滑动方向生成一串梦幻的偏振音程
   */
  public triggerRapidShiftSound(speed: number, isPositive: boolean) {
    if (!this.ctx || !this.chimeGain || !this.hasInteracted) return;
    const now = this.ctx.currentTime;

    // 缩短冷却至 65ms，使得快速滑动时音符能密集衔接，发出如微澜流水般的连缀风铃声
    if (now - this.lastRapidShiftTriggerTime < 0.065) return;
    this.lastRapidShiftTriggerTime = now;

    // 提高最低及普通滑动的音量与密集度 (使风铃一串串洒落的感觉更饱满、清亮)
    const intensity = Math.max(0.45, Math.min(1.0, speed * 0.28));
    const noteCount = 5 + Math.floor(intensity * 4); // 5 至 9 个连续飞流音符
    
    // 改用极高音、空灵晶莹的仙境风铃音阶，突出“一串风铃”的玲珑质感
    const baseScale = [1046.50, 1174.66, 1318.51, 1567.98, 1760.00, 2093.00, 2349.32, 2637.02, 3135.96, 3520.00];
    
    // 正向滑动：音高升序 arpeggio；负向滑动：音高降序 arpeggio
    const notes: number[] = [];
    if (isPositive) {
      const startIndex = Math.floor(Math.random() * 3);
      for (let i = 0; i < noteCount; i++) {
        notes.push(baseScale[(startIndex + i) % baseScale.length]);
      }
    } else {
      const startIndex = 5 + Math.floor(Math.random() * 3);
      for (let i = 0; i < noteCount; i++) {
        const idx = startIndex - i;
        notes.push(baseScale[idx < 0 ? 0 : idx]);
      }
    }

    // 播放这串具有微光残影和弦的音符
    notes.forEach((freq, i) => {
      const osc = this.ctx!.createOscillator();
      const gainNode = this.ctx!.createGain();
      const timeOffset = i * 0.058; // 更紧凑的时间间隔，呈颗粒状水晶滚落美感
      const playTime = now + timeOffset;

      // 晶莹敲击感音色
      osc.type = "sine"; 
      osc.frequency.setValueAtTime(freq, playTime);

      // 泛音偏置以营造清晨露珠微光感
      const detuneOsc = this.ctx!.createOscillator();
      const detuneGain = this.ctx!.createGain();
      detuneOsc.type = "sine";
      detuneOsc.frequency.setValueAtTime(freq * 1.004 + 1, playTime);

      gainNode.gain.setValueAtTime(0, playTime);
      gainNode.gain.linearRampToValueAtTime(0.32 * intensity, playTime + 0.012); // 大幅提升响度，清脆高亮
      gainNode.gain.exponentialRampToValueAtTime(0.0001, playTime + 1.15); // 稍微缩短或延长主残响，使流光效果更加晶莹悠远

      detuneGain.gain.setValueAtTime(0, playTime);
      detuneGain.gain.linearRampToValueAtTime(0.16 * intensity, playTime + 0.012);
      detuneGain.gain.exponentialRampToValueAtTime(0.0001, playTime + 0.85);

      osc.connect(gainNode);
      detuneOsc.connect(detuneGain);
      
      gainNode.connect(this.chimeGain!);
      detuneGain.connect(this.chimeGain!);

      osc.start(playTime);
      detuneOsc.start(playTime);
      
      osc.stop(playTime + 1.3);
      detuneOsc.stop(playTime + 1.0);
    });
  }

  /**
   * 当世界形态在“漫天花海星野”与“黑洞单点收缩”之间切换时
   * 触发具有宏大呼吸感的专属环境变换音效 (合：宇宙黑洞气穴吸合声；开：仙气水晶微亮钟鸣)
   */
  public setOpenState(isOpen: boolean) {
    if (!this.ctx || !this.lowpassFilter || !this.hasInteracted) return;
    const now = this.ctx.currentTime;

    if (isOpen) {
      // 空间缓缓打开：播放清脆、漫开的仙子风铃声
      this.triggerChime(0.75);
    } else {
      // 空间收缩闭合：播放一组缓慢向下扫频的深沉、空寂“气穴收缩吸附”声
      const osc = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = "sine";
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 1.2);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(320, now);
      filter.frequency.exponentialRampToValueAtTime(35, now + 1.2);

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.16, now + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);

      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.lowpassFilter);

      osc.start(now);
      osc.stop(now + 1.3);
    }
  }

  /**
   * 眨眼低通变换：代表将思绪收回内心 (Blink -> Lowpass Active)
   * @param isBlinking 是否闭眼
   */
  public setBlinkState(isBlinking: boolean) {
    if (!this.ctx || !this.lowpassFilter) return;

    const now = this.ctx.currentTime;
    this.lowpassFilter.frequency.cancelScheduledValues(now);
    this.lowpassFilter.frequency.setValueAtTime(this.lowpassFilter.frequency.value, now);

    if (isBlinking) {
      // 缓动向下扫频至 480Hz，消除亮丽高频，只留下温暖、柔和的底振和弦 (1.5s 舒缓)
      this.lowpassFilter.frequency.exponentialRampToValueAtTime(480.0, now + 1.5);
    } else {
      // 睁眼瞬间扫回 12000Hz 清晰宽广的现实世界 (0.4s 微快复原)
      this.lowpassFilter.frequency.exponentialRampToValueAtTime(12000.0, now + 0.4);
    }
  }

  /**
   * 调整主输出音量
   */
  public setVolume(val: number) {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(val * 0.4, this.ctx.currentTime);
    }
  }

  /**
   * 开启独立且不受任何交互影响的慢速手碟底噪旋律音轨
   */
  private startHandpanSequencer() {
    // 步长为1800ms，每一步触发手碟音符或静音
    const stepTime = 1800;

    const triggerNextStep = () => {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const notesToPlay = this.handpanSequence[this.handpanStepIndex];

      notesToPlay.forEach(freq => {
        // 轻微地带有一点微秒级别的有机随机起动偏移，让声音富有温度和人性的呼吸感
        const humanizedTime = now + (Math.random() * 0.03);
        this.playHandpanNote(freq, humanizedTime);
      });

      this.handpanStepIndex = (this.handpanStepIndex + 1) % this.handpanSequence.length;
    };

    triggerNextStep();
    this.handpanIntervalId = setInterval(triggerNextStep, stepTime);
  }

  /**
   * 精细合成手碟（Handpan）饱满深邃、木质共振与泛音萦回的核心声学波源
   */
  private playHandpanNote(freq: number, startTime: number) {
    if (!this.ctx || !this.lowpassFilter) return;

    // A. 基础包络控制：基频、八度高音、合弦泛音与物理敲击杂音（Click）
    const oscFundamental = this.ctx.createOscillator();
    const oscOctave = this.ctx.createOscillator();
    const oscFifth = this.ctx.createOscillator();
    const oscStrike = this.ctx.createOscillator();

    const gainFundamental = this.ctx.createGain();
    const gainOctave = this.ctx.createGain();
    const gainFifth = this.ctx.createGain();
    const gainStrike = this.ctx.createGain();

    oscFundamental.type = "sine";
    oscFundamental.frequency.setValueAtTime(freq, startTime);

    // 八度和弦声像 (倍泛音)
    oscOctave.type = "sine";
    oscOctave.frequency.setValueAtTime(freq * 2.0, startTime);

    // 完美复五度泛音 (3倍频)，极度神圣高远
    oscFifth.type = "sine";
    oscFifth.frequency.setValueAtTime(freq * 3.0, startTime);

    // 三角波瞬时激发金属外壳及手指肉垫敲击音 (Strike Transient)
    oscStrike.type = "triangle";
    oscStrike.frequency.setValueAtTime(freq * 1.618, startTime);
    oscStrike.frequency.exponentialRampToValueAtTime(freq, startTime + 0.05);

    // B. 自适应设定手碟的空气共振感 Envelope
    gainFundamental.gain.setValueAtTime(0.0, startTime);
    gainFundamental.gain.linearRampToValueAtTime(0.12, startTime + 0.012); // 手指拍打
    gainFundamental.gain.exponentialRampToValueAtTime(0.0001, startTime + 2.8); // 漫漫回荡

    gainOctave.gain.setValueAtTime(0.0, startTime);
    gainOctave.gain.linearRampToValueAtTime(0.05, startTime + 0.01);
    gainOctave.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.8);

    gainFifth.gain.setValueAtTime(0.0, startTime);
    gainFifth.gain.linearRampToValueAtTime(0.03, startTime + 0.01);
    gainFifth.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.2);

    // 敲击空气波瞬态
    gainStrike.gain.setValueAtTime(0.0, startTime);
    gainStrike.gain.linearRampToValueAtTime(0.06, startTime + 0.002);
    gainStrike.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.045);

    oscFundamental.connect(gainFundamental);
    oscOctave.connect(gainOctave);
    oscFifth.connect(gainFifth);
    oscStrike.connect(gainStrike);

    // 混合成手碟乐器通道，注入到深邃的乒乓空间延迟混响链路中，使之空灵弥漫
    const handpanOut = this.ctx.createGain();
    handpanOut.gain.setValueAtTime(0.07, startTime); // 微妙适中的能量配比，清幽背景感

    gainFundamental.connect(handpanOut);
    gainOctave.connect(handpanOut);
    gainFifth.connect(handpanOut);
    gainStrike.connect(handpanOut);

    // 连接到包含回授(Delay)的通透混响之中
    handpanOut.connect(this.chimeGain || this.lowpassFilter);

    // 启动/停止所有振荡器，确保节点物理释放
    oscFundamental.start(startTime);
    oscOctave.start(startTime);
    oscFifth.start(startTime);
    oscStrike.start(startTime);

    oscFundamental.stop(startTime + 3.0);
    oscOctave.stop(startTime + 3.0);
    oscFifth.stop(startTime + 3.0);
    oscStrike.stop(startTime + 1.0);
  }

  /**
   * 销毁音频上下文，完全释放系统资源
   */
  public dispose() {
    if (this.chordIntervalId) {
      clearInterval(this.chordIntervalId);
    }
    if (this.handpanIntervalId) {
      clearInterval(this.handpanIntervalId);
    }
    
    // 关停所有 Pad 振拆器
    this.padOscillators.forEach(({ osc }) => {
      try {
        osc.stop();
      } catch (e) {}
    });
    this.padOscillators = [];

    // 关停曼达拉振荡器
    try {
      if (this.mandalaOsc1) this.mandalaOsc1.stop();
      if (this.mandalaOsc2) this.mandalaOsc2.stop();
    } catch (e) {}
    this.mandalaOsc1 = null;
    this.mandalaOsc2 = null;

    // 关停悬停共鸣振荡器
    try {
      if (this.hoverOsc1) this.hoverOsc1.stop();
      if (this.hoverOsc2) this.hoverOsc2.stop();
    } catch (e) {}
    this.hoverOsc1 = null;
    this.hoverOsc2 = null;

    // 关停滑动调色沙铃振荡器
    try {
      if (this.slideOsc) this.slideOsc.stop();
    } catch (e) {}
    this.slideOsc = null;

    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

export const audioEngine = new ArtAudioEngine();
