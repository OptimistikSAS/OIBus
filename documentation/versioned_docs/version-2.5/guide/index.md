---
displayed_sidebar: guideSidebar
sidebar_position: 1
---

# Main concepts
## Open-source, scalable and flexible
OIBus is a lightweight and flexible data collection solution that simplifies data recovery in an industrial environment.
It collects data from a wide variety of sources encountered in the industry and transmits it to target applications 
whether they are on-premises or in the cloud.

OIBus is an open-source solution which allows great flexibility to answer various use cases. Historically developed to 
power the OIAnalytics® solution, Optimistik offers and maintains since 2020 this solution under [(EUPL)
](https://ec.europa.eu/info/european-union-public-licence_en) open-source license. 

It is used by other solution providers who choose to join this initiative so that the collection of data in industry is 
no longer an obstacle to its digitization.

## A streaming solution 
OIBus is built in a modular way with a South (data collection from source systems), a North (transmission to target 
systems) and an Engine (mainly in charge of configuration, orchestration and cache).

![Example banner](@site/static/img/guide/oibus-EN.png)

This structure facilitates the scalability of the solution by concentrating most of the complexity in the Engine. Thus, 
the development of North or South modules is made easier.

## Advanced capabilities
OIBus already supports many industrial data sources and can be enriched thanks to its open-source code.

- **Industrial information systems**: PLCs, supervisions, historians with various protocols (OPCUA-HA, OPCUA-HDA, 
OPC-HDA, TwinCAT ADS, ModBus…)
- **Business information systems**: Access to business information systems by SQL queries (Oracle, Microsoft SQL Server, 
PostgreSQL, MySQL, MariaDB, SQLite…), files retrieval (xls, csv...)
- **IoT Sensors**: Subscribe to IoT messaging services (MQTT, API...)

OIBus also supports many application targets which can be extended as needed.
- **SaaS Applications**: OIAnalytics®, AWS S3, REST API…
- **IoT platforms**: Subscription to IoT messaging services (MQTT, API...)
- **Databases**: InfluxDB, TimeScale DB, MongoDB...

In addition, OIBus has been designed to withstand large loads and is used on many industrial sites with data streams 
ranging from 10 to 10,000 points with second-scale precision.

Overall, OIBus can manage:
- Reliable, secure and optimized communications
- Store and forward so as not to miss any data
- Communications secured by HTTPS
- Data compression
- Tunneling and proxy management
