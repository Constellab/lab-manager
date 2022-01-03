
# Dockerfile used by the gitlab ci
FROM ubuntu:20.04

# Install docker to run docker commands
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

RUN ls

RUN ls home

RUN ls ~

#RUN ls dist
# dependency are needed and there are not build in chunck
RUN npm install --only=production

# Set UTC timezone for the docker
ENV TZ=UTC

CMD ["node", "dist/main"]
