# Lab manager
This app is installed on the lab to manage the server (dockers, backup)

To run the lab manager locally please create the following networks:
```bash
docker network create gencovery-network-dev
docker network create gencovery-network-prod
```

# Local
In local, we recommend to develop this app in a docker container to have a similare environment as the lab.

Here are the steps to setup the docker container:
 - run the docker container ```lab-manager``` from the ```dockerlab``` repository ```dockerlab\local\docker-compose.yml```. ```docker-compose up -d lab-manager```
 - open the vscode in the container
 - clone this repository in ```/home``` folder of the container
 - install the dependencies ```npm install```


To test the dockerfile run : ```docker build -t lab_manager_test .```