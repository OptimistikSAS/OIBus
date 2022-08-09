---
sidebar_position: 5
---

# OPCHDA agent
OIBus embeds an agent used by OIBus to interact with OPC Servers. As a standalone agent, it can also be run through a
Command Line Interface (CLI).

Because OPC depends on COM/DCOM technology, the agent can be run on Windows only with COM/DCOM
settings enabled.

OIBusOPCHDA is built in C# with .NET Framework 4.8.

OPC Core components, from OPCFoundation are required to compile and use this library:
https://opcfoundation.org/developer-tools/samples-and-tools-classic/core-components/

Newtonsoft.Json and CommandLineParser libraries are also required to interact with TCP commands and CLI commands
respectively.

# HdaAgent (standalone)
The agent is an executable that requires the following DLLs to run:
- CommandLine.dll
- Newtonsoft.Json.dll
- OpcComRcw.dll
- OpcNetApi.Com.dll
- OpcNetApi.dll

Several actions are possible:
- ping: to check connection and gives server information
- catalog: to list available tags and store them in a CSV file
- bulk: to request history and store it in one file per tag

The following options are available for all commands:

````
-h --host                   Host name (or IP address).
-s --server                 HDA Server name (ex: Matrikon.OPC.Simulation.1)
-l --consoleLevel           Verbosity level for Console (error, warning, info, debug, trace). Default debug
-x --fileLevel              Verbosity level for File (error, warning, info, debug, trace). Default debug
````

## ping
The following option is available:
````
-i --infos              Display supported aggregates and attributes from the server. Default: false
````

### Usage
````
.\HdaAgent.exe ping -h localhost -s Matrikon.OPC.Simulation -i
````

The ping command with the _-i_ option returns three messages from the Matrikon simulation server:

**Status infos:**
````
{
    "VendorInfo": "Matrikon Inc +1-780-945-4011 http://www.matrikonopc.com",
    "ProductVersion": "1.7.7433",
    "ServerState": 1,
    "StatusInfo": "",
    "StartTime": "2022-05-16T14:27:46.3709266+00:00",
    "CurrentTime": "2022-08-02T09:18:29.5739742+00:00",
    "MaxReturnValues": 0
}
````

**Supported aggregates**
````
[
    {
        "ID": 1,
        "Name": "INTERPOLATIVE",
        "Description": "Retrieve interpolated values."
    },
    {
        "ID": 4,
        "Name": "TIMEAVERAGE",
        "Description": "Retrieve the time weighted average data over the resample interval."
    },
    {
        "ID": 7,
        "Name": "MINIMUMACTUALTIME",
        "Description": "Retrieve the minimum value in the resample interval and the timestamp of the minimum value."
    },
    {
        "ID": 8,
        "Name": "MINIMUM",
        "Description": "Retrieve the minimum value in the resample interval."
    },
    {
        "ID": 9,
        "Name": "MAXIMUMACTUALTIME",
        "Description": "Retrieve the maximum value in the resample interval and the timestamp of the maximum value."
    },
    {
        "ID": 10,
        "Name": "MAXIMUM",
        "Description": "Retrieve the maximum value in the resample interval."
    }
]
````

