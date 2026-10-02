FROM node:24-alpine
RUN apk add --no-cache su-exec
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --chown=node:node server ./server
COPY --chown=node:node scripts/lib ./scripts/lib
COPY --chown=node:node dist ./dist
RUN mkdir /data && chown node:node /data
COPY --chmod=755 server/entrypoint.sh /usr/local/bin/usyd-entrypoint
ENV HOST=0.0.0.0 PORT=3000 DATA_DIR=/data
EXPOSE 3000
ENTRYPOINT ["usyd-entrypoint"]
CMD ["node", "server/server.mjs"]
