FROM docker.n8n.io/n8nio/n8n:stable

COPY run.sh /run.sh

USER root
RUN chmod 755 /run.sh

ENTRYPOINT ["/bin/sh", "/run.sh"]
