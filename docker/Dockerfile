FROM python:3.11-slim

WORKDIR /app

# 安装 Poetry
RUN pip install --no-cache-dir poetry==1.8.3

# 复制依赖文件
COPY pyproject.toml poetry.lock* ./

# 安装生产依赖（不含 dev）
RUN poetry config virtualenvs.create false \
    && poetry install --only main --no-interaction --no-ansi

# 复制应用代码
COPY app/ ./app/

# 创建 data 目录（宿主机 volume 挂载前的占位）
RUN mkdir -p /app/data

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
