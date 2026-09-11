# Для поставки закрепите образы по sha256 digest после проверки в вашем registry.
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG APP_MODE=production
RUN case "$APP_MODE" in production|preprod|development) ;; *) exit 1 ;; esac && npm run typecheck && npx vite build --mode "$APP_MODE"

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
