# OIBus developer handbook

### Steps to try out the application:

- Clone the repository
- Run command `npm install` in project root
- Run command `npm run build-client` (creates a build folder for the frontend bundle javascript files) 
- Run command `npm run start` (this will start both the backend and frontend)
- Open up in the browser the following url: `http://localhost:2223`. The port is specified in the `defaultConfig.json` file (currently 2223 is the default, it can be changed locally in your own config file generated at project startup)

The project is up and running, but currently there are no south or north is specified.
A simple way to try out the functionality is to create a `FolderScanner` south data source and a `Console` north application. The folder scanner scans the content of the given path (in the tests folder) periodically and sends the changes to the console.

### Run database servers

With the help of the docker-compose file, we can run a few databases by one command.
- Open a terminal in the `local-deleopment` folder
- Run command `docker-compose --env-file ./.env.dev up`
The following services will start: **mysql, mssql, postgresql, mongodb, timescaledb, influxdb, rabbitmq, mosquitto**.
If you want to change the credentials or the ports for the services, you can create your own `.env` file that won't be pushed to the repository. Note that in this case you will need to replace the environment file path to `./.env` in the command above.

#### Seed databases with random data

Once you have run the docker compose, you can check if the services are running correctly by connecting to them with a client (TablePro, Sequel Pro, MongoDB Compass etc.) using the credentials from the env file. 
If the connection can be established then we can seed the databases. The seeder can be run with the following command from the `database-seeder` folder: `node seed-db.js db=<database-type>`, where the `<database-type>` attribute should be changed to one of the following types: **mysql, mssql, postgresql, oracle**. This will create a table in the database (if it does not exist already) containing a temperature field, and seed random temperature value in every second until you stop the script. If some error is logged, take a look at your connection credentials, the issue may be there.   

### Commit and branch naming conventions

The default branch is `develop`, every new branch should be created from here.

Branch naming convention: **descriptive-name-of-the-issue#\<issue-number\>** For example: fix-folder-scanner-path#1564
Commit and PR name convention: https://www.conventionalcommits.org/en/v1.0.0/