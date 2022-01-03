# docker file based on the following tutorial :
# https://blog.logrocket.com/containerized-development-nestjs-docker/

# Build step
FROM node:12-alpine as builder
WORKDIR /app

# Copy package and package-lock.json file for modules installation
COPY /package.json /package-lock.json ./

# Run modules installation
RUN npm ci

# copy the rest of the app
COPY / .

RUN npm run build

## Second Stage : Setup command to run your app using lightweight node image
FROM node:12-alpine
WORKDIR /app

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


# Set UTC timezone for the docker
ENV TZ=UTC

COPY --from=builder /app/package.json /app/package-lock.json ./

# dependency are needed and there are not build in chunck
RUN npm ci --production

# copy dist
COPY --from=builder /app/dist/ ./dist

EXPOSE 3001
CMD ["node", "dist/main"]


