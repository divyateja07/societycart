FROM node:24-alpine AS build
WORKDIR /build
COPY package*.json ./
RUN --mount=type=secret,id=system_ca,target=/tmp/system-ca.crt \
    if [ -f /tmp/system-ca.crt ]; then NODE_EXTRA_CA_CERTS=/tmp/system-ca.crt npm ci; else npm ci; fi
COPY . .
RUN npm run build
FROM nginx:1.28-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/dist /usr/share/nginx/html
EXPOSE 80
