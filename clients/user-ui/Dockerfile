FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public

# config next (ada: js & ts)
COPY --from=build /app/next.config.js /app/next.config.ts ./

EXPOSE 3000
CMD ["sh", "-c", "node node_modules/next/dist/bin/next start -p 3000 -H 0.0.0.0"]
