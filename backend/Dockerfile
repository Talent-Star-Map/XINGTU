# 锁 bookworm (deb12) — aliyun trixie (deb13) 镜像未同步 Packages 会 404
FROM python:3.12-bookworm

# apt 换清华镜像源（aliyun 的 CDN 节点偶发连不上，tuna 更稳）
# 兼容 deb822 格式(bookworm 的 debian.sources)与旧版 sources.list
RUN for f in /etc/apt/sources.list.d/debian.sources /etc/apt/sources.list; do \
      if [ -f "$f" ]; then \
        sed -i 's@deb.debian.org@mirrors.tuna.tsinghua.edu.cn@g; s@security.debian.org@mirrors.tuna.tsinghua.edu.cn@g' "$f"; \
      fi; \
    done

# 简历导出 PDF 需要的系统依赖:
#   - chromium: 浏览器二进制
#   - fonts-noto-cjk + fonts-wqy-microhei: 中文字体(模板里有大量中文)
#   - libnss3 / libatk / libdrm 等:Chromium 运行时需要的动态库
# 见 backend/services/resume_export.py
RUN DEBIAN_FRONTEND=noninteractive apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 update \
 && DEBIAN_FRONTEND=noninteractive apt-get -o Acquire::Retries=3 -o Acquire::http::Timeout=30 install -y --no-install-recommends \
    chromium fonts-noto-cjk fonts-wqy-microhei fonts-wqy-zenhei \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
    libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    antiword libreoffice-writer-nogui libgl1 libglib2.0-0 \
 && rm -rf /var/lib/apt/lists/*

# LibreOffice 为原始 .doc/.docx 附件提供本机 PDF 预览，保留版式和表格。

ENV CHROMIUM_PATH=/usr/bin/chromium \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
COPY requirements.txt runtime-constraints.txt ./
# pip 走国内镜像，避免下载慢/挂死
RUN pip install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ -r requirements.txt -c runtime-constraints.txt
COPY . .
EXPOSE 8081
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8081"]
