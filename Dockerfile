# 使用官方 Node 运行时镜像（Alpine 更小）
FROM node:20-alpine

# 工作目录
WORKDIR /app

# 仅复制依赖清单，优先安装依赖以利用缓存
COPY package*.json ./

# 安装依赖（包含 dev 依赖用于构建）
# 使用 npm install 而不是 npm ci 以支持 lockfileVersion 3
RUN npm install --frozen-lockfile

# 复制全部源码
COPY . .

# 构建后端与前端（tsc + vite）
RUN npm run build

# 生产环境变量
ENV NODE_ENV=production

# 暴露后端监听端口
# Zeabur 会自动注入 PORT 环境变量（通常是非3001端口）
EXPOSE 3001

# 启动 Node 服务，托管 API 与 dist 静态资源
CMD ["npm", "start"]