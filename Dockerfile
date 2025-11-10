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


# Install docker
RUN apt-get update && apt-get -y install \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    sudo

RUN  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

RUN echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
RUN apt-get update && apt-get -y install docker-ce docker-ce-cli containerd.io


# Install node js
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
ENV NVM_DIR=/root/.nvm
RUN . "$NVM_DIR/nvm.sh" && nvm install ${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm use v${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm alias default v${NODE_VERSION}
ENV PATH="/root/.nvm/versions/node/v${NODE_VERSION}/bin/:${PATH}"

# Install rclone,  unzip and pciutils (useful for lspci command)
RUN apt install rclone=${CUSTOM_RCLONE_VERSION} -y && \
    apt install unzip -y && \
    apt install pciutils -y


# Set UTC timezone for the docker
ENV TZ=UTC

COPY --from=builder /lab-manager/package.json /lab-manager/package-lock.json ./

# set the version of the app form the arg of build
ARG LAB_MANAGER_VERSION
ENV LAB_MANAGER_VERSION=${LAB_MANAGER_VERSION}

# dependency are needed and there are not build in chunck
RUN npm ci --production

# copy dist
COPY --from=builder /lab-manager/dist/ ./dist

RUN chmod -R 777 dist/assets

# Create non-root user matching host ubuntu user
ARG USER_ID=1000
ARG GROUP_ID=1000
ARG DOCKER_GID=999

# Create docker group with host's docker GID and add user to it
RUN groupadd -g ${DOCKER_GID} docker_host || true && \
    groupadd -g ${GROUP_ID} labuser && \
    useradd -m -u ${USER_ID} -g ${GROUP_ID} -G ${DOCKER_GID} -s /bin/bash labuser && \
    chown -R labuser:labuser /lab-manager && \
    # enable sudo for labuser without password
    echo "labuser ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers

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

USER labuser

EXPOSE 3010
CMD ["node", "dist/main"]

