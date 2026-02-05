# 项目重构方案：在线工具库 + Demo 示例站

## 1. 目标 (Align)
将现有的 Next.js 基础框架改造为集成了 **在线工具** 和 **Demo 示例** 的综合性网站。
- **Tools**: 实用开发工具集合（预留扩展性）。
- **Demos**: 展示项目现有的可视化与地图能力。
- **UI**: 现代化、美观的界面设计（参考 Vercel/Shadcn 风格）。

## 2. 架构设计 (Architect)

### 2.1 路由结构重构

```
src/app/
├── page.tsx                  # [重写] 首页 Landing Page (Hero + 入口卡片)
├── layout.tsx                # 全局布局
├── tools/                    # [新增] 工具库模块
│   ├── page.tsx              # 工具列表页
│   └── json-format/          # [示例] JSON 格式化工具
│       └── page.tsx
└── demos/                    # [新增] Demo 示例模块
    ├── page.tsx              # Demo 列表页 (或重定向)
    ├── layout.tsx            # Demo 模块通用布局 (可选 Sidebar)
    ├── visualization/        # 可视化类 Demo
    │   └── mext-chart/       # [迁移] 原 src/app/home
    │       └── page.tsx
    └── map/                  # 地图类 Demo
        ├── _shared/          # [提取] 地图通用组件/Hooks (原 src/app/map 下的公共部分)
        │   ├── components/
        │   ├── hooks/
        │   └── utils/
        ├── dual-sync/        # [迁移] 原 src/app/map (双地图联动)
        │   └── page.tsx
        └── hubei-data/       # [迁移] 原 src/app/map/hubei (湖北数据工具)
            └── page.tsx
```

### 2.2 模块迁移策略

1.  **Home (图表)** -> `src/app/demos/visualization/mext-chart`
2.  **Map (双地图)** -> `src/app/demos/map/dual-sync`
    *   依赖的 `utils`, `hooks`, `components` 提取到 `src/app/demos/map/_shared` 或保持相对路径修正。
    *   鉴于 `hubei` 也依赖 `map` 下的 utils，将 `src/app/map/{utils,hooks,components,const,types}` 移动到 `src/app/demos/map/shared`。
3.  **Map/Hubei (数据工具)** -> `src/app/demos/map/hubei-data`

### 2.3 UI 设计规范

- **风格**: 极简、卡片式、大圆角、微妙阴影。
- **组件**: 继续使用 `src/components/ui` 下的 Shadcn 组件。
- **首页**:
    - **Hero**: 大标题 "Next Start", 副标题 "Your All-in-One Developer Toolkit & Demo Showcase".
    - **Features Grid**: 展示 "Visualization", "Map Engine", "Utilities".

## 3. 执行步骤 (Atomize)

1.  **创建目录结构**: 建立 `src/app/demos` 和 `src/app/tools` 及子目录。
2.  **移动共享文件**: 将 `src/app/map` 下的非 page 文件移动到 `src/app/demos/map/shared`。
3.  **移动页面文件**:
    - `src/app/home` -> `src/app/demos/visualization/mext-chart`
    - `src/app/map/page.tsx` -> `src/app/demos/map/dual-sync/page.tsx`
    - `src/app/map/hubei` -> `src/app/demos/map/hubei-data`
4.  **修复引用**: 批量替换 import 路径。
    - `../utils/initMap` -> `@/app/demos/map/shared/utils/initMap` (建议配置 alias 或使用绝对路径以减少层级困扰，或者使用相对路径 `../shared/...`)。
    - 这里的最佳实践是使用 `@/demos/map/shared/...` 这样的别名，或者直接相对路径。我们将优先使用相对路径修正，或者如果 `tsconfig.json` 允许，添加新的 alias。
    - 当前 alias: `@/*` -> `./src/*`。所以可以用 `@/app/demos/map/shared/...`。
5.  **重写首页**: 修改 `src/app/page.tsx`。
6.  **更新导航**: 修改 `src/components/layout/Navbar.tsx`。

