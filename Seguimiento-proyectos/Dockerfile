# Etapa 1: compilar la SPA de Quasar
FROM node:22-bookworm-slim AS compilacion
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
ARG API_URL=/api
ENV API_URL=${API_URL}
RUN npx quasar build

# Etapa 2: servir los archivos estáticos con Nginx
FROM nginx:1.27-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=compilacion /app/dist/spa /usr/share/nginx/html
EXPOSE 80
