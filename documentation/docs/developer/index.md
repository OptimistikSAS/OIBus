---
displayed_sidebar: developerSidebar
sidebar_position: 1
---

# OIBus developer handbook

## Steps to try out the application
- Clone the repository : `git clone `
- Run command `npm install` in project root
- Run command `npm run build:web-client`. It will create a `build/web-client` folder for the frontend bundle. If you edit
the frontend and want to auto-recompile the bundle, you can instead use the command `npm run watch:web-client`.
- Run command `npm start` (this will start both the backend and frontend)
- Open up in the browser the following url: `http://localhost:2223`. The port is specified in the `default-config.json`
file (currently 2223 is the default port, it can be changed locally in your own config file generated at project startup)

The folder `data-folder` is used to store the cache, logs and configuration files.

The project is up and running, but currently there are no South or North connectors. A simple way to try out OIBus is 
to create a `FolderScanner` South connector and a `Console` North connector.


## Run database servers

With the help of the `tests/docker-compose.yml` file, we can run a few databases with the following command: 

`npm run test:setup-env`
 
The following services will start: **mysql, mssql, postgresql**.
If you want to change the credentials or the ports for the services, you can create your own `.env` file that won't be 
pushed to the repository. Note that in this case you will need to replace the environment file path to `./.env` in the
command above (`package.json`).

## Commit and branch naming conventions

The default branch is `main`, every new branches should be created from here. 

Branch naming convention: **descriptive-name-of-the-issue#\<issue-number\>** 

For example: `fix-folder-scanner-path#1564`

Commits and PR name convention must follow the [conventional commits standard](https://www.conventionalcommits.org/en/v1.0.0/)
