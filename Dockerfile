# syntax=docker/dockerfile:1.6

# docker file based on the following tutorial :
# https://blog.logrocket.com/containerized-development-nestjs-docker/

# Build step
FROM oven/bun:1.3.14-alpine AS builder
WORKDIR /lab-manager

# Copy package.json and bun lockfile for modules installation
COPY /package.json /bun.lock ./

# Run modules installation (reproducible: fail if lockfile is out of date)
RUN bun install --frozen-lockfile

# copy the rest of the app
COPY . .

RUN bun run build

## Second Stage : Setup command to run your app using lightweight node image
FROM ubuntu:24.04
WORKDIR /lab-manager

ENV BUN_VERSION=1.3.14
# do not name RCLONE_VERSION as it is a reserved name
ENV CUSTOM_RCLONE_VERSION=1.60.1+dfsg-3ubuntu0.24.04.6
ENV DOCKER_COMPOSE_VERSION=2.26.1


# Install docker and dependencies
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    rm -f /etc/apt/apt.conf.d/docker-clean && \
    sed -i 's|http://archive.ubuntu.com|http://azure.archive.ubuntu.com|g; s|http://security.ubuntu.com|http://azure.archive.ubuntu.com|g' /etc/apt/sources.list.d/ubuntu.sources && \
    apt-get update && apt-get -y install \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    sudo

RUN curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Install docker engine and docker cli
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null && \
    apt-get update && apt-get -y install docker-ce docker-ce-cli containerd.io


# Install rclone, unzip and pciutils (useful for lspci command).
# unzip is also required by the bun install step below.
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get update && \
    apt-get install -y rclone=${CUSTOM_RCLONE_VERSION} unzip pciutils

# Install bun directly from official binaries.
# The runtime base is glibc (ubuntu), so we fetch the glibc build
# (bun-linux-x64), not the musl variant used by the alpine builder image.
RUN curl -fsSL https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-linux-x64.zip -o /tmp/bun.zip && \
    unzip -q /tmp/bun.zip -d /tmp/bun && \
    mkdir -p /usr/local/lib/bun && \
    mv /tmp/bun/bun-linux-x64/bun /usr/local/lib/bun/bun && \
    rm -rf /tmp/bun.zip /tmp/bun && \
    chmod +x /usr/local/lib/bun/bun && \
    ln -s /usr/local/lib/bun/bun /usr/local/bin/bun && \
    ln -s /usr/local/lib/bun/bun /usr/local/bin/bunx
ENV PATH="/usr/local/lib/bun:${PATH}"


# Set UTC timezone for the docker
ENV TZ=UTC \
    SHELL=/bin/bash

# Create non-root user. The docker group is resolved at runtime from the
# bind-mounted /var/run/docker.sock GID (see entrypoint.sh), so we don't hardcode it here.
ARG USER_ID=1000
ARG GROUP_ID=1000
ARG LAB_MANAGER_VERSION

# Ubuntu 24.04 ships a default "ubuntu" user/group at UID/GID 1000, which
# collides with our labuser. Remove it before claiming 1000 for labuser.
RUN userdel -r ubuntu 2>/dev/null || true; \
    groupadd -g ${GROUP_ID} labuser && \
    useradd -m -u ${USER_ID} -g ${GROUP_ID} -s /bin/bash labuser && \
    echo "labuser ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers && \
    chown labuser:labuser /lab-manager

# Create volume mount point directories with proper permissions
RUN mkdir -p /app/conf \
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
COPY --from=builder --chown=labuser:labuser /lab-manager/package.json /lab-manager/bun.lock ./

# Switch to labuser for dependency install and copy dist
USER labuser

# Dependencies are needed and are not bundled in chunks
RUN bun install --frozen-lockfile --production

# copy dist
COPY --from=builder --chown=labuser:labuser /lab-manager/dist/ ./dist

# Make assets writable
RUN chmod -R 775 dist/assets

EXPOSE 3010
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["bun", "dist/main"]

