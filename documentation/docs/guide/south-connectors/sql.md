---
sidebar_position: 2
---

# SQL
The SQL connector allows you to run an SQL query at regular intervals and retrieve the results as CSV files.

## Connection to a SQL database
### Driver
Several databases are supported by OIBus:
- MSSQL
- PostgreSQL
- Oracle. This driver requires the local installation of an Oracle Instant Client (Basic or Basic Light, minimal supported version is 18.5.0.0.0)
- MySQL
- SQLite

### Connection 
Several fields are required to connect to a database.

- **Host**: the address of the SQL server
- **Port**: SQL server port
- **Database**: the name of the database to connect to
- **Username**: the username used for authentication
- **Password**: the password used for authentication
- **Domain**: this field is useful for example when the user wishes to connect to an Active Directory domain
- **Database path**: Path of the SQLite file 
- **Encryption**: Encrypt the data between the database and OIBus (can overload the server)

:::tip Database access

Using a read only user to connect to the database is strongly advised.

:::

## SQL Query
The query must follow the syntax of the selected driver. 

### Query variables
Several OIBus variables can be used and will be interpreted according to the selected driver by OIBus.

OIBus manages some variables for the SQL connector. These variables, if used in the query, will be replaced by their 
values.

#### @StartTime
The @StartTime variable initially takes the date of the first execution of the query. When results are retrieved from
the database, @StartTime value is set to the most recent timestamp among those results.

The most recent timestamp is retrieved from the field specified in the _Time column_ field that must match a 
column in the results.

#### @EndTime
The @EndTime variable is set to the current time (_now()_) or to the end of the sub-interval if a query is split.

#### Example
```sql
SELECT * FROM table WHERE timestamp > @StartTime AND timestamp < @EndTime
```


### Splitting large queries
In some cases, a query can be quite heavy for the server, especially if a large time interval is requested. If 
@StartTime and @EndTime query variables are used, the query can be split in several sub-queries with smaller intervals
using the _Max read interval_ field. It gives the length of the smaller intervals (in seconds) the query will be split 
to. If this field is set to 0, queries won't be split.

Additionally, to not overload the server, a delay between sub-queries can be set (in milliseconds) in the _Read interval 
delay_ field.

Each sub-query will result in a specific file and a file name variable can be used.

### Result exportation
The result of each query (or sub-query) will be stored in a CSV file that can be compressed with gunzip (.gz extension).
By default, a comma is used to delimit the CSV columns. However, another delimiter can be chosen.

The _Time column_ field is used to specify which field of the query results contains the timestamp (if needed). If 
identified in the query results, this field will be parsed and associated to the specified _Timezone_ (example: 
Europe/Paris) at the appropriate _Date format_ (example: yyyy-MM-dd HH:mm:ss.SSS).

:::tip Time column

The _Time column_ must match a column returned by the query, not a column in the database Table. For example
`SELECT prod_date AS timestamp` will result timestamp column. So _Time column_ should be set to **timestamp**.

:::

The file name where to store the results can be specified with variables to make it unique, so it is not overwritten by 
another query.

#### @CurrentDate
The date at file creation. The date format is yyyy_MM_dd_HH_mm_ss_SSS.

#### @ConnectorName
The name of the current south connector.

#### @QueryPart
The sub-query part of a big query that has been split by OIBus. If the query is not split, this value will always be 0.

#### Example
Assuming the SQL connector name is _sql_, and that the file will be created on the first of January 2020 at midnight, as 
a result of one query (not split), `@ConnectorName-@CurrentDate-@QueryPart.csv` will yield the following name: 
sql-2020_01_01_00_00_00-0.csv.
