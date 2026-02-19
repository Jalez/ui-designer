FROM node:18

ARG HOST_UID=1000
ARG HOST_GID=1000

# Change the "node" user's UID & GID to match the host user
# Makes sure any mounted files will not become owned by the root
RUN getent group ${HOST_GID} && groupdel $(getent group ${HOST_GID} | cut -d: -f1) || true && \
    groupmod -g ${HOST_GID} node && usermod -u ${HOST_UID} -g ${HOST_GID} node

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

RUN npm run build

EXPOSE 3500
ENTRYPOINT [ "npm", "start" ]
