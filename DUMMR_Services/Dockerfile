# Build Stage
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
ARG REACT_APP_API_URL=https://api.dummr.services
ENV REACT_APP_API_URL=$REACT_APP_API_URL

RUN npm run build

# Production Stage with Nginx
FROM nginx:1.25-alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
