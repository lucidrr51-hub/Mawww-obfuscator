FROM node:20-slim

RUN apt-get update && apt-get install -y \
    git \
    luajit \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Clone Prometheus (obfuscator Lua-native)
RUN git clone --depth 1 https://github.com/prometheus-lua/Prometheus.git /app/Prometheus

COPY package.json ./
RUN npm install --production

COPY . .

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
