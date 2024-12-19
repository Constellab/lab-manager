<p align="center">
  <img src="https://constellab.space/assets/fl-logo/constellab-logo-text-white.svg" alt="Constellab Logo" width="80%">
</p>

<br/>

# 👋 Welcome to Lab manager

`lab-manager` is a [Constellab](https://constellab.io) container developped by [Gencovery](https://gencovery.com/). It configures and manages the containers running inside the data lab.

## 🚀 What is Constellab?

✨ [Gencovery](https://gencovery.com/) is a software company that offers [Constellab](https://constellab.io)., the leading open and secure digital infrastructure designed to consolidate data and unlock its full potential in the life sciences industry. Gencovery's mission is to provide universal access to data to enhance people's health and well-being.

🌍 With our Fair Open Access offer, you can use Constellab for free. [Sign up here](https://constellab.space/). Find more information about the Open Access offer here (link to be defined).

## ✅ Features

This container is one of the first container to be started on the lab. Its role is to configure the lab and to start the others container.

📋 Here is the list of the main features:

- manage the containers
  - `glab` : this is the main app, this run all the python code, the lab and the experiments.
  - `codelab` : this is the dev environment that include the online VsCode
  - `front` : this is the web interface of the lab
  - `gws_core_prod_db` : database for the prod environment
  - `gws_core_dev_deb` : database for the dev envirnonment
  - `test_gws_dev_db` : database that is used when we run tests
  - `gws_biota_db` : biota database
- configure the bricks of the lab
- manage the backup of the lab data

To view more information about the lab architecture [here](https://constellab.community/bricks/gws_core/latest/doc/architecture/7a8ec82f-f9d3-4f22-98cc-ee604a0e6b07)

## 💻 Desktop

🚀 To run a data lab locally you can use the desktop version. The lab manager can be installed to configure and starts the desktop data lab.

Run the following command to start the lab manager for the desktop version:
volumes: # map the named volume to the same path as prod environment - lab-manager-config:/app/conf - lab-manager-prod-db:/app/gws_db/gws_core/prod/mariadb - lab-manager-dev-db:/app/gws_db/gws_core/dev/mariadb - lab-manager-biota:/app/gws_db/gws_biota/mariadb - lab-manager-prod-lab:/app/prod/lab - lab-manager-prod-data:/app/prod/data - lab-manager-dev-lab:/app/dev/lab # share docker socket - /var/run/docker.sock:/var/run/docker.sock

```bash
docker run -d --name lab-manager -e VIRTUAL_HOST=lab-manager.local -e ENVIRONMENT_PROFILE=desktop -e LAB_MANAGER_API_KEY=[SPACE_API_KEY] -e LAB_NAME=[LAB_NAME] -e LAB_ID=[LAB_ID] -v lab-manager-config:/app/conf -v lab-manager-prod-db:/app/gws_db/gws_core/prod/mariadb -v lab-manager-dev-db:/app/gws_db/gws_core/dev/mariadb -v lab-manager-biota:/app/gws_db/gws_biota/mariadb -v lab-manager-prod-lab:/app/prod/lab -v lab-manager-prod-data:/app/prod/data -v lab-manager-dev-lab:/app/dev/lab -v /var/run/docker.sock:/var/run/docker.sock -p 3080:3080 constellab/lab-manager:latest
```

## 📄 Documentation

📄 For `gws_core` brick documentation, click [here](https://constellab.community/bricks/gws_core/latest/doc/getting-started/6efb7ab9-8508-4f99-b3e1-1a43e55755c4)

💫 For Constellab application documentation, click [here](https://constellab.community/bricks/gws_academy/latest/doc/getting-started/b38e4929-2e4f-469c-b47b-f9921a3d4c74)

## 🛠️ Installation

Run the container with the following env variables :

- VIRTUAL_HOST : virtual host defined frmo the space
- LAB_MANAGER_API_KEY : api generate generate from the space
- ENVIRONMENT_PROFILE : prod

## 🤗 Community

🌍 Join the Constellab community [here](https://constellab.community/) to share and explore stories, code snippets and bricks with other users.

🚩 Feel free to open an issue if you have any question or suggestion.

☎️ If you have any questions or suggestions, please feel free to contact us through our website: [Constellab](https://constellab.io/).

## 🌎 License

`lab-manager` is completely free and open-source and licensed under the [GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.en.html).

<br/>

This brick is maintained with ❤️ by [Gencovery](https://gencovery.com/).

<p align="center">
  <img src="https://framerusercontent.com/images/Z4C5QHyqu5dmwnH32UEV2DoAEEo.png?scale-down-to=512" alt="Gencovery Logo"  width="30%">
</p>
