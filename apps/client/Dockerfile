FROM node:24-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 루트 설정 복사
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./

# 패키지 설정 복사
COPY packages/protocol/package.json ./packages/protocol/
COPY apps/client/package.json ./apps/client/

# 의존성 설치
RUN pnpm install --frozen-lockfile

# 소스 복사
COPY packages/protocol/ ./packages/protocol/
COPY apps/client/ ./apps/client/

# Prisma 클라이언트 생성
RUN cd apps/client && DATABASE_URL="file:./prisma/dev.db" pnpm prisma generate

# 빌드
RUN pnpm turbo build --filter=web

# --- 런타임 ---
FROM node:24-alpine

WORKDIR /app

# Nitro 빌드 결과물 복사 (자체 번들링되어 node_modules 불필요)
COPY --from=builder /app/apps/client/build/ ./build/

# 데이터 디렉토리
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV DATABASE_URL=file:/app/data/taminal.db

EXPOSE 3000

CMD ["node", "build/server/index.mjs"]
