# 伊甸流体 · Eden Fluid

**一座会回应身体与声音的流体花园。**

《伊甸流体》是一件运行在浏览器中的数字交互艺术作品。粒子并不组成一幅固定的画：它们随鼠标、手势、表情与环境声音聚散，生长为花、涟漪和流波。观众不是旁观者，而是让这座花园持续变化的参与者。

**[进入在线作品 →](https://lindawow.github.io/eden-fluid-v4/)**  ·  [打开独立 HTML 版本](https://lindawow.github.io/eden-fluid-v4/伊甸流体-fixed.html)

## 作品概念

作品从五颗不同色彩与形态的“种子”出发：藤萝、橘葵、晚樱、明葵与织锦。靠近它们，粒子逐渐向花的轮廓聚集；离开后，形态又回到流动之中。点击带来涟漪，横向拖动改变色彩，滚轮或纵向挥手改变几何形态。镜头模式下，张开与握紧的手、捏合的手指，以及微笑，也会成为画面和声音的输入。

这里没有关卡或预设结局。每一次停留、移动和尝试，都会让同一片空间呈现不同的瞬间。

## 如何参与

| 输入方式 | 可以做什么 |
| --- | --- |
| 鼠标或触控（默认） | 移动以靠近花种；点击生成涟漪；左右拖动改变色调；滚轮调节曼陀罗式几何形态。 |
| 摄像头手势（可选） | 在底部切换到镜头模式。移动双手、捏合手指、张开或握紧手掌，观察粒子、涟漪与明暗的变化。微笑也会触发流波与音效。 |
| 麦克风（可选） | 在底部开启拾音，让周围声音的变化参与涟漪生成。 |

底部控制栏还可以切换暗夜模式、隐藏摄像头预览、静音或调节音量。首次点击画面后，浏览器才可能允许作品播放声音。

## 实现与运行

作品使用 React、TypeScript、HTML Canvas 与 Web Audio API 绘制和生成视觉、声音；摄像头交互使用 MediaPipe Hands 与 Face Mesh，在浏览器端处理手势和面部输入。在线作品由 GitHub Pages 托管，不需要 Gemini、Google AI Studio 或 API Key。

鼠标模式不需要摄像头。开启镜头或麦克风模式时，浏览器会请求相应权限。手势与面部追踪脚本通过 jsDelivr 加载，因此首次使用镜头模式需要连接网络；摄像头和麦克风体验取决于设备、浏览器及授权状态。

## 本地运行

需要 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

构建生产版本：

```bash
npm run build
```

推送到 `main` 后，GitHub Actions 会自动构建并发布到 GitHub Pages。

---

*Eden Fluid is a browser-based interactive artwork: a garden of particles shaped by movement, gesture, expression, and sound. Explore it with a mouse, or opt in to camera and microphone interaction. No Gemini account or API key is required.*
