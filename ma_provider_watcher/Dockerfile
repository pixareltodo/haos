ARG BUILD_FROM
FROM $BUILD_FROM

RUN apk add --no-cache bash curl docker-cli python3

RUN mkdir -p /provider/ytmusic_free \
    && curl -fsSL https://raw.githubusercontent.com/sproft/music-assistant-ytmusic/main/ytmusic_free/__init__.py -o /provider/ytmusic_free/__init__.py \
    && curl -fsSL https://raw.githubusercontent.com/sproft/music-assistant-ytmusic/main/ytmusic_free/manifest.json -o /provider/ytmusic_free/manifest.json

COPY provider_config_sync.py /provider/provider_config_sync.py
COPY run.sh /run.sh

RUN chmod +x /run.sh /provider/provider_config_sync.py && sed -i 's/\r//' /run.sh /provider/provider_config_sync.py

ENTRYPOINT ["/run.sh"]
