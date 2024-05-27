# docker file based on the following tutorial :
# https://blog.logrocket.com/containerized-development-nestjs-docker/

# Build step
FROM node:20-alpine3.19 as builder
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
ENV RCLONE_VERSION=1.53.3-4ubuntu1.22.04.2
ENV DOCKER_COMPOSE_VERSION=2.26.1

# Install docker to run docker commands
RUN apt-get update && \
     apt-get install docker.io -y

# Install node js
RUN apt install -y curl
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
ENV NVM_DIR=/root/.nvm
RUN . "$NVM_DIR/nvm.sh" && nvm install ${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm use v${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm alias default v${NODE_VERSION}
ENV PATH="/root/.nvm/versions/node/v${NODE_VERSION}/bin/:${PATH}"

# Install docker compose
https://github.com/docker/compose/releases/download/v2.27.1/docker-compose-Linux-x86_64
https://github.com/docker/compose/releases/download/2.26.1/docker-compose-Linux-x86_64
RUN curl -L "https://github.com/docker/compose/releases/download/v${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
RUN chmod +x /usr/local/bin/docker-compose

# Install rclone,  unzip and pciutils (useful for lspci command)
RUN apt install rclone=${RCLONE_VERSION} -y && \
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

#RUN chmod -R 777 dist/assets

EXPOSE 3010
CMD ["node", "dist/main"]

