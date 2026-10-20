# 伊甸流体 v4

一个基于 React、Canvas 与 MediaPipe 的交互式数字艺术空间。手势和面部追踪在浏览器中运行，不需要 API Key。

## 在线体验

[直接打开伊甸流体](https://lindawow.github.io/eden-fluid-v4/)

[直接打开独立 HTML 版本](https://lindawow.github.io/eden-fluid-v4/伊甸流体-fixed.html)

浏览器可能会请求摄像头和麦克风权限。项目使用 MediaPipe 的 jsDelivr CDN 加载手势和面部追踪资源，因此首次访问需要联网。

## 本地运行

需要 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

推送到 `main` 分支后，GitHub Actions 会自动构建并发布到 GitHub Pages。
