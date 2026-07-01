---
name: ui-ux-pro-max
description: UI/UX 设计智能体，包含 67 种样式、96 个调色板、57 种字体配对、99 条 UX 指南和 25 种图表类型，覆盖 13 个技术栈
---

# UI/UX Pro Max — 设计智能体

## 能力概述

提供从需求分析到代码交付的全链路 UI/UX 设计指导，包括：
- 设计系统生成（样式、颜色、字体、效果）
- 组件级实现指南
- 多技术栈适配（React/Vue/Next.js/HTML-Tailwind 等）
- 可访问性和性能最佳实践

## 使用方法

当你需要 UI/UX 相关工作（设计、构建、实现、评审、修复、改进）时，按以下流程执行：

### 步骤 1：分析用户需求

提取关键信息：
- **产品类型**：SaaS、电商、作品集、仪表盘、落地页等
- **风格关键词**：极简、活泼、专业、优雅、暗色模式等
- **行业**：医疗、金融、游戏、教育等
- **技术栈**：React、Vue、Next.js，默认 html-tailwind

### 步骤 2：生成设计系统

根据不同场景选择最匹配的设计模式和风格组合。请参考 `data/` 目录下的数据库文件进行查询。

### 步骤 3：补充细节搜索

基于设计系统，针对具体领域进行深度搜索：

| 领域 | 用途 | 示例关键词 |
|------|------|-----------|
| style | UI 样式、颜色、效果 | glassmorphism, minimalism, dark mode |
| typography | 字体配对 | elegant, playful, professional |
| color | 调色板 | saas, ecommerce, healthcare |
| chart | 图表类型 | trend, comparison, timeline |
| ux | 最佳实践 | animation, accessibility, z-index |
| landing | 页面结构 | hero, pricing, testimonial |

## 数据来源

所有设计数据存储在 `data/` 目录中，以 CSV 格式提供。包含：
- `products.csv` — 各行业产品设计模式
- `styles.csv` — UI 样式、颜色、效果
- `colors.csv` — 按产品类型分类的调色板
- `typography.csv` — 字体配对和 Google Fonts 推荐
- `charts.csv` — 图表类型和库推荐
- `ux-guidelines.csv` — UX 最佳实践和反模式
- `landing.csv` — 页面结构和 CTA 策略
- `web-interface.csv` — Web 界面指南
- `react-performance.csv` — React/Next.js 性能优化
- `icons.csv` — 图标选择指南
- `stacks/` — 各技术栈的最佳实践

## 通用 UI 规则

### 图标和视觉元素

| 规则 | 正确做法 | 错误做法 |
|------|---------|---------|
| **无 emoji 图标** | 使用 SVG 图标 (Heroicons, Lucide) | 使用 emoji 作为 UI 图标 |
| **稳定的 hover 状态** | 使用 color/opacity 过渡 | 使用 scale 变换导致布局偏移 |
| **一致的图标尺寸** | 使用固定 viewBox(24x24) + w-6 h-6 | 混合不同尺寸的图标 |

### 交互和光标

| 规则 | 正确做法 | 错误做法 |
|------|---------|---------|
| **指针光标** | 可点击元素加 `cursor-pointer` | 交互元素保留默认光标 |
| **悬停反馈** | 提供视觉反馈 (color, shadow, border) | 无交互反馈 |

### 亮/暗模式对比

| 规则 | 正确做法 | 错误做法 |
|------|---------|---------|
| **亮色玻璃卡片** | 使用 `bg-white/80` | 使用 `bg-white/10` 过透明 |
| **文本对比度** | 使用 `#0F172A` 深色文本 | 使用 `#94A3B8` 浅灰文本 |
| **边框可见性** | 亮色模式使用 `border-gray-200` | 不可见的边框 |

## 交付前检查清单

- [ ] 无 emoji 作为图标（使用 SVG）
- [ ] 所有图标来自一致的图标集
- [ ] 悬停状态不会导致布局偏移
- [ ] 所有可点击元素有 `cursor-pointer`
- [ ] 过渡动画流畅 (150-300ms)
- [ ] 亮色/暗色模式均有足够对比度
- [ ] 响应式适配 375px ~ 1440px
- [ ] 所有图片有 alt 文本
- [ ] 表单输入有 label
- [ ] `prefers-reduced-motion` 响应式处理