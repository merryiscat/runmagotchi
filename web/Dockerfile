# Runmagotchi Dockerfile
# Next.js 16 + sharp (이미지 처리) + 장시간 API 지원
#
# 빌드: docker build -t runmagotchi .
# 실행: docker run -p 3000:3000 --env-file .env.local runmagotchi

# ── 1단계: 의존성 설치 ──
FROM node:20-alpine AS deps
WORKDIR /app

# sharp 네이티브 빌드에 필요
RUN apk add --no-cache libc6-compat

COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline

# ── 2단계: 빌드 ──
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 빌드 시 필요한 환경변수 (NEXT_PUBLIC_* 만)
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY

# Next.js standalone 모드로 빌드 (이미지 최소화)
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── 3단계: 실행 ──
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 보안: non-root 유저로 실행
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# standalone 빌드 결과물 복사
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 런타임 환경변수는 docker run --env-file 또는 -e 로 전달
# NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
# SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY

CMD ["node", "server.js"]
