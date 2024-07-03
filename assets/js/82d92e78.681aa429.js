"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[442],{4366:(e,t,s)=>{s.r(t),s.d(t,{assets:()=>l,contentTitle:()=>a,default:()=>h,frontMatter:()=>r,metadata:()=>d,toc:()=>o});var i=s(4848),n=s(8453);const r={displayed_sidebar:"useCasesSidebar",sidebar_position:2},a="MSSQL \u2192 Azure Blob",d={id:"use-cases/use-case-mssql",title:"MSSQL \u2192 Azure Blob",description:"Beforehand",source:"@site/docs/use-cases/use-case-mssql.mdx",sourceDirName:"use-cases",slug:"/use-cases/use-case-mssql",permalink:"/docs/use-cases/use-case-mssql",draft:!1,unlisted:!1,tags:[],version:"current",sidebarPosition:2,frontMatter:{displayed_sidebar:"useCasesSidebar",sidebar_position:2},sidebar:"useCasesSidebar",previous:{title:"OPCUA \u2192 OIAnalytics",permalink:"/docs/use-cases/use-case-opcua"},next:{title:"TwinCAT ADS \u2192 OIAnalytics",permalink:"/docs/use-cases/use-case-ads"}},l={},o=[{value:"Beforehand",id:"beforehand",level:2},{value:"South MSSQL",id:"south-mssql",level:2},{value:"SQL Queries",id:"sql-queries",level:3},{value:"Without variable",id:"without-variable",level:4},{value:"With variables",id:"with-variables",level:4},{value:"Date time fields",id:"date-time-fields",level:5},{value:"Serialization",id:"serialization",level:5},{value:"Result",id:"result",level:5},{value:"North Azure Blob",id:"north-azure-blob",level:2}];function c(e){const t={a:"a",admonition:"admonition",code:"code",h1:"h1",h2:"h2",h3:"h3",h4:"h4",h5:"h5",img:"img",li:"li",p:"p",pre:"pre",strong:"strong",ul:"ul",...(0,n.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(t.h1,{id:"mssql--azure-blob",children:"MSSQL \u2192 Azure Blob"}),"\n",(0,i.jsx)(t.h2,{id:"beforehand",children:"Beforehand"}),"\n",(0,i.jsx)(t.p,{children:"This use case shows how to set up an SQL connector (here with MSSQL), particularly working on SQL queries with some tuning\nand how to send the resulting CSV files into Azure Blob."}),"\n",(0,i.jsxs)(t.p,{children:["Details regarding the configurations can be located on the ",(0,i.jsx)(t.a,{href:"/docs/guide/north-connectors/azure-blob",children:"North Azure Blob"})," and ",(0,i.jsx)(t.a,{href:"/docs/guide/south-connectors/mssql",children:"South MSSQL"})," connectors pages."]}),"\n",(0,i.jsx)(t.p,{children:"This specific scenario is constructed around the depicted fictional network."}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)("div",{children:(0,i.jsx)(t.p,{children:(0,i.jsx)(t.img,{alt:"MSSQL -&gt; Azure Blob use case",src:s(3099).A+"",width:"804",height:"617"})})})}),"\n",(0,i.jsx)(t.h2,{id:"south-mssql",children:"South MSSQL"}),"\n",(0,i.jsx)(t.p,{children:"Make sure you have the URL or IP address of the MSSQL server, along with its associated port, and a read-only user."}),"\n",(0,i.jsx)(t.admonition,{title:"Read only user",type:"caution",children:(0,i.jsx)(t.p,{children:"While a read-only user is not mandatory, it is strongly recommended to prevent the insertion or update of data through\na SQL query. South connectors are designed for accessing data, not for creating new entries."})}),"\n",(0,i.jsx)(t.p,{children:"With the proposed schema, the following settings can be set:"}),"\n",(0,i.jsxs)(t.ul,{children:["\n",(0,i.jsxs)(t.li,{children:["Host: ",(0,i.jsx)(t.code,{children:"10.0.0.1"})]}),"\n",(0,i.jsxs)(t.li,{children:["Port: ",(0,i.jsx)(t.code,{children:"1433"})]}),"\n",(0,i.jsxs)(t.li,{children:["Database: ",(0,i.jsx)(t.code,{children:"oibus-test"})]}),"\n"]}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)("div",{children:(0,i.jsx)(t.p,{children:(0,i.jsx)(t.img,{alt:"OPCUA settings",src:s(2548).A+"",width:"1914",height:"572"})})})}),"\n",(0,i.jsx)(t.admonition,{title:"Testing connection",type:"tip",children:(0,i.jsxs)(t.p,{children:["You can verify the connection by testing the settings using the ",(0,i.jsx)(t.code,{children:"Test settings"})," button."]})}),"\n",(0,i.jsx)(t.h3,{id:"sql-queries",children:"SQL Queries"}),"\n",(0,i.jsxs)(t.p,{children:["OIBus provides query variables such as ",(0,i.jsx)(t.code,{children:"@StartTime"})," and ",(0,i.jsx)(t.code,{children:"@EndTime"}),". However, their usage is not mandatory."]}),"\n",(0,i.jsx)(t.h4,{id:"without-variable",children:"Without variable"}),"\n",(0,i.jsx)(t.p,{children:"In this example, a moving window interval can regularly retrieve the data without the need for such variables, between\nnow and yesterday:"}),"\n",(0,i.jsx)(t.pre,{children:(0,i.jsx)(t.code,{className:"language-SQL",children:"SELECT data_name AS dataName, value, timestamp FROM table\nWHERE timestamp > DATEADD(DAY,-1,GETDATE()) AND timestamp < GETDATE()\n"})}),"\n",(0,i.jsx)(t.admonition,{title:"DateTime type",type:"caution",children:(0,i.jsxs)(t.p,{children:["Ensure that you compare the date with a field of the same date type, such as a DateTime type. Use a\n",(0,i.jsx)(t.a,{href:"https://learn.microsoft.com/en-us/sql/t-sql/functions/cast-and-convert-transact-sql?view=sql-server-ver16",children:"cast or convert function"})," to appropriately handle the field or your comparison date."]})}),"\n",(0,i.jsxs)(t.p,{children:["In this scenario, the datetime fields section can still be employed to parse dates and output them in the appropriate format.\nOnly the ",(0,i.jsx)(t.code,{children:"timestamp"})," is a date time field, and we do not use it as a reference because it is not utilized with ",(0,i.jsx)(t.code,{children:"@StartTime"})," or\n",(0,i.jsx)(t.code,{children:"@EndTime"}),"."]}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)("div",{children:(0,i.jsx)(t.p,{children:(0,i.jsx)(t.img,{alt:"MSSQL item without variable",src:s(3060).A+"",width:"2280",height:"1202"})})})}),"\n",(0,i.jsx)(t.h4,{id:"with-variables",children:"With variables"}),"\n",(0,i.jsxs)(t.p,{children:["The ",(0,i.jsx)(t.code,{children:"@StartTime"})," variable captures the last maximum instant retrieved from a previous query. By default, for the initial\nquery, it takes the current time minus one hour. The ",(0,i.jsx)(t.code,{children:"@EndTime"})," variable is replaced by the current time."]}),"\n",(0,i.jsxs)(t.p,{children:["To prevent overloading the server with a large query, you can divide the [",(0,i.jsx)(t.code,{children:"@StartTime"}),", ",(0,i.jsx)(t.code,{children:"@EndTime"}),"] interval into\nsmaller chunks. This can be configured in the ",(0,i.jsx)(t.strong,{children:"History settings"})," section, from the connector settings:"]}),"\n",(0,i.jsxs)(t.ul,{children:["\n",(0,i.jsx)(t.li,{children:"Max read interval (in seconds): If set to 60 seconds, and the interval is 1 hour, 60 sub-interval queries will be generated."}),"\n",(0,i.jsx)(t.li,{children:"Read delay (in milliseconds) between each sub-interval query."}),"\n",(0,i.jsxs)(t.li,{children:["Overlap (in milliseconds) deduced a number of milliseconds from the ",(0,i.jsx)(t.code,{children:"@StartTime"})," of the interval that will be chunked,\nexpanding the query interval while still allowing the retrieval of data before the last maximum instant retrieved."]}),"\n"]}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)("div",{children:(0,i.jsx)(t.p,{children:(0,i.jsx)(t.img,{alt:"MSSQL history settings",src:s(7181).A+"",width:"1914",height:"190"})})})}),"\n",(0,i.jsxs)(t.admonition,{title:"When to use overlap?",type:"caution",children:[(0,i.jsx)(t.p,{children:"Overlap proves beneficial when certain retrieved data exhibit latency and are stored after the query has been executed.\nIn such cases, it allows for a slight extension of the requested interval."}),(0,i.jsx)(t.p,{children:"Exercise caution if your query involves aggregation, as it might alter your data by shifting the time origin of the first\ninterval."})]}),"\n",(0,i.jsx)(t.pre,{children:(0,i.jsx)(t.code,{className:"language-SQL",children:"SELECT timestamp, message, level FROM logs \nWHERE timestamp > @StartTime AND timestamp < @EndTime\n"})}),"\n",(0,i.jsx)(t.h5,{id:"date-time-fields",children:"Date time fields"}),"\n",(0,i.jsx)(t.p,{children:"One date time field can be added:"}),"\n",(0,i.jsxs)(t.ul,{children:["\n",(0,i.jsx)(t.li,{children:"Field name: timestamp"}),"\n",(0,i.jsx)(t.li,{children:"Reference field: true"}),"\n",(0,i.jsx)(t.li,{children:"Type: ISO 8601"}),"\n"]}),"\n",(0,i.jsxs)(t.p,{children:["The ",(0,i.jsx)(t.code,{children:"timestamp"})," field contains a date-time in ISO-8601 format. It serves as a reference, implying that it will be\nstored in the maximum instant of the South cache."]}),"\n",(0,i.jsx)(t.h5,{id:"serialization",children:"Serialization"}),"\n",(0,i.jsxs)(t.ul,{children:["\n",(0,i.jsxs)(t.li,{children:["Type: ",(0,i.jsx)(t.code,{children:"csv"})]}),"\n",(0,i.jsxs)(t.li,{children:["Filename: ",(0,i.jsx)(t.code,{children:"sqlite-@CurrentDate.csv"})]}),"\n",(0,i.jsxs)(t.li,{children:["Output date time format: ",(0,i.jsx)(t.code,{children:"yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"})]}),"\n",(0,i.jsxs)(t.li,{children:["Output timezone: ",(0,i.jsx)(t.code,{children:"Europe/Paris"})]}),"\n",(0,i.jsxs)(t.li,{children:["Delimiter: ",(0,i.jsx)(t.code,{children:"Comma ,"})]}),"\n"]}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)("div",{children:(0,i.jsx)(t.p,{children:(0,i.jsx)(t.img,{alt:"MSSQL item with variable",src:s(7711).A+"",width:"2280",height:"1202"})})})}),"\n",(0,i.jsx)(t.h5,{id:"result",children:"Result"}),"\n",(0,i.jsxs)(t.p,{children:["Note that the filename with ",(0,i.jsx)(t.code,{children:"@CurrentDate"})," will always be formatted ",(0,i.jsx)(t.code,{children:"yyyy_MM_dd_HH_mm_ss_SSS"}),"."]}),"\n",(0,i.jsx)(t.pre,{children:(0,i.jsx)(t.code,{className:"language-csv",metastring:'title="CSV file sqlite-2024_01_23_10_38_50_063.csv"',children:'timestamp;message;level\n2024-01-23T11:38:36.282Z;"Error while connecting to the OPCUA server. Error: The connection may have been rejected by server,Err = (premature socket termination socket timeout : timeout=60000  ClientTCP_transport57)";error\n2024-01-23T11:38:36.282Z;"South connector ""OPCUA"" (keOidHvw9qJ3CXAr1_zIF) disconnected";debug\n2024-01-23T11:38:36.282Z;"Error while connecting to the OPCUA server. Error: The connection may have been rejected by server,Err = (premature socket termination socket timeout : timeout=60000  ClientTCP_transport56)";error\n2024-01-23T11:38:36.282Z;"South connector ""Prosys HA"" (Mv8o0vr_nyh39-eF01Q2l) disconnected";debug\n2024-01-23T11:38:40.007Z;Opening ./OIBus/data-folder/logs/logs.db SQLite database;debug\n2024-01-23T11:38:40.007Z;"Sending ""SELECT timestamp, message, level FROM logs WHERE timestamp > @StartTime AND timestamp < @EndTime"" with @StartTime = 2024-01-23T10:38:17.083Z @EndTime = 2024-01-23T10:38:40.006Z";info\n2024-01-23T11:38:40.059Z;Found 24 results for item SQLite log 2 in 52 ms;info\n2024-01-23T11:38:40.063Z;"Writing 4913 bytes into CSV file at ""./OIBus/data-folder/cache/data-stream/south-GG6BT_CR31m1h1jMpm9ud/tmp/sqlite-2024_01_23_10_38_40_063.csv""";debug\n2024-01-23T11:38:40.063Z;"Sending CSV file ""./OIBus/data-folder/cache/data-stream/south-GG6BT_CR31m1h1jMpm9ud/tmp/sqlite-2024_01_23_10_38_40_063.csv"" to Engine";debug\n2024-01-23T11:38:40.063Z;"Add file ""./OIBus/data-folder/cache/data-stream/south-GG6BT_CR31m1h1jMpm9ud/tmp/sqlite-2024_01_23_10_38_40_063.csv"" to cache from South ""SQLite log""";debug\n2024-01-23T11:38:40.063Z;"Caching file ""./OIBus/data-folder/cache/data-stream/south-GG6BT_CR31m1h1jMpm9ud/tmp/sqlite-2024_01_23_10_38_40_063.csv"" in North connector ""Console debug""...";debug\n2024-01-23T11:38:40.064Z;"File ""./OIBus/data-folder/cache/data-stream/south-GG6BT_CR31m1h1jMpm9ud/tmp/sqlite-2024_01_23_10_38_40_063.csv"" cached in ""./OIBus/data-folder/cache/data-stream/north-FSyK0CdXNxVe0onCI1RA1/files/sqlite-2024_01_23_10_38_40_063-1706006320063.csv""";debug\n2024-01-23T11:38:40.066Z;Next start time updated from 2024-01-23T10:38:17.083Z to 2024-01-23T10:38:36.282Z;debug\n2024-01-23T11:38:40.067Z;"File ""./OIBus/data-folder/cache/data-stream/north-FSyK0CdXNxVe0onCI1RA1/files/sqlite-2024_01_23_10_38_40_063-1706006320063.csv"" moved to archive folder ""./OIBus/data-folder/cache/data-stream/north-FSyK0CdXNxVe0onCI1RA1/archive/sqlite-2024_01_23_10_38_40_063-1706006320063.csv""";debug\n2024-01-23T11:38:46.283Z;Connecting to OPCUA on opc.tcp://oibus.rd.optimistik.fr:53530/OPCUA/SimulationServer;debug\n'})}),"\n",(0,i.jsxs)(t.p,{children:["In this example, the maximum instant saved for the ",(0,i.jsx)(t.code,{children:"@StartTime"})," of the next query will be ",(0,i.jsx)(t.code,{children:"2024-01-23T11:38:46.283Z"}),",\ninjected into the request in ISO 8601 format."]}),"\n",(0,i.jsx)(t.admonition,{title:"SQLite log database",type:"tip",children:(0,i.jsxs)(t.p,{children:["This query example can be used for the SQLite log database of OIBus ",(0,i.jsx)(t.code,{children:"./logs/logs.db"}),"."]})}),"\n",(0,i.jsx)(t.h2,{id:"north-azure-blob",children:"North Azure Blob"}),"\n",(0,i.jsx)(t.p,{children:"Be sure to have the user credentials with access to an Azure Blob container with write access."}),"\n",(0,i.jsx)(t.p,{children:"Create the Azure Blob North connector and populate the relevant fields:"}),"\n",(0,i.jsxs)(t.ul,{children:["\n",(0,i.jsxs)(t.li,{children:["Account: ",(0,i.jsx)(t.code,{children:"oibus"})]}),"\n",(0,i.jsxs)(t.li,{children:["Container: ",(0,i.jsx)(t.code,{children:"test-oibus"})]}),"\n",(0,i.jsxs)(t.li,{children:["Path: ",(0,i.jsx)(t.code,{children:"north-local-oib"})]}),"\n"]}),"\n",(0,i.jsxs)(t.p,{children:["If ",(0,i.jsx)(t.strong,{children:"Path"})," is kept empty, the files will be stored at the root container."]}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)("div",{children:(0,i.jsx)(t.p,{children:(0,i.jsx)(t.img,{alt:"Azure Blob settings",src:s(8419).A+"",width:"1914",height:"326"})})})}),"\n",(0,i.jsx)(t.admonition,{title:"Testing connection",type:"tip",children:(0,i.jsxs)(t.p,{children:["You can verify the connection by testing the settings using the ",(0,i.jsx)(t.code,{children:"Test settings"})," button."]})})]})}function h(e={}){const{wrapper:t}={...(0,n.R)(),...e.components};return t?(0,i.jsx)(t,{...e,children:(0,i.jsx)(c,{...e})}):c(e)}},8419:(e,t,s)=>{s.d(t,{A:()=>i});const i=s.p+"assets/images/azure-blob-settings-e71555e339d132092e3d72ac6f07345c.png"},3099:(e,t,s)=>{s.d(t,{A:()=>i});const i=s.p+"assets/images/mssql-azure-blob-a3fd0ad86722ad197051ae88cb1f1c6e.svg"},7181:(e,t,s)=>{s.d(t,{A:()=>i});const i=s.p+"assets/images/mssql-history-settings-e128ddfed1bd10492d3865301af71c68.png"},3060:(e,t,s)=>{s.d(t,{A:()=>i});const i=s.p+"assets/images/mssql-item-1-a296c4a4cd7edd27087e871e47b70f1f.png"},7711:(e,t,s)=>{s.d(t,{A:()=>i});const i=s.p+"assets/images/mssql-item-2-b696aff0e1e0ac36ad4ff539d7ac5165.png"},2548:(e,t,s)=>{s.d(t,{A:()=>i});const i=s.p+"assets/images/mssql-settings-cc59db796cd6fc0d158b012ccb62a75f.png"},8453:(e,t,s)=>{s.d(t,{R:()=>a,x:()=>d});var i=s(6540);const n={},r=i.createContext(n);function a(e){const t=i.useContext(r);return i.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function d(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(n):e.components||n:a(e.components),i.createElement(r.Provider,{value:t},e.children)}}}]);