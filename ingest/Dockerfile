# node:20.11.1-bookworm-slim linux/amd64 (thinkstation is x86_64).
# Pinned on first thinkstation pull the same way pgsync/Dockerfile does.
FROM node:20.11.1-bookworm-slim@sha256:357deca6eb61149534d32faaf5e4b2e4fa3549c2be610ee1019bf340ea8c51ec AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY src ./src
RUN npm ci && npm run build && npm prune --omit=dev

FROM node:20.11.1-bookworm-slim@sha256:357deca6eb61149534d32faaf5e4b2e4fa3549c2be610ee1019bf340ea8c51ec
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
# Host checkout is NFS with 0660 ACLs; USER node must be able to read the tree.
RUN chmod -R a+rX /app
USER node
CMD ["node", "dist/index.js"]
