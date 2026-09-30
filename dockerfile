# ============================================================
# Mawww Obfuscator — Dockerfile untuk Railway
# ============================================================
FROM node:20-slim

# Install dependencies: git, curl, build tools, dan LuaJIT
RUN apt-get update && apt-get install -y \
    git \
    curl \
    build-essential \
    libreadline-dev \
    && rm -rf /var/lib/apt/lists/*

# Install LuaJIT dari source
RUN curl -L https://github.com/LuaJIT/LuaJIT/archive/refs/tags/v2.1.0-beta3.tar.gz -o luajit.tar.gz \
    && tar -xzf luajit.tar.gz \
    && cd LuaJIT-2.1.0-beta3 \
    && make && make install \
    && cd .. && rm -rf LuaJIT-2.1.0-beta3 luajit.tar.gz \
    && ln -sf /usr/local/bin/luajit-2.1.0-beta3 /usr/local/bin/luajit

WORKDIR /app

# Clone Prometheus
RUN git clone https://github.com/prometheus-lua/Prometheus.git /app/Prometheus

# Copy package.json dan install dependencies
COPY package.json ./
RUN npm install --production

# Copy semua file project
COPY . .

# Railway inject PORT — pastikan server.js menggunakan process.env.PORT
ENV PORT=3000
EXPOSE 3000

# Start command
CMD ["node", "server.js"]
