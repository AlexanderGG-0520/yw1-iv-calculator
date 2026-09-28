FROM node:26-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:26-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=80
ENV STATIC_ROOT=/app/dist

COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
COPY --from=build /app/dist-worker ./dist-worker

RUN apk add --no-cache libcap \
    && setcap cap_net_bind_service=+ep "$(readlink -f "$(which node)")"

USER node
EXPOSE 80
CMD ["node", "dist-server/index.js"]
