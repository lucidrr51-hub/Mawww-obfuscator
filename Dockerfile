FROM node:20-bullseye

# System deps
RUN apt-get update && apt-get install -y \
    git \
    lua5.1 \
    luajit \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Node deps first (layer cache)
COPY package*.json ./
RUN npm install --omit=dev

# Clone Prometheus engine
RUN git clone --depth 1 https://github.com/prometheus-lua/Prometheus.git /app/Prometheus

# Copy app
COPY . .

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Healthcheck (Railway also uses /health)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||3000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "server.js"]
