FROM node:lts as installer

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN corepack enable pnpm && \
    pnpm install

FROM installer as builder

COPY . .

RUN pnpm run build

FROM installer as runner

USER node

ENV NODE_ENV=production \
    PORT=8080

EXPOSE ${PORT}

COPY --from=builder /app/dist ./dist

ENTRYPOINT [ "node", "." ]
