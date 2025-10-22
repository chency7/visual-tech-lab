# 构建阶段：安装依赖并编译 Next 独立运行产物
FROM node:22.20-alpine AS builder
WORKDIR /app

# Alpine 常用兼容库 + 原生模块构建依赖（如 better-sqlite3）
RUN apk add --no-cache libc6-compat python3 make g++

# 安装 pnpm
RUN npm i -g pnpm

# 仅复制依赖清单，提升缓存命中率
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 复制源代码并构建
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# 运行阶段：仅包含运行所需文件（Next standalone）
FROM node:22.20-alpine AS runner
WORKDIR /app

# 运行期所需工具（健康检查使用 curl）
RUN apk add --no-cache libc6-compat curl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 使用非 root 用户运行
RUN addgroup -S nodejs -g 1001 \
  && adduser -S nextjs -u 1001

# 复制构建产物（standalone + 静态资源 + public）
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0


HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:3000/ || exit 1

CMD ["node", "server.js"]