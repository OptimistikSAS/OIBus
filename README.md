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

# 0.6.2
## Fixes
- Exceptions in Disk usage are now catched. (issue #766)

# 0.6.1
## Improvements
- Improve Error Management: When a transaction was failing for a logical error (example bad json format), the retry was actually looping on this error blocking the rest of the cache to be transmitted. Now, "logical errors" (as opposed to "communication errors" that will eventually disappears) will be retried a few times but if the error persists, the transaction will be saved to an error table and OIBus will move to the next transaction.
- AliveSignal can now be sent to another OIBus (itself acting as a gateway to OIAnalytics). This is useful when a OIBus is installed on the local industrial network not exposed to Internet directly.
- Alive Signal (as well as the status page) now contains more diagnostic informations such as disk usage, CPU load, etc...
- MQTT North Improvements (qos support, pointId translation to Topic with RegExp).
- MSSQL South can now disable Encryption (not recommended but useful for old SQL installations).
## Fixes
- @Date1 is now replaced by @lastCompletedDate in SQL queries. A migration is included so existing configurations will be moved to this new syntax.
- Validation of the URL was not working in SQLDBtoFile.

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