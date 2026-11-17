# Etapa 1: compilar la PWA de Quasar
FROM node:22-bookworm-slim AS compilacion
WORKDIR /app
COPY package.json package-lock.json ./
COPY src-pwa/package.json src-pwa/package-lock.json ./src-pwa/
RUN npm ci --ignore-scripts && npm ci --ignore-scripts --prefix src-pwa
COPY . .
ARG API_URL=/api
ENV API_URL=${API_URL}
RUN npx quasar build -m pwa

# Etapa 2: servir los archivos estáticos con Nginx
FROM nginx:1.27-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/cabeceras-seguridad.conf /etc/nginx/cabeceras-seguridad.conf
COPY --from=compilacion /app/dist/pwa /usr/share/nginx/html
EXPOSE 80 8081
