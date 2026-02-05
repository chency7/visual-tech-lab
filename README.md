<div align="center">
  <img src="public/logo.svg" alt="Visual Tech Lab Logo" width="120" height="120" />

# 🚀 Visual Tech Lab

**技术实验室**

个人技术探索与工具集合。这里记录了项目预研过程中的实验性案例，并提供开放的在线工具服务。

</div>

## ✨ 特性

- 🛠 **在线工具集**：提供常用的开发辅助工具，提升工作效率。
- 🗺 **高性能地图**：基于 MapLibre GL 的高级地图交互示例，支持双屏同步、海量数据渲染。
- 📊 **数据可视化**：集成 ECharts 等图表库，展示丰富的数据可视化效果。
- ⚡ **现代技术栈**：采用 Next.js 15 (App Router)、TypeScript、TailwindCSS 构建。
- 🧩 **模块化架构**：清晰的目录结构，将工具（Tools）与示例（Demos）分离，易于扩展。
- 📱 **响应式设计**：完美适配桌面与移动端设备。

## 🛠️ 技术栈

- **核心框架：** Next.js 15 (App Router)
- **开发语言：** TypeScript
- **样式方案：** TailwindCSS
- **地图引擎：** MapLibre GL JS
- **图表库：** ECharts / D3.js
- **工具库：** Turf.js (地理空间分析), Lodash
- **代码规范：** ESLint + Prettier
- **包管理：** pnpm

## 📦 项目结构

```bash
src/
├── app/
│   ├── api/                     # 后端接口 (Route Handlers)
│   ├── demos/                   # 交互示例模块
│   │   ├── map/                 # 地图类示例
│   │   │   ├── dual-sync/       # 双屏地图同步与 IDW 插值
│   │   │   ├── hubei-data/      # 湖北数据可视化处理
│   │   │   └── shared/          # 地图通用组件与 Hooks
│   │   └── visualization/       # 可视化图表示例
│   │       └── mext-chart/      # 高级图表展示
│   ├── tools/                   # 在线工具模块 (Coming Soon)
│   ├── layout.tsx               # 全局布局
│   └── page.tsx                 # 落地页 (Landing Page)
├── components/                  # 通用 UI 组件
├── lib/                         # 第三方库配置
├── services/                    # 业务逻辑服务
├── utils/                       # 工具函数
└── types/                       # 全局类型定义
```

## 🚀 快速开始

### 开发环境

1. **安装依赖**：

```bash
pnpm install
```

2. **启动开发服务器**：

```bash
pnpm dev
```

3. **访问项目**：
   打开浏览器访问 [http://localhost:3000](http://localhost:3000)

### 生产环境

1. **构建项目**：

```bash
pnpm build
```

2. **启动服务**：

```bash
pnpm start
```

## 📚 主要功能演示

### 1. 双屏地图同步 (Dual Map Sync)

- **路径**：`/demos/map/dual-sync`
- **功能**：左右分屏显示不同视角的地图，支持缩放、移动操作的实时同步。集成 IDW（反距离加权）插值算法，可将离散点数据实时转换为网格热力图。

### 2. 湖北数据可视化 (Hubei Data Vis)

- **路径**：`/demos/map/hubei-data`
- **功能**：专注于地理数据的处理与展示。支持 GeoJSON 数据的导入导出、属性编辑，以及基于边界的随机点位生成功能。

### 3. 图表可视化 (Chart Visualization)

- **路径**：`/demos/visualization/mext-chart`
- **功能**：展示复杂的数据图表，结合热图与垂直剖面分析，提供直观的数据洞察。

## 🤝 贡献指南

欢迎提交 Issue 或 Pull Request 来丰富这个实验室！

1. Fork 本项目
2. 创建新分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m 'feat: add some feature'`
4. 推送分支：`git push origin feature/your-feature`
5. 提交 Pull Request

## 📄 许可证

[MIT](LICENSE)
