FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/types/package.json packages/types/package.json
RUN npm ci

COPY tsconfig.base.json ./
COPY apps/api apps/api
COPY packages packages
COPY prisma prisma
RUN npm run prisma:generate && npm run build:packages && npm run build --workspace @tarzan/api

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages/config ./packages/config
COPY --from=build /app/packages/types ./packages/types
COPY --from=build /app/prisma ./prisma

EXPOSE 3000
CMD ["sh", "-c", "npx --no-install prisma migrate deploy --schema prisma/schema.prisma && exec node apps/api/dist/main.js"]
