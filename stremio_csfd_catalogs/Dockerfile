ARG BUILD_FROM=ghcr.io/home-assistant/aarch64-base:latest
FROM ${BUILD_FROM}

WORKDIR /app

RUN apk add --no-cache \
    nodejs \
    npm

COPY package*.json ./
RUN npm install --omit=dev --no-fund --no-audit

COPY . .

RUN chmod a+x /app/run.sh

CMD [ "/app/run.sh" ]
