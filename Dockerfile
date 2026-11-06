FROM node:24-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_DATA_MODE=demo
ARG NEXT_PUBLIC_RESEARCH_API_MODE=backend
ENV NEXT_PUBLIC_DATA_MODE=$NEXT_PUBLIC_DATA_MODE \
    NEXT_PUBLIC_RESEARCH_API_MODE=$NEXT_PUBLIC_RESEARCH_API_MODE \
    BACKEND_INTERNAL_URL=http://backend:8000
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    BACKEND_INTERNAL_URL=http://backend:8000 \
    BIODRY_AUTH_MODE=backend \
    NEXT_PUBLIC_DATA_MODE=demo \
    NEXT_PUBLIC_RESEARCH_API_MODE=backend
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
WORKDIR /app
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]

