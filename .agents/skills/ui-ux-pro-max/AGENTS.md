# UI/UX Pro Max — 核心规则

## 设计系统生成流程

当用户请求 UI/UX 设计工作时，必须遵循以下流程：

### 1. 分析需求
提取：产品类型、风格关键词、行业、技术栈（默认 html-tailwind）

### 2. 推荐设计系统
从 data/ 中查询最匹配的组合：
- **products.csv** → 产品类型模式
- **styles.csv** → UI 风格
- **colors.csv** → 调色板
- **typography.csv** → 字体配对
- **landing.csv** → 页面结构
- **ux-guidelines.csv** → UX 指南
- **charts.csv** → 图表推荐

### 3. 多维度搜索
支持按 domain 筛选：style / color / typography / chart / ux / landing

## 样式数据库查询方法

直接读取 `data/` 目录下的 CSV 文件：
- 根据用户需求中的关键词搜索匹配行
- 按 priority 字段排序，优先级高的优先推荐
- 结合 ui-reasoning.csv 中的推理规则进行筛选

## 关键设计规则

### 图标
- 禁止使用 emoji 作为 UI 图标，必须用 SVG 图标库（Heroicons / Lucide）
- SVG 必须使用 24x24 viewBox，统一用 w-6 h-6 尺寸
- 公司 Logo 必须从 Simple Icons 获取官方 SVG

### 交互
- 所有可点击卡片/列表项必须加 `cursor-pointer`
- hover 状态必须提供视觉反馈（颜色/阴影/边框变化）
- 过渡动画使用 `transition-colors duration-200`，150-300ms 为佳

### 色彩对比度（WCAG 2.1 AA 标准）
- 正文文本对比度 ≥ 4.5:1
- 大文本对比度 ≥ 3:1
- 亮色模式：正文用 slate-900 `#0F172A`，次要文本用 slate-600 `#475569`
- 暗色模式：正文用 slate-100 `#F1F5F9`，次要文本用 slate-400 `#94A3B8`

### 玻璃拟态（Glassmorphism）
- 亮色模式：`bg-white/80` 或更高不透明度
- 暗色模式：`bg-black/20` 或 `bg-white/5`
- 必须配合 border 使用，确保边界可见

### 布局
- 浮动导航栏：`top-4 left-4 right-4` 留边距，不贴边
- 固定导航栏：内容区必须通过 padding/margin 避开遮挡
- 一致的 max-width：统一 `max-w-6xl` 或 `max-w-7xl`

### 可访问性
- 所有图片必须包含 alt 文本
- 表单输入必须有 label
- 颜色不能作为唯一的信息指示方式
- respect `prefers-reduced-motion` 媒体查询

## 技术栈适配

| 栈 | 关键关注点 |
|----|-----------|
| html-tailwind | Tailwind 工具类、响应式、可访问性（默认栈） |
| react | 状态管理、hooks、性能模式 |
| nextjs | SSR、路由、图片优化、API 路由 |
| vue | Composition API、Pinia、Vue Router |
| svelte | Runes、stores、SvelteKit |
| shadcn | shadcn/ui 组件、主题、表单、模式 |

## 交付前检查

- [ ] 设计系统是否完整（样式 + 颜色 + 字体 + 效果）
- [ ] 亮/暗模式是否均测试
- [ ] 响应式断点是否覆盖
- [ ] 交互反馈是否完善
- [ ] 可访问性是否符合标准