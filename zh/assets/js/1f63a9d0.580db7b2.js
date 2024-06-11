"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[4885],{716:(e,n,i)=>{i.r(n),i.d(n,{assets:()=>o,contentTitle:()=>s,default:()=>u,frontMatter:()=>r,metadata:()=>l,toc:()=>c});var a=i(4848),t=i(8453);const r={sidebar_position:5},s="OPCHDA agent",l={id:"guide/advanced/opchda-agent",title:"OPCHDA agent",description:"OIBus embeds an agent used by OIBus to interact with OPC Servers. As a standalone agent, it can also be run through a",source:"@site/versioned_docs/version-v2/guide/advanced/opchda-agent.md",sourceDirName:"guide/advanced",slug:"/guide/advanced/opchda-agent",permalink:"/zh/docs/v2/guide/advanced/opchda-agent",draft:!1,unlisted:!1,tags:[],version:"v2",sidebarPosition:5,frontMatter:{sidebar_position:5},sidebar:"guideSidebar",previous:{title:"OPCHDA COM/DCOM setup",permalink:"/zh/docs/v2/guide/advanced/opchda-dcom"},next:{title:"SQL with ODBC",permalink:"/zh/docs/v2/guide/advanced/sql-with-odbc"}},o={},c=[{value:"ping",id:"ping",level:2},{value:"Usage",id:"usage",level:3},{value:"catalog",id:"catalog",level:2},{value:"Basic usage",id:"basic-usage",level:3},{value:"Includes all and specific file",id:"includes-all-and-specific-file",level:3},{value:"bulk",id:"bulk",level:2},{value:"Basic usage",id:"basic-usage-1",level:3},{value:"With aggregates",id:"with-aggregates",level:3}];function d(e){const n={a:"a",code:"code",em:"em",h1:"h1",h2:"h2",h3:"h3",li:"li",p:"p",pre:"pre",strong:"strong",ul:"ul",...(0,t.R)(),...e.components};return(0,a.jsxs)(a.Fragment,{children:[(0,a.jsx)(n.h1,{id:"opchda-agent",children:"OPCHDA agent"}),"\n",(0,a.jsx)(n.p,{children:"OIBus embeds an agent used by OIBus to interact with OPC Servers. As a standalone agent, it can also be run through a\nCommand Line Interface (CLI)."}),"\n",(0,a.jsx)(n.p,{children:"Because OPC depends on COM/DCOM technology, the agent can be run on Windows only with COM/DCOM\nsettings enabled."}),"\n",(0,a.jsx)(n.p,{children:"OIBusOPCHDA is built in C# with .NET Framework 4.8."}),"\n",(0,a.jsxs)(n.p,{children:["OPC Core components, from OPCFoundation are required to compile and use this library:\n",(0,a.jsx)(n.a,{href:"https://opcfoundation.org/developer-tools/samples-and-tools-classic/core-components/",children:"https://opcfoundation.org/developer-tools/samples-and-tools-classic/core-components/"})]}),"\n",(0,a.jsx)(n.p,{children:"Newtonsoft.Json and CommandLineParser libraries are also required to interact with TCP commands and CLI commands\nrespectively."}),"\n",(0,a.jsx)(n.h1,{id:"hdaagent-standalone",children:"HdaAgent (standalone)"}),"\n",(0,a.jsx)(n.p,{children:"The agent is an executable that requires the following DLLs to run:"}),"\n",(0,a.jsxs)(n.ul,{children:["\n",(0,a.jsx)(n.li,{children:"CommandLine.dll"}),"\n",(0,a.jsx)(n.li,{children:"Newtonsoft.Json.dll"}),"\n",(0,a.jsx)(n.li,{children:"OpcComRcw.dll"}),"\n",(0,a.jsx)(n.li,{children:"OpcNetApi.Com.dll"}),"\n",(0,a.jsx)(n.li,{children:"OpcNetApi.dll"}),"\n"]}),"\n",(0,a.jsx)(n.p,{children:"Several actions are possible:"}),"\n",(0,a.jsxs)(n.ul,{children:["\n",(0,a.jsx)(n.li,{children:"ping: to check connection and gives server information"}),"\n",(0,a.jsx)(n.li,{children:"catalog: to list available tags and store them in a CSV file"}),"\n",(0,a.jsx)(n.li,{children:"bulk: to request history and store it in one file per tag"}),"\n"]}),"\n",(0,a.jsx)(n.p,{children:"The following options are available for all commands:"}),"\n",(0,a.jsx)(n.pre,{children:(0,a.jsx)(n.code,{children:"-h --host                   Host name (or IP address).\n-s --server                 HDA Server name (ex: Matrikon.OPC.Simulation.1)\n-l --consoleLevel           Verbosity level for Console (error, warning, info, debug, trace). Default debug\n-x --fileLevel              Verbosity level for File (error, warning, info, debug, trace). Default debug\n"})}),"\n",(0,a.jsx)(n.h2,{id:"ping",children:"ping"}),"\n",(0,a.jsx)(n.p,{children:"The following option is available:"}),"\n",(0,a.jsx)(n.pre,{children:(0,a.jsx)(n.code,{children:"-i --infos              Display supported aggregates and attributes from the server. Default: false\n"})}),"\n",(0,a.jsx)(n.h3,{id:"usage",children:"Usage"}),"\n",(0,a.jsx)(n.pre,{children:(0,a.jsx)(n.code,{children:".\\HdaAgent.exe ping -h localhost -s Matrikon.OPC.Simulation -i\n"})}),"\n",(0,a.jsxs)(n.p,{children:["The ping command with the ",(0,a.jsx)(n.em,{children:"-i"})," option returns three messages from the Matrikon simulation server:"]}),"\n",(0,a.jsx)(n.p,{children:(0,a.jsx)(n.strong,{children:"Status infos:"})}),"\n",(0,a.jsx)(n.pre,{children:(0,a.jsx)(n.code,{children:'{\n    "VendorInfo": "Matrikon Inc +1-780-945-4011 http://www.matrikonopc.com",\n    "ProductVersion": "1.7.7433",\n    "ServerState": 1,\n    "StatusInfo": "",\n    "StartTime": "2022-05-16T14:27:46.3709266+00:00",\n    "CurrentTime": "2022-08-02T09:18:29.5739742+00:00",\n    "MaxReturnValues": 0\n}\n'})}),"\n",(0,a.jsx)(n.p,{children:(0,a.jsx)(n.strong,{children:"Supported aggregates"})}),"\n",(0,a.jsx)(n.pre,{children:(0,a.jsx)(n.code,{children:'[\n    {\n        "ID": 1,\n        "Name": "INTERPOLATIVE",\n        "Description": "Retrieve interpolated values."\n    },\n    {\n        "ID": 4,\n        "Name": "TIMEAVERAGE",\n        "Description": "Retrieve the time weighted average data over the resample interval."\n    },\n    {\n        "ID": 7,\n        "Name": "MINIMUMACTUALTIME",\n        "Description": "Retrieve the minimum value in the resample interval and the timestamp of the minimum value."\n    },\n    {\n        "ID": 8,\n        "Name": "MINIMUM",\n        "Description": "Retrieve the minimum value in the resample interval."\n    },\n    {\n        "ID": 9,\n        "Name": "MAXIMUMACTUALTIME",\n        "Description": "Retrieve the maximum value in the resample interval and the timestamp of the maximum value."\n    },\n    {\n        "ID": 10,\n        "Name": "MAXIMUM",\n        "Description": "Retrieve the maximum value in the resample interval."\n    }\n]\n'})}),"\n",(0,a.jsx)(n.p,{children:(0,a.jsx)(n.strong,{children:"Supported types:"})}),"\n",(0,a.jsx)(n.pre,{children:(0,a.jsx)(n.code,{children:'[\n    {\n        "ID": 1,\n        "Name": "DATA_TYPE",\n        "Description": "Data type",\n        "DataType": "System.Int16, mscorlib, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089"\n    },\n    {\n        "ID": 2,\n        "Name": "DESCRIPTION",\n        "Description": "Item Description",\n        "DataType": "System.String, mscorlib, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089"\n    },\n    {\n        "ID": 11,\n        "Name": "NORMAL_MAXIMUM",\n        "Description": "High EU",\n        "DataType": "System.Double, mscorlib, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089"\n    },\n    {\n        "ID": 12,\n        "Name": "NORMAL_MINIMUM",\n        "Description": "Low EU",\n        "DataType": "System.Double, mscorlib, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089"\n    },\n    {\n        "ID": 13,\n        "Name": "ITEMID",\n        "Description": "Item ID",\n        "DataType": "System.String, mscorlib, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089"\n    },\n    {\n        "ID": -5,\n        "Name": "TRIANGLE",\n        "Description": "Triangle Wave",\n        "DataType": "Opc.Type, OpcNetApi, Version=2.1.0.0, Culture=neutral, PublicKeyToken=9a40e993cbface53"\n    },\n    {\n        "ID": -4,\n        "Name": "SQUARE",\n        "Description": "Square Wave",\n        "DataType": "Opc.Type, OpcNetApi, Version=2.1.0.0, Culture=neutral, PublicKeyToken=9a40e993cbface53"\n    },\n    {\n        "ID": -3,\n        "Name": "SAWTOOTH",\n        "Description": "Saw-toothed Wave",\n        "DataType": "Opc.Type, OpcNetApi, Version=2.1.0.0, Culture=neutral, PublicKeyToken=9a40e993cbface53"\n    },\n    {\n        "ID": -2,\n        "Name": "RANDOM",\n        "Description": "Random",\n        "DataType": "Opc.Type, OpcNetApi, Version=2.1.0.0, Culture=neutral, PublicKeyToken=9a40e993cbface53"\n    },\n    {\n        "ID": -1,\n        "Name": "BUCKET",\n        "Description": "Bucket Brigade",\n        "DataType": "Opc.Type, OpcNetApi, Version=2.1.0.0, Culture=neutral, PublicKeyToken=9a40e993cbface53"\n    }\n]\n'})}),"\n",(0,a.jsx)(n.h2,{id:"catalog",children:"catalog"}),"\n",(0,a.jsx)(n.p,{children:"HdaAgent Catalog creates a csv file catalog.csv using the browse API."}),"\n",(0,a.jsx)(n.p,{children:"The program displays information about the server (API ServerStatus), Aggregates (getAggregates)\nand Attributes (getAttributes) as JSON string in the console."}),"\n",(0,a.jsx)(n.p,{children:"The following options are available:"}),"\n",(0,a.jsx)(n.pre,{children:(0,a.jsx)(n.code,{children:"-i --includesAll        Includes all Items in the server (i.e. folders). Default: false\n-f --file               Name of the output folder. Default: catalog.csv\n"})}),"\n",(0,a.jsx)(n.h3,{id:"basic-usage",children:"Basic usage"}),"\n",(0,a.jsx)(n.p,{children:(0,a.jsx)(n.code,{children:".\\HDAAgent.exe catalog -h localhost -s Matrikon.OPC.Simulation"})}),"\n",(0,a.jsx)(n.pre,{children:(0,a.jsx)(n.code,{children:'Name,Address\n"ArrayOfReal8","Bucket Brigade.ArrayOfReal8"\n"ArrayOfString","Bucket Brigade.ArrayOfString"\n...\n'})}),"\n",(0,a.jsx)(n.h3,{id:"includes-all-and-specific-file",children:"Includes all and specific file"}),"\n",(0,a.jsx)(n.p,{children:(0,a.jsx)(n.code,{children:".\\HDAAgent.exe catalog -h localhost -s Matrikon.OPC.Simulation --includesAll --file myFile.csv"})}),"\n",(0,a.jsx)(n.pre,{children:(0,a.jsx)(n.code,{children:'Name,Address,isItem\n"Root","",False\n"Simulation Items,"Simulation Items",False\n"Bucket Brigade","Bucket Brigade",False\n"ArrayOfReal8","Bucket Brigade.ArrayOfReal8",True\n"ArrayOfString","Bucket Brigade.ArrayOfString",True\n...\n'})}),"\n",(0,a.jsx)(n.h2,{id:"bulk",children:"bulk"}),"\n",(0,a.jsx)(n.p,{children:"The following options are available:"}),"\n",(0,a.jsx)(n.pre,{children:(0,a.jsx)(n.code,{children:"-b --startTime          Start Time of the history      \n-e --endTime            End Time of the history\n-d --delay              Throttle: add a delay between requests to minimize load on HDA Servers (in ms)\n-m --max                Maximum number of values returned in a request. Defaut 0 (no maximum)\n-o --output             Name of the output folder. Default current folder\n-c --catalog            Name of the catalog file listing the tags\n-a --aggregate          Aggregate value. RAW=0, TOTAL=2, AVERAGE=3, MINIMUM=8, MAXIMUM=10, START=11, END=12. Default 0\n-i --interval           Interval (in second) if an aggregate is requested\n"})}),"\n",(0,a.jsx)(n.h3,{id:"basic-usage-1",children:"Basic usage"}),"\n",(0,a.jsxs)(n.p,{children:["Request raw values from ",(0,a.jsx)(n.em,{children:"Matrikon.OPC.Simulation"})," server located on ",(0,a.jsx)(n.em,{children:"localhost"}),", for points listed in catalog.csv between\n2022-01-01 00:00:00 and 2022-02-01 00:00:00."]}),"\n",(0,a.jsx)(n.pre,{children:(0,a.jsx)(n.code,{children:'.\\HdaAgent.exe bulk -h localhost -s Matrikon.OPC.Simulation -c catalog.csv -b "2022-01-01 00:00:00" -e "2022-02-01 00:00:00" -a 0\n'})}),"\n",(0,a.jsx)(n.h3,{id:"with-aggregates",children:"With aggregates"}),"\n",(0,a.jsxs)(n.p,{children:["Request by group intervals of 60s (",(0,a.jsx)(n.em,{children:"-i 60"}),") the last value (",(0,a.jsx)(n.em,{children:"-a 12"}),") of each group for points listed in catalog.csv from\n",(0,a.jsx)(n.em,{children:"Matrikon.OPC.Simulation"})," server located on ",(0,a.jsx)(n.em,{children:"localhost"}),", between  2022-01-01 00:00:00 and 2022-02-01 00:00:00. Display all logs in the console with trace"]}),"\n",(0,a.jsx)(n.pre,{children:(0,a.jsx)(n.code,{children:'.\\HdaAgent.exe bulk -h localhost -s Matrikon.OPC.Simulation -c catalog.csv -b "2022-01-01 00:00:00" -e "2022-02-01 00:00:00" -a 12 -i 60 -l trace\n'})}),"\n",(0,a.jsx)(n.h1,{id:"hdaagent-with-oibus",children:"HdaAgent (with OIBus)"}),"\n",(0,a.jsxs)(n.p,{children:["OIBus communicates with the HdaAgent through a TCP communication. See ",(0,a.jsx)(n.a,{href:"/zh/docs/v2/guide/south-connectors/opchda",children:"OIBus OPCHDA documentation"})," for more information."]})]})}function u(e={}){const{wrapper:n}={...(0,t.R)(),...e.components};return n?(0,a.jsx)(n,{...e,children:(0,a.jsx)(d,{...e})}):d(e)}},8453:(e,n,i)=>{i.d(n,{R:()=>s,x:()=>l});var a=i(6540);const t={},r=a.createContext(t);function s(e){const n=a.useContext(r);return a.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function l(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(t):e.components||t:s(e.components),a.createElement(r.Provider,{value:n},e.children)}}}]);