---
sidebar_position: 6
---

# SQL with ODBC

## What is ODBC
ODBC stands for Open Database Connectivity. It is a standard application programming interface (API) for accessing 
databases. It was developed by the SQL Access Group in the early 1990s and is now maintained by the Open Data Base 
Connectivity Foundation (ODBC Foundation).

To connect OIBus with a database through ODBC technology, a driver must be installed on the OIBus machine. Each 
database has its own driver. This article will explore how to set up an ODBC connection with a MSSQL database.

## Example with MSSQL ODBC
Microsoft already offers documentation to install its driver on 
[Window](https://learn.microsoft.com/en-us/sql/connect/odbc/windows/microsoft-odbc-driver-for-sql-server-on-windows?view=sql-server-ver16), 
[Linux](https://learn.microsoft.com/en-us/sql/connect/odbc/linux-mac/installing-the-microsoft-odbc-driver-for-sql-server?view=sql-server-ver16) 
and [MacOS](https://learn.microsoft.com/en-us/sql/connect/odbc/linux-mac/install-microsoft-odbc-driver-sql-server-macos?view=sql-server-ver16)

Once the driver installed on the OIBus machine, locate the **ODBC Driver Path** on the SQL connector, and specify the 
Driver path:
 - For macOS, it can be like `/opt/homebrew/lib/libmsodbcsql.18.dylib`
 - For Windows, only the ODBC Driver Name is needed : `ODBC Driver 18 for SQL Server`. You can retrieve the list of 
installed ODBC driver in the ODBC drivers Tab of the Windows ODBC data sources.
