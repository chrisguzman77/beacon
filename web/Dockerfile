# Builds the Vite app and serves it with nginx on port 80 (deploy/docker-compose.yml builds ../web).
# VITE_* values are baked in at build time; override with --build-arg or compose build.args.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=https://api.omnirisking-it-all-at-swamphacks.us
ARG VITE_AUTH0_DOMAIN=
ARG VITE_AUTH0_CLIENT_ID=
ARG VITE_AUTH0_AUDIENCE=
ARG VITE_MAPTILER_KEY=
ENV VITE_API_URL=$VITE_API_URL VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID VITE_AUTH0_AUDIENCE=$VITE_AUTH0_AUDIENCE VITE_MAPTILER_KEY=$VITE_MAPTILER_KEY
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
