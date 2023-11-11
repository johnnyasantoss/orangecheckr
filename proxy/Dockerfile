FROM node:lts

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN corepack enable pnpm && \
    pnpm install

COPY . .

RUN pnpm run build

ENTRYPOINT [ "node", "." ]
