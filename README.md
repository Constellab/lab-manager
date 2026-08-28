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

- run the docker container `lab-manager` from the `lab-configurer` repository `lab-configurer\local\docker-compose.yml`. `docker-compose up -d lab-manager`
- open the vscode in the container
- clone this repository in `/home` folder of the container
- install the dependencies `bun install`

To test the dockerfile run : `docker build -t lab-manager-test .`

## Run in local

Once in the docker container you can clone the repository in /home folder. then create the config.json flie in `/app/config/config.json`, here is an example of the config file:

```json
{
  "lab_id": "c223a773-3127-4aa0-b2d4-3ee4cdc3434a",
  "name": "On premise",
  "front_version": "0.5.6",
  "glab_tag": "latest",
  "variables": {},
  "environment": {
    "bricks": [
      {
        "name": "gws_core",
        "version": "0.8.0"
      }
    ],
    "git": [],
    "pip": [],
    "variables": {}
  }
}
```

Then you can run the app with the following command:

```bash
bun run start
```

Then run the configure lab manager route to create files. You can create a local lab named 'localhost' in space to test connexion with the lab manager.
