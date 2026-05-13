ARG BUILD_ARCH
FROM devlikeapro/waha:latest-2026.4.3 AS base_amd64
FROM devlikeapro/waha:arm-2026.4.3 AS base_aarch64
FROM base_${BUILD_ARCH}

COPY run.sh /run.sh
COPY render-env.js /render-env.js

RUN chmod +x /run.sh \
    && sed -i 's/\r$//' /run.sh \
    && mkdir -p /data/sessions /data/media

ENTRYPOINT ["/run.sh"]
