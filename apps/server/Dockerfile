FROM node:24-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 루트 설정 복사
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./

# 패키지 설정 복사
COPY packages/protocol/package.json ./packages/protocol/
COPY apps/server/package.json ./apps/server/

# 의존성 설치
RUN pnpm install --frozen-lockfile

# 소스 복사
COPY packages/protocol/ ./packages/protocol/
COPY apps/server/ ./apps/server/

# 빌드
RUN pnpm turbo build --filter=@taminal/server

# --- 런타임 ---
FROM node:24-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages/protocol/package.json ./packages/protocol/
COPY --from=builder /app/apps/server/package.json ./apps/server/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/protocol/build/ ./packages/protocol/build/
COPY --from=builder /app/apps/server/build/ ./apps/server/build/

EXPOSE 3001

CMD ["node", "apps/server/build/index.js"]
