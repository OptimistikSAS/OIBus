# OIBus
| master      | ![master](https://github.com/OptimistikSAS/OIBus/workflows/Node%20CI/badge.svg)      |
| ----------- | ----------- |
| **release**   | ![](https://github.com/OptimistikSAS/OIBus/workflows/Node%20CI/badge.svg?branch=release)        |

## Overall workflow

* The Engine is what holds everything together : its start method is like a pseudo-constructor, it creates and then stores every Protocol, Application that will be used to receive and treat the data.

* The index reads the config file, instanciates the unique Engine and runs its start method which will also create the CronJobs to call the onScan() methods on the right time and for the right points.

* The onScan() methods are what run the services : protocols' onScan() will make the data requests to the right data sources and store it in the queues ; applications' onScan will retrieve the data in their own queue to treat it however they need to.

## Build and deploy step

* To buid the client and the executable for each distribution run `npm run build`

* To release (should be run on the release branch after correct merge) run `npm version {major | minor |patch}` this will trigger a full build zip the content of each distribution folder and upload in S3 (you should have s3 credentials properly configured on the build machine) 

## History

# 0.6.0
- add Alive and version to Overview page
- Allow access to points configuration from South pages
- Refreshed MQTT South including allowing topics with wildcards
- Refreshed OPCUA South
- Completed unit tests for front-end
- Added MongoDB North (limited release)
- Added MQTT North (limited release)
- Refreshed InfluxDB North

# 0.5.8
- Include Oracle drivers in distribution
- Fix issue with Preserve attributes in FolderScanner

# 0.5.7
- new HDA agent

# 0.5.6 
- Generalize breadcumb menus
- Allow SQLServer authentication with nlm

# 0.5.5
- Activation screen now allows to browse the active and the new Json configuration
- Alive Signal has been added to the Engine
- Improve CSV import for points
- Several fixes or minor improvements
- Add Oracle support for SQL South.
- Add Verbose option to Console North