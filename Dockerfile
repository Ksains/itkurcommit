FROM node:22-alpine AS build
WORKDIR /app
COPY index.html server.cjs ./
COPY assets/ assets/
COPY participants/ participants/
COPY scripts/ scripts/
COPY tests/ tests/
RUN node --test tests/test_profiles.cjs tests/test_ui.cjs tests/test_static.cjs && node scripts/build.cjs

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/dist/ ./dist/
COPY scripts/serve.cjs ./serve.cjs
USER node
EXPOSE 8000
CMD ["node", "serve.cjs"]
