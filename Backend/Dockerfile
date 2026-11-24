# Etapa 1: solo dependencias de producción (argon2 trae binario precompilado para glibc)
FROM node:22-bookworm-slim AS dependencias
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Etapa 2: imagen final mínima, sin usuario root
FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencias /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
# Archivos del módulo de documentos: aquí se monta el volumen `adjuntos` (docker-compose). La carpeta
# se crea del usuario node para que el volumen nuevo herede ese dueño y el backend pueda escribir,
# aunque el resto del sistema de archivos sea de solo lectura.
RUN mkdir -p /app/storage && chown node:node /app/storage
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "require('net').connect(3000,'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"
CMD ["node", "src/server.js"]
