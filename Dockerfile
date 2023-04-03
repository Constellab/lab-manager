# docker file based on the following tutorial :
# https://blog.logrocket.com/containerized-development-nestjs-docker/

# Build step
FROM node:12-alpine as builder
WORKDIR /lab-manager

# Copy package and package-lock.json file for modules installation
COPY /package.json /package-lock.json ./

# Run modules installation
RUN npm ci

# copy the rest of the app
COPY . .

RUN npm run build

## Second Stage : Setup command to run your app using lightweight node image
FROM ubuntu:20.04
WORKDIR /lab-manager

# Install docker to run docker commands
RUN apt-get update && \
     apt-get install docker.io -y

# Install node js
ENV NODE_VERSION=16.13.0
RUN apt install -y curl
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
ENV NVM_DIR=/root/.nvm
RUN . "$NVM_DIR/nvm.sh" && nvm install ${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm use v${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm alias default v${NODE_VERSION}
ENV PATH="/root/.nvm/versions/node/v${NODE_VERSION}/bin/:${PATH}"

# Install docker compose
RUN curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
RUN chmod +x /usr/local/bin/docker-compose

# Install rclone and unzip
RUN apt install rclone=1.50.2-2ubuntu0.2 -y && \
    apt install unzip -y

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



## Second Stage : Setup command to run your app using lightweight node image
#FROM ubuntu:20.04
#WORKDIR /lab-manager
#
## Install docker to run docker commands
#RUN apt-get update && \
#     apt-get install docker.io -y
#
## Install node js
#ENV NODE_VERSION=16.13.0
#RUN apt install -y curl
#RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
#ENV NVM_DIR=/root/.nvm
#RUN . "$NVM_DIR/nvm.sh" && nvm install ${NODE_VERSION}
#RUN . "$NVM_DIR/nvm.sh" && nvm use v${NODE_VERSION}
#RUN . "$NVM_DIR/nvm.sh" && nvm alias default v${NODE_VERSION}
#ENV PATH="/root/.nvm/versions/node/v${NODE_VERSION}/bin/:${PATH}"
#
## Install docker compose
#RUN curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
#RUN chmod +x /usr/local/bin/docker-compose
#
#
## Set UTC timezone for the docker
#ENV TZ=UTC
#
## Copy package and package-lock.json file for modules installation
#COPY /package.json /package-lock.json ./
#
## Run modules installation
#RUN npm ci
#
## copy the rest of the app
#COPY / .
#
#RUN npm run build
#
#RUN chmod -R 777 dist/assets
#
#EXPOSE 3010
#CMD ["node", "dist/main"]
#

