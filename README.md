![OIBus](src/frontend/oibus.png)

## OIBus
OIBus is an executable (Windows, Linux and Mac) able to query data from your industrial sources using various protocols 
(including OPCUA-HA, OPCHDA, Modbus, MQTT) or simply by scanning folders and will send them to your enterprise 
applications.

[**Optimistik**](https://optimistik.io) is using **OIBus** on many industrial sites to send data to its **OIAnalytics** 
solution to query from 10 to over 10.000 points with sampling rate at the second level.

OIBus [can be installed](https://oibus.optimistik.com/docs/guide/installation) and configured in minutes and does not 
need development skills.

## Introduction
OIBus is intended to simplify the data collection. We, at Optimistik, felt we had a missing piece between NodeRed and 
proprietary products for a tool able to solve most of the common requirements for industrial communications and very 
fast to set up.
 
OIBus is composed of 3 layers. 
- The **Engine** that orchestrates everything and is configured through an admin interface
- Several **South** connectors that will retrieve data from a given technology (SQL, OPCUA, MQTT, Modbus...)
- Several **North** connectors that will be able to transfer the data to application such as OIAnalytics, Rest API,
Timeseries databases, MQTT broker... 

You can know more about OIBus by reading [our documentation](https://oibus.optimistik.com/).

## Build and deploy step
* **Fork** the OIBus repository and clone it. Be sure to have NodeJS and npm installed (LTS versions).
* **Install** the node dependencies : `npm install`
* **Build** the web client used to display the OIBus interface in a web browser : `npm run build:web-client`. If you want to 
modify the web client, you must rebuild it. Alternatively, you can build it on changes with `npm run watch:web-client`.
* **Start** OIBus from source with `npm start`
* You can compile OIBus on your appropriate distribution with `npm run build:win`, `npm run build:linux` or `npm run build:macos`.
* You can start OIBus from its binaries with `npm run start:win`, `npm run start:linux` or `npm run start:macos`.

A more complete developer guide is accessible on [our developer documentation](https://oibus.optimistik.com/docs/developer/).