**Supported types:**
````
[
    {
        "ID": 1,
        "Name": "DATA_TYPE",
        "Description": "Data type",
        "DataType": "System.Int16, mscorlib, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089"
    },
    {
        "ID": 2,
        "Name": "DESCRIPTION",
        "Description": "Item Description",
        "DataType": "System.String, mscorlib, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089"
    },
    {
        "ID": 11,
        "Name": "NORMAL_MAXIMUM",
        "Description": "High EU",
        "DataType": "System.Double, mscorlib, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089"
    },
    {
        "ID": 12,
        "Name": "NORMAL_MINIMUM",
        "Description": "Low EU",
        "DataType": "System.Double, mscorlib, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089"
    },
    {
        "ID": 13,
        "Name": "ITEMID",
        "Description": "Item ID",
        "DataType": "System.String, mscorlib, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089"
    },
    {
        "ID": -5,
        "Name": "TRIANGLE",
        "Description": "Triangle Wave",
        "DataType": "Opc.Type, OpcNetApi, Version=2.1.0.0, Culture=neutral, PublicKeyToken=9a40e993cbface53"
    },
    {
        "ID": -4,
        "Name": "SQUARE",
        "Description": "Square Wave",
        "DataType": "Opc.Type, OpcNetApi, Version=2.1.0.0, Culture=neutral, PublicKeyToken=9a40e993cbface53"
    },
    {
        "ID": -3,
        "Name": "SAWTOOTH",
        "Description": "Saw-toothed Wave",
        "DataType": "Opc.Type, OpcNetApi, Version=2.1.0.0, Culture=neutral, PublicKeyToken=9a40e993cbface53"
    },
    {
        "ID": -2,
        "Name": "RANDOM",
        "Description": "Random",
        "DataType": "Opc.Type, OpcNetApi, Version=2.1.0.0, Culture=neutral, PublicKeyToken=9a40e993cbface53"
    },
    {
        "ID": -1,
        "Name": "BUCKET",
        "Description": "Bucket Brigade",
        "DataType": "Opc.Type, OpcNetApi, Version=2.1.0.0, Culture=neutral, PublicKeyToken=9a40e993cbface53"
    }
]
````

## catalog
HdaAgent Catalog creates a csv file catalog.csv using the browse API.

The program displays information about the server (API ServerStatus), Aggregates (getAggregates)
and Attributes (getAttributes) as JSON string in the console.

The following options are available:
````
-i --includesAll        Includes all Items in the server (i.e. folders). Default: false
-f --file               Name of the output folder. Default: catalog.csv
````

### Basic usage
`.\HDAAgent.exe catalog -h localhost -s Matrikon.OPC.Simulation`

````
Name,Address
"ArrayOfReal8","Bucket Brigade.ArrayOfReal8"
"ArrayOfString","Bucket Brigade.ArrayOfString"
...
````
### Includes all and specific file
`.\HDAAgent.exe catalog -h localhost -s Matrikon.OPC.Simulation --includesAll --file myFile.csv`

````
Name,Address,isItem
"Root","",False
"Simulation Items,"Simulation Items",False
"Bucket Brigade","Bucket Brigade",False
"ArrayOfReal8","Bucket Brigade.ArrayOfReal8",True
"ArrayOfString","Bucket Brigade.ArrayOfString",True
...
````

## bulk
The following options are available:
````
-b --startTime          Start Time of the history      
-e --endTime            End Time of the history
-d --delay              Throttle: add a delay between requests to minimize load on HDA Servers (in ms)
-m --max                Maximum number of values returned in a request. Defaut 0 (no maximum)
-o --output             Name of the output folder. Default current folder
-c --catalog            Name of the catalog file listing the tags
-a --aggregate          Aggregate value. RAW=0, TOTAL=2, AVERAGE=3, MINIMUM=8, MAXIMUM=10, START=11, END=12. Default 0
-i --interval           Interval (in second) if an aggregate is requested
````
### Basic usage
Request raw values from _Matrikon.OPC.Simulation_ server located on _localhost_, for points listed in catalog.csv between
2022-01-01 00:00:00 and 2022-02-01 00:00:00.
````
.\HdaAgent.exe bulk -h localhost -s Matrikon.OPC.Simulation -c catalog.csv -b "2022-01-01 00:00:00" -e "2022-02-01 00:00:00" -a 0
````
### With aggregates
Request by group intervals of 60s (_-i 60_) the last value (_-a 12_) of each group for points listed in catalog.csv from
_Matrikon.OPC.Simulation_ server located on _localhost_, between  2022-01-01 00:00:00 and 2022-02-01 00:00:00. Display all logs in the console with trace
````
.\HdaAgent.exe bulk -h localhost -s Matrikon.OPC.Simulation -c catalog.csv -b "2022-01-01 00:00:00" -e "2022-02-01 00:00:00" -a 12 -i 60 -l trace
````

# HdaAgent (with OIBus)
OIBus communicates with the HdaAgent through a TCP communication. See [OIBus OPCHDA documentation](docs/guide/south-connectors/opchda.md) for more information.
