FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.29-alpine AS web
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

FROM node:24-alpine AS backend
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY api ./api
COPY db ./db

