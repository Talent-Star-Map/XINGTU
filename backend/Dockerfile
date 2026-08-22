FROM python:3.12-slim

# 简历导出 PDF 需要的系统依赖:
#   - chromium: 浏览器二进制
#   - fonts-noto-cjk + fonts-wqy-microhei: 中文字体(模板里有大量中文)
#   - libnss3 / libatk / libdrm 等:Chromium 运行时需要的动态库
# 见 backend/services/resume_export.py
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium fonts-noto-cjk fonts-wqy-microhei fonts-wqy-zenhei \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    && rm -rf /var/lib/apt/lists/*

ENV CHROMIUM_PATH=/usr/bin/chromium \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8081
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8081"]
