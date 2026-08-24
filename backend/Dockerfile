FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*

# Force cache bust BEFORE everything so all layers rebuild
ARG CACHE_BUST=1
RUN echo "Cache bust: $CACHE_BUST"

# Copy and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Force bcrypt correct version
RUN pip install --no-cache-dir bcrypt==4.0.1 passlib==1.7.4

# Copy app code
COPY . .

EXPOSE 8000
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
