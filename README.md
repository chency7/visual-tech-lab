<div align="center">
  <img src="public/logo.svg" alt="Next.js Template Logo" width="120" height="120" />

# 🚀 Next.js 项目模板

基于 [Next.js 15](https://nextjs.org) 构建的现代化 Web 应用模板，集成了最佳实践和常用工具。

</div>

## ✨ 特性

- 📦 基于 Next.js 15 App Router
- 🎨 集成 TailwindCSS 样式解决方案
- 💪 TypeScript 类型支持
- 🔍 ESLint + Prettier 代码规范
- 🚦 Husky + lint-staged 提交检查
- 🐳 Docker 容器化支持
- 📱 响应式设计
- 🔄 自动化部署配置

## 🛠️ 技术栈

- **框架：** Next.js 15
- **语言：** TypeScript
- **样式：** TailwindCSS
- **状态管理：** React Context + Hooks
- **代码规范：** ESLint + Prettier
- **提交规范：** Husky + Commitlint
- **包管理器：** pnpm
- **容器化：** Docker

## 📦 项目结构

```bash
src/
├── app/
│   ├── api/                     # 接口入口（App Router 的 Route Handlers）
│   │   ├── health/route.ts      # 示例：健康检查 GET /api/health
│   │   ├── echo/                # 示例：Echo 接口目录（可添加 route.ts）
│   │   └── users/               # 示例：用户接口目录（可添加 route.ts）
│   ├── layout.tsx               # 页面布局
│   └── page.tsx                 # 首页
├── services/                    # 业务逻辑层（Service 层）
│   ├── auth/                    # 认证相关业务模块
│   └── demo/                    # 示例业务模块
├── lib/                         # 第三方库配置 / 数据访问层
│   ├── db/
│   │   ├── drizzle.ts           # Drizzle + better-sqlite3 初始化
│   │   └── schema.ts            # 数据表结构定义
│   └── i18n/                    # 国际化配置
├── utils/                       # 工具函数（纯函数，格式化/校验等）
├── hooks/                       # 自定义 Hooks
├── components/                  # UI 组件
├── styles/                      # 全局样式
└── types/                       # 全局类型定义
```

### 🧱 架构分层（推荐）
- UI 层：`src/app/*` 页面与 `src/components/*` 组件
- API 层：`src/app/api/*/route.ts` 请求入口，只做参数校验与调用服务
- 服务层：`src/services/*` 业务规则与流程编排
- 数据层：`src/lib/db/*` 连接配置与表结构（Drizzle + SQLite）
- 通用层：`src/utils/*` 工具函数、`src/types/*` 类型定义

## 🚀 快速开始

### 开发环境

1. 安装依赖：

```bash
pnpm install
```

2. 启动开发服务器：

```bash
pnpm dev
```

3. 在浏览器打开 [http://localhost:3000](http://localhost:3000)

### 生产环境

1. 构建项目：

```bash
pnpm build
```

2. 启动生产服务：

```bash
pnpm start
```

### Docker 部署

1. 构建镜像：

```bash
pnpm docker:build
```

2. 运行容器：

```bash
pnpm docker:run
```

## 📝 开发规范

- 代码提交前会自动运行 ESLint 和 Prettier 检查
- 提交信息必须符合 Conventional Commits 规范
- 组件优先使用 Server Components
- 确保所有代码都有适当的类型定义

## 🔧 环境变量

创建 `.env.local` 文件：

```bash
APP_ENV=development
# 其他环境变量...
```

## 📚 相关文档

- [Next.js 文档](https://nextjs.org/docs)
- [TailwindCSS 文档](https://tailwindcss.com/docs)
- [TypeScript 文档](https://www.typescriptlang.org/docs)

## 🤝 贡献指南

1. Fork 本项目
2. 创建新分支：`git checkout -b feature/your-feature`
3. 提交更改：`git commit -m 'feat: add some feature'`
4. 推送分支：`git push origin feature/your-feature`
5. 提交 Pull Request

## 📄 许可证

[MIT](LICENSE)
