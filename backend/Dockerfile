FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*

# Install dependencies first (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Force bcrypt correct version always
RUN pip install --no-cache-dir bcrypt==4.0.1 passlib==1.7.4

# Copy app code — cache busted by adding build arg
ARG CACHE_BUST=1
COPY . .

EXPOSE 8000
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
