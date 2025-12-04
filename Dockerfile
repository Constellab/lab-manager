# docker file based on the following tutorial :
# https://blog.logrocket.com/containerized-development-nestjs-docker/

# Build step
FROM node:20-alpine3.19 AS builder
WORKDIR /lab-manager

# Copy package and package-lock.json file for modules installation
COPY /package.json /package-lock.json ./

# Run modules installation
RUN npm ci

# copy the rest of the app
COPY . .

RUN npm run build

## Second Stage : Setup command to run your app using lightweight node image
FROM ubuntu:22.04
WORKDIR /lab-manager

ENV NODE_VERSION=20.12.2
# do not name RCLONE_VERSION as it is a reserved name
ENV CUSTOM_RCLONE_VERSION=1.53.3-4ubuntu1.22.04.3
ENV DOCKER_COMPOSE_VERSION=2.26.1


# Install docker and dependencies
RUN apt-get update && apt-get -y install \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    sudo && \
    rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Install docker engine and docker cli
RUN echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null && \
    apt-get update && apt-get -y install docker-ce docker-ce-cli containerd.io && \
    rm -rf /var/lib/apt/lists/*


# Install node js directly from official binaries
RUN curl -fsSL https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz -o /tmp/node.tar.xz && \
    mkdir -p /usr/local/lib/nodejs && \
    tar -xJf /tmp/node.tar.xz -C /usr/local/lib/nodejs && \
    rm /tmp/node.tar.xz && \
    ln -s /usr/local/lib/nodejs/node-v${NODE_VERSION}-linux-x64/bin/node /usr/local/bin/node && \
    ln -s /usr/local/lib/nodejs/node-v${NODE_VERSION}-linux-x64/bin/npm /usr/local/bin/npm && \
    ln -s /usr/local/lib/nodejs/node-v${NODE_VERSION}-linux-x64/bin/npx /usr/local/bin/npx
ENV PATH="/usr/local/lib/nodejs/node-v${NODE_VERSION}-linux-x64/bin:${PATH}"

# Install rclone, unzip and pciutils (useful for lspci command)
RUN apt-get update && \
    apt-get install -y rclone=${CUSTOM_RCLONE_VERSION} unzip pciutils && \
    rm -rf /var/lib/apt/lists/*


# Set UTC timezone for the docker
ENV TZ=UTC \
    SHELL=/bin/bash

# Create non-root user matching host ubuntu user
ARG USER_ID=1000
ARG GROUP_ID=1000
ARG DOCKER_GID=999
ARG LAB_MANAGER_VERSION

# Create docker group with host's docker GID and add user to it
RUN groupadd -g ${DOCKER_GID} docker_host || true && \
    groupadd -g ${GROUP_ID} labuser && \
    useradd -m -u ${USER_ID} -g ${GROUP_ID} -G ${DOCKER_GID} -s /bin/bash labuser && \
    # enable sudo for labuser without password
    echo "labuser ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers && \
    chown labuser:labuser /lab-manager

# Create volume mount point directories with proper permissions
RUN mkdir -p /app/conf \
    /app/gws_db/gws_biota/mariadb \
    /app/gws_db/gws_core/prod/mariadb \
    /app/gws_db/gws_core/dev/mariadb \
    /app/prod/lab \
    /app/prod/data \
    /app/dev/lab \
    /app/dev/data && \
    chown -R labuser:labuser /app

# Copy and configure entrypoint script to fix Docker socket permissions at runtime
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Set the version of the app from the arg of the build
ENV LAB_MANAGER_VERSION=${LAB_MANAGER_VERSION}

# Copy files with correct ownership
COPY --from=builder --chown=labuser:labuser /lab-manager/package.json /lab-manager/package-lock.json ./

# Switch to labuser for npm install and copy dist
USER labuser

# Dependencies are needed and are not bundled in chunks
RUN npm ci --production

# copy dist
COPY --from=builder --chown=labuser:labuser /lab-manager/dist/ ./dist

# Make assets writable
RUN chmod -R 775 dist/assets

EXPOSE 3010
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/main"]

