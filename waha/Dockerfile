ARG BUILD_FROM
FROM $BUILD_FROM

COPY run.sh /run.sh
COPY render-env.js /render-env.js

RUN chmod +x /run.sh \
    && sed -i 's/\r$//' /run.sh \
    && mkdir -p /data/sessions /data/media

ENTRYPOINT ["/run.sh"]
