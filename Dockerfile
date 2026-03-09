# Build context: parent directory containing ecto-shared, ecto-core, ecto-client
# docker build -f ecto-client/Dockerfile -t ecto-client .

# Stage 1: Build ecto-shared
FROM node:22-alpine AS shared-builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /build/ecto-shared
COPY ecto-shared/package.json ecto-shared/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY ecto-shared/src ./src
COPY ecto-shared/tsup.config.ts ecto-shared/tsconfig.json ./
RUN pnpm build

# Stage 2: Build ecto-core
FROM node:22-alpine AS core-builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /build/ecto-shared
COPY --from=shared-builder /build/ecto-shared ./
WORKDIR /build/ecto-core
COPY ecto-core/package.json ecto-core/pnpm-lock.yaml ./
RUN sed -i 's|link:../ecto-shared|file:../ecto-shared|g' package.json
RUN pnpm install
COPY ecto-core/src ./src
COPY ecto-core/tsup.config.ts ecto-core/tsconfig.json ./
RUN pnpm build

# Stage 3: Build ecto-client
FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /build/ecto-shared
COPY --from=shared-builder /build/ecto-shared ./
WORKDIR /build/ecto-core
COPY --from=core-builder /build/ecto-core ./
WORKDIR /build/ecto-client
COPY ecto-client/package.json ecto-client/pnpm-lock.yaml ./
RUN sed -i 's|link:../ecto-shared|file:../ecto-shared|g; s|link:../ecto-core|file:../ecto-core|g' package.json
RUN pnpm install
COPY ecto-client/src ./src
COPY ecto-client/index.html ecto-client/vite.config.ts ecto-client/tsconfig.json ecto-client/tsconfig.node.json ./
ARG VITE_CENTRAL_URL=http://localhost:4000
ARG VITE_GATEWAY_URL=
ARG VITE_KLIPY_APP_KEY=
ENV VITE_CENTRAL_URL=$VITE_CENTRAL_URL
ENV VITE_GATEWAY_URL=$VITE_GATEWAY_URL
ENV VITE_KLIPY_APP_KEY=$VITE_KLIPY_APP_KEY
RUN pnpm build

# Stage 3: Serve with nginx
FROM nginx:alpine
COPY --from=builder /build/ecto-client/dist /usr/share/nginx/html
COPY ecto-client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
