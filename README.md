| master      | ![master](https://github.com/OptimistikSAS/OIBus/workflows/Node%20CI/badge.svg)      |
| ----------- | ----------- |
| **release**   | ![](https://github.com/OptimistikSAS/OIBus/workflows/Node%20CI/badge.svg?branch=release)        |

![](https://github.com/OptimistikSAS/OIBus/blob/master/src/client/OIBus.png)

## What OIBus does
OIBus is an executable (Windows, Linux and MacOS) able to query data from your industrial sources using various protocols (including OPCUA-HA, OPCHDA, Modbus, MQTT) or simply by scanning folders and will send them to your enterprise applications.

**Optimistik** is using **OIBus** on many industrial sites to send data to our **OIAnalytics** solution to query from 10 to over 10.000 points with sampling rate at the second level.

OIBus can be installed and configured in minutes and does not need development skills.

More information on [OIBus homepage](https://optimistik.io/oibus)

## Introduction
* OIBus is intended to simplify the data collection. We felt we had a missing piece between NodeRed and proprietary products for a tool able to solve most of the common requirements for industrial communications and very fast to setup.
 
* OIBus is composed of 3 layers. 
- The **Engine** that orchestrates everything and is configured through an admin interface
- Several **South** handlers that will manage a given protocol (OPCUA, MQTT, Modbus, ...)
- Several **North** handlers that will be able to transfer the information to application such as OIAnalytics, Rest API, Timeseries databases, etc.. 

More information on [OIBus homepage](https://optimistik.io/oibus)

## Build and deploy step
* Fork the OIBus repository
* To buid the client and the executable for each distribution run `npm run build`
* To start the client, run 'npm run start' (or directly one of the distribution with 'npm run start-win', 'npm run start-linux' or 'npm run start-macos'

More information on [OIBus Get Started page](https://optimistik.io/start-with-oibus/)
