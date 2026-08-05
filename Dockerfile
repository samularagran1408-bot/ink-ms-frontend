# Build de Angular + nginx que sirve la SPA y proxea /api al gateway.
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Angular 17+ (application builder) deja los estáticos en browser/
COPY --from=build /app/dist/fronted-inklusport/browser /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
