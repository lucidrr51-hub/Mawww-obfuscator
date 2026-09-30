# Gunakan image LuaJIT sebagai base
FROM ghcr.io/luajit/luajit:latest

# Install Node.js, npm, git, curl
RUN apt-get update && apt-get install -y \
    nodejs \
    npm \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Clone Prometheus
RUN git clone https://github.com/prometheus-lua/Prometheus.git /app/Prometheus

# Copy package.json & install dependencies
COPY package.json ./
RUN npm install --production

# Copy semua file proyek
COPY . .

EXPOSE 3000

CMD ["node", "server.js"]
