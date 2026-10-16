FROM python:3.11-slim

# 使用阿里云 Debian 镜像源
RUN sed -i 's@http://deb.debian.org/debian-security@https://mirrors.aliyun.com/debian-security@g; s@http://deb.debian.org/debian@https://mirrors.aliyun.com/debian@g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
    xvfb \
    xauth \
    libnss3 \
    libnspr4 \
    libxfixes3 \
    libxext6 \
    libxrender1 \
    libxrandr2 \
    libxcomposite1 \
    libxdamage1 \
    libxkbcommon0 \
    libxshmfence1 \
    libgbm1 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    fonts-liberation \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir \
    -i https://pypi.tuna.tsinghua.edu.cn/simple \
    -r requirements.txt \
    && pip install --no-cache-dir \
    -i https://pypi.tuna.tsinghua.edu.cn/simple \
    playwright-stealth==1.0.6 \
    neo4j==5.27.0 \
    && PLAYWRIGHT_DOWNLOAD_HOST=https://npmmirror.com/mirrors/playwright \
    playwright install chromium

COPY . .

ENV PYTHONUNBUFFERED=1
ENV DISPLAY=:99

CMD ["python", "-u", "run.py"]
