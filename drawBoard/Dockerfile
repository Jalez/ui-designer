FROM node:18

ARG HOST_UID=1000
ARG HOST_GID=1000

# Change the "node" user's UID & GID to match the host user
# Makes sure any mounted files will not become owned by the root
RUN getent group ${HOST_GID} && groupdel $(getent group ${HOST_GID} | cut -d: -f1) || true && \
    groupmod -g ${HOST_GID} node && usermod -u ${HOST_UID} -g ${HOST_GID} node

# Force ASCII build output so old docker-compose (1.18) does not crash on Unicode (e.g. Vite checkmark)
ENV LANG=C.UTF-8 LC_ALL=C.UTF-8 CI=1

# Create app directory
WORKDIR /usr/src/app

# Change ownership of the app directory
RUN chown node:node /usr/src/app

# Run as regular user
USER node:node

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package.json .

# RUN npm install -g npm@latest \
#   && npm install

RUN npm install

# Get vulnerability reports
# RUN npm audit

# Bundle app source
COPY . .

# Base path: built assets at /drawboard/assets/...; server strips /drawboard from request path
ENV VITE_BASE_PATH=/drawboard/
ENV BASE_PATH=/drawboard

# Origins allowed to embed and drive the board (comma-separated). The board's own origin is
# always allowed, so this only matters when the app is served from a different origin.
ARG VITE_ALLOWED_PARENT_ORIGINS=
ENV VITE_ALLOWED_PARENT_ORIGINS=$VITE_ALLOWED_PARENT_ORIGINS

# LANG=C prevents Vite from emitting Unicode (e.g. ✓) that crashes docker-compose 1.18
RUN LANG=C npm run build

EXPOSE 3500
ENTRYPOINT [ "npm", "start" ]
