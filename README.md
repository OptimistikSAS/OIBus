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

More information on [OIBus homepage](https://optimistik.io/oibus)

## History
# 0.7.3
**OIBus is changing into an open source license. EUPL V1.2**
## Improvements 
- Modbus South Handler has been refreshed and tested.
- Logger is now giving the filename and the line number
- Each Handler can now specify is own level of log (Error, Warning, ...) or default to same level as the Engine.
## Fixes
- Alive Signal online help has been clarified
- CSV import/export has been refactored

# 0.7.2
- same as 0.7.1 (publish error)
# 0.7.1
## Improvements
- UI improvements to insure unicity of scanModes and scanGroups
- North OIAnalyticsFile (renamed into OIAnalytics) nows supports both files and values. Configuration has also been simplified.
- Ability to duplicate a South
- Improvements to MQTT South that can now handle messages with array of values and more flexibility to identify the timestamp, value and quality in the payload.
- Simplify developement of South by adding method for the config dB.
- OPCUA now read SourceTimeStamp by default and fallback on ServerTimeStamp (can still ignore them and use OIBus for the timestamp per config)

## Fixes
- new HDAAgent allowing bulk export of tag names containing / or \ in the name
- minor visual improvements and package updates.
# 0.7.0
## Improvements
- support for nodejs 14.x
- easier entry of scanModes
- Buttons added to Heath screen for start and shutdown
- Two new endpoints to Engine: /restart and /shutdown
## Fixes
- Input field to a newly added points was not easily accessible for large lists
- Fix issue with compressed filenames
- TimescaleDB south was rewritten.
- OPCUA timestamp has been corrected to ISO (was UTC)
  
# 0.6.5
## Improvements
- FolderScanner and SQLDbToFile can now compress files before moving them to the Engine.

# 0.6.4
## Improvements
- OIConnect now support files in addition to values.
- OIBus can now subscribe to external south (connected by OIConnect)
## Fixes
- Fix issue when OPC-HDA try to recover a large date range on startup
# 0.6.3
## Fixes
- Fix issue when encryption not available on older mssql versions
## Improvements
- MQTT North now can build topic based on pointId (with a regexp)

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
