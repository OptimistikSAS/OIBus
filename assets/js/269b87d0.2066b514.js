"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[6865],{7095:(e,n,t)=>{t.d(n,{Ay:()=>c,RM:()=>o});var i=t(4848),s=t(8453);function r(e){const n={a:"a",code:"code",h2:"h2",h3:"h3",li:"li",p:"p",strong:"strong",ul:"ul",...(0,s.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(n.h3,{id:"csv-serialization",children:"CSV Serialization"}),"\n",(0,i.jsx)(n.p,{children:"OIBus offers the option to serialize retrieved data into CSV files, and you can customize the serialization process with\nthe following settings:"}),"\n",(0,i.jsxs)(n.ul,{children:["\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Filename"}),": The name of the file where the result will be stored. You can use several internal variables like\n",(0,i.jsx)(n.strong,{children:"@ConnectorName"})," (the name of the connector) and ",(0,i.jsx)(n.strong,{children:"@CurrentDate"})," (the current date in ",(0,i.jsx)(n.code,{children:"yyyy_MM_dd_HH_mm_ss_SSS"}),"\nformat - it is uncorrelated to the datetime format of the serialization, used for datetime fields)."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Delimiter"}),": The delimiter to use in the CSV."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Compression"}),": Choose whether to compress the file with gzip or not."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Output datetime format"}),": Specify the format of the datetime in the CSV. OIBus will only convert the\n",(0,i.jsx)(n.a,{href:"#datetime-fields",children:"datetime fields"})," specified. The ",(0,i.jsx)(n.strong,{children:"@CurrentDate"})," variable used in the output filename won't be affected."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Output timezone"}),": The timezone to use for storing the datetime."]}),"\n"]}),"\n",(0,i.jsx)(n.h2,{id:"splitting-large-queries",children:"Splitting large queries"}),"\n",(0,i.jsxs)(n.p,{children:["In situations where a query may impose a significant load on the server, especially when a large time interval is requested\nand the @StartTime and @EndTime ",(0,i.jsx)(n.a,{href:"#query-variables",children:"query variables"})," are utilized, you can split the query into several\nsub-queries with smaller intervals. This can be achieved by configuring the ",(0,i.jsx)(n.strong,{children:"Max read interval"})," field in the\n",(0,i.jsx)(n.a,{href:"#throttling-settings",children:"throttling settings"}),"."]})]})}function a(e={}){const{wrapper:n}={...(0,s.R)(),...e.components};return n?(0,i.jsx)(n,{...e,children:(0,i.jsx)(r,{...e})}):r(e)}const o=[{value:"Item settings",id:"item-settings",level:2},{value:"Query",id:"query",level:3},{value:"Query variables",id:"query-variables",level:4},{value:"Datetime fields",id:"datetime-fields",level:3},{value:"CSV Serialization",id:"csv-serialization",level:3},{value:"Splitting large queries",id:"splitting-large-queries",level:2}];function l(e){const n={a:"a",admonition:"admonition",code:"code",em:"em",h2:"h2",h3:"h3",h4:"h4",li:"li",p:"p",pre:"pre",strong:"strong",ul:"ul",...(0,s.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(n.h2,{id:"item-settings",children:"Item settings"}),"\n",(0,i.jsx)(n.p,{children:"In the South connector, each item can be configured to be queried according to the chosen scan mode. Multiple queries to\nthe same database can be configured within the same South connector. OIBus will execute the queries one after another,\nprepare the output file, and then send it to North connectors."}),"\n",(0,i.jsx)(n.h3,{id:"query",children:"Query"}),"\n",(0,i.jsxs)(n.p,{children:["The query field in the South connector accepts SQL syntax and can utilize several internal variables. These variables\nserve various purposes, including enhancing data stream resilience in the event of a connection failure and breaking\ndown large intervals into smaller chunks, which helps reduce the load on the server and network. For more information,\nrefer to the ",(0,i.jsx)(n.a,{href:"#splitting-large-queries",children:"big queries"})," section."]}),"\n",(0,i.jsx)(n.h4,{id:"query-variables",children:"Query variables"}),"\n",(0,i.jsx)(n.p,{children:"In OIBus, you can utilize the following internal variables that will be interpreted by the system:"}),"\n",(0,i.jsxs)(n.ul,{children:["\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"@StartTime"}),": Initially, the @StartTime variable is set to the date of the first execution of the query. When results\nare retrieved from the database, the @StartTime value is updated to the most recent timestamp among those results in the\nfield used as a reference (refer to ",(0,i.jsx)(n.a,{href:"#datetime-fields",children:"the datetime fields section"}),")."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"@EndTime"}),": The @EndTime variable is set to either the current time (",(0,i.jsx)(n.em,{children:"now()"}),") or the end of the sub-interval if a\nquery is split."]}),"\n"]}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{className:"language-sql",metastring:'title="SQL query with @StartTime and @EndTime"',children:"SELECT data_name AS dataName, value, timestamp FROM table WHERE timestamp > @StartTime AND timestamp < @EndTime\n"})}),"\n",(0,i.jsx)(n.h3,{id:"datetime-fields",children:"Datetime fields"}),"\n",(0,i.jsx)(n.p,{children:"In the South connector, you can specify an array of fields that are of datetime type. Each row indicate the format in\nwhich OIBus will parse this field in order to convert it to an internal UTC date. Here are the details for configuring\ndatetime fields:"}),"\n",(0,i.jsxs)(n.ul,{children:["\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Field name"}),": The field name in the SELECT section of the query."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Reference field"}),": Use this field as a reference for the next @StartTime value (refer to ",(0,i.jsx)(n.a,{href:"#query-variables",children:"query variables"}),")."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Type"}),": The type of data in the result."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Timezone"})," (for string, Date, DateTime, DateTime2, SmallDateTime types): The timezone of the datetime stored in the\ndatabase."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Format"})," (for string only): The string format of the datetime stored in the database."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Locale"})," (for string only): The locale to use when the format contains locale-specific strings (such as MMM format\nfor months)."]}),"\n"]}),"\n",(0,i.jsxs)(n.p,{children:["OIBus internally uses these dates in ISO UTC format, and the output datetime format can be set in the\n",(0,i.jsx)(n.a,{href:"#csv-serialization",children:"serialization section"}),". All datetime fields are converted using the same serialization settings."]}),"\n",(0,i.jsxs)(n.admonition,{title:"Conversion in SQL query",type:"warning",children:[(0,i.jsxs)(n.p,{children:["If the ",(0,i.jsx)(n.code,{children:"timestamp"})," field is utilized as a reference of type string, formatted as ",(0,i.jsx)(n.code,{children:"yyyy-MM-dd HH:mm:ss"}),", the @StartTime\nand @EndTime will be injected into the query as ",(0,i.jsx)(n.code,{children:"yyyy-MM-dd HH:mm:ss"})," format strings."]}),(0,i.jsxs)(n.p,{children:["In the subsequent query, the ",(0,i.jsx)(n.code,{children:"datetime"})," field (retrieved from the database) is a DateTime object converted into a\nstring (",(0,i.jsx)(n.code,{children:"timestamp"}),"). OIBus will interpret the ",(0,i.jsx)(n.code,{children:"timestamp"})," (string) field from the query as a reference field. However,\ninjecting @StartTime and @EndTime as string variables in the same format may lead to unexpected behavior due to the\ninconsistency between the injected @StartTime and @EndTime variables (string type) and the datetime field\n(formatted as DateTime from the database)."]}),(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{className:"language-sql",metastring:'title="Bad SQL query with @StartTime and @EndTime and convert"',children:"SELECT data_name AS dataName, value, convert(datetime, DATETIME) AS timestamp FROM table\nWHERE datetime > @StartTime AND datetime <= @EndTime\n"})}),(0,i.jsx)(n.p,{children:"In the following case, the uniformity in formats guarantees proper functionality."}),(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{className:"language-sql",metastring:'title="Correct SQL query with @StartTime and @EndTime"',children:"SELECT data_name AS dataName, value, convert(datetime, DATETIME) AS timestamp FROM table\nWHERE convert(datetime, DATETIME) > @StartTime AND convert(datetime, DATETIME) <= @EndTime\n"})})]}),"\n",(0,i.jsx)(a,{})]})}function c(e={}){const{wrapper:n}={...(0,s.R)(),...e.components};return n?(0,i.jsx)(n,{...e,children:(0,i.jsx)(l,{...e})}):l(e)}},3264:(e,n,t)=>{t.d(n,{Ay:()=>o,RM:()=>r});var i=t(4848),s=t(8453);const r=[{value:"Throttling settings",id:"throttling-settings",level:3}];function a(e){const n={code:"code",h3:"h3",p:"p",strong:"strong",...(0,s.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(n.h3,{id:"throttling-settings",children:"Throttling settings"}),"\n",(0,i.jsx)(n.p,{children:"For South connectors capable of historical data retrieval, you have the flexibility to request data\nin intervals. These intervals can vary in size, depending on factors such as the chosen scan mode or the presence of\nprolonged network failures."}),"\n",(0,i.jsxs)(n.p,{children:["To handle such scenarios, the throttling settings enable you to divide large intervals into smaller sub-intervals, each\nno longer than the specified ",(0,i.jsx)(n.strong,{children:"Max read interval"})," (in seconds). These sub-intervals are requested with a delay defined\nby the ",(0,i.jsx)(n.strong,{children:"Read delay"})," setting (in milliseconds)."]}),"\n",(0,i.jsxs)(n.p,{children:["In certain situations, adding an overlap to the query can be beneficial. You can achieve this by configuring\nthe ",(0,i.jsx)(n.strong,{children:"overlap"})," field (in milliseconds): it will subtract this specified number of milliseconds from the ",(0,i.jsx)(n.code,{children:"@StartTime"}),"\nvariable of the subsequent query."]})]})}function o(e={}){const{wrapper:n}={...(0,s.R)(),...e.components};return n?(0,i.jsx)(n,{...e,children:(0,i.jsx)(a,{...e})}):a(e)}},10:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>d,contentTitle:()=>c,default:()=>m,frontMatter:()=>l,metadata:()=>i,toc:()=>h});const i=JSON.parse('{"id":"guide/south-connectors/odbc","title":"ODBC","description":"Send SQL queries to a local ODBC driver or to a remote OIBus Agent that can manage ODBC","source":"@site/docs/guide/south-connectors/odbc.mdx","sourceDirName":"guide/south-connectors","slug":"/guide/south-connectors/odbc","permalink":"/docs/guide/south-connectors/odbc","draft":false,"unlisted":false,"tags":[],"version":"current","sidebarPosition":14,"frontMatter":{"sidebar_position":14},"sidebar":"guideSidebar","previous":{"title":"OIAnalytics\xae","permalink":"/docs/guide/south-connectors/oianalytics"},"next":{"title":"OLEDB","permalink":"/docs/guide/south-connectors/oledb"}}');var s=t(4848),r=t(8453),a=t(7095),o=t(3264);const l={sidebar_position:14},c="ODBC",d={},h=[{value:"Specific settings",id:"specific-settings",level:2},{value:"Driver Installation",id:"driver-installation",level:3},{value:"Using OIBus with Aspen InfoPlus.21\xae (IP21)",id:"using-oibus-with-aspen-infoplus21-ip21",level:3},...o.RM,...a.RM];function u(e){const n={a:"a",admonition:"admonition",code:"code",h1:"h1",h2:"h2",h3:"h3",header:"header",li:"li",p:"p",strong:"strong",ul:"ul",...(0,r.R)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(n.header,{children:(0,s.jsx)(n.h1,{id:"odbc",children:"ODBC"})}),"\n",(0,s.jsxs)(n.p,{children:["Send SQL queries to a local ODBC driver or to a remote ",(0,s.jsx)(n.a,{href:"/docs/guide/oibus-agent/odbc",children:"OIBus Agent"})," that can manage ODBC\nqueries on the same machine as the server."]}),"\n",(0,s.jsxs)(n.p,{children:["The OIBus agent can be installed separately, as specified in its ",(0,s.jsx)(n.a,{href:"../oibus-agent/installation",children:"documentation"}),"."]}),"\n",(0,s.jsx)(n.p,{children:"This connector proves valuable when retrieving data from Aspen InfoPlus.21\xae (IP21) ODBC interfaces or other\nODBC-compatible applications."}),"\n",(0,s.jsx)(n.h2,{id:"specific-settings",children:"Specific settings"}),"\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Use remote agent"}),": If disabled, ensure that an ODBC ",(0,s.jsx)(n.a,{href:"#driver-installation",children:"driver is installed"})," on the machine\nwhere OIBus is deployed. Alternatively, you can opt to ",(0,s.jsx)(n.a,{href:"../oibus-agent/installation",children:"install an OIBus agent"})," on a remote\nmachine equipped with the necessary drivers."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Remote agent URL"}),": Specify the URL of the remote OIBus agent, e.g., ",(0,s.jsx)(n.code,{children:"http://ip-address-or-host:2224"}),"."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Connection timeout"}),": Timeout setting for establishing the connection."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Retry interval"}),": Time to wait before retrying connection."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Request timeout"}),": Determine the timeout duration for each query."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Connection string"}),": The ODBC connection string."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Password"}),": The authentication password, securely stored within OIBus configuration. If directly included in the\nconnection string, the password will be stored in plain text. When a password is used, OIBus appends ",(0,s.jsx)(n.code,{children:"PWD=<password>"})," to\nthe end of the connection string."]}),"\n"]}),"\n",(0,s.jsx)(n.p,{children:"Please ensure that the ODBC connection string adheres to the specified driver format, and it is imperative to have the\ndriver specified in the connection string correctly installed."}),"\n",(0,s.jsxs)(n.admonition,{title:"ODBC connection string example",type:"tip",children:[(0,s.jsx)(n.p,{children:(0,s.jsx)(n.code,{children:"Driver={driver name};SERVER=localhost,10014;TrustServerCertificate=yes;Database=test;UID=oibus;PWD=<secret>"})}),(0,s.jsxs)(n.p,{children:["The driver is either the name of the driver (Windows) or the path of the driver file (unix like systems).\nThe port is optional, and can be replaced by ",(0,s.jsx)(n.code,{children:"PORT=10014"})," (be sure to replace the comma ",(0,s.jsx)(n.code,{children:","})," by a semicolon ",(0,s.jsx)(n.code,{children:";"}),")."]})]}),"\n",(0,s.jsx)(n.h3,{id:"driver-installation",children:"Driver Installation"}),"\n",(0,s.jsxs)(n.p,{children:["On Windows, you can conveniently access the ODBC driver management tool, where you can specify the driver's name in the\nconnection string, such as ",(0,s.jsx)(n.code,{children:"MySQL ODBC 3.51 driver"})," or ",(0,s.jsx)(n.code,{children:"SQL Server"}),"."]}),"\n",(0,s.jsxs)(n.p,{children:["On UNIX-like systems, you should first install the driver on your machine and then specify the driver's path in the\nconnection string, like ",(0,s.jsx)(n.code,{children:"/opt/lib/libmsodbcsql.18.dylib"}),", for example."]}),"\n",(0,s.jsxs)(n.admonition,{title:"ODBC diver on MacOS",type:"info",children:[(0,s.jsxs)(n.p,{children:["Install unixodbc: ",(0,s.jsx)(n.code,{children:"brew install unixodbc"})]}),(0,s.jsxs)(n.p,{children:["Check if the installation was successful and list the ODBC config files: ",(0,s.jsx)(n.code,{children:"odbcinst -j"})]}),(0,s.jsxs)(n.p,{children:["Check the installed drivers: ",(0,s.jsx)(n.code,{children:"cat /opt/homebrew/etc/odbcinst.ini"})]})]}),"\n",(0,s.jsx)(n.h3,{id:"using-oibus-with-aspen-infoplus21-ip21",children:"Using OIBus with Aspen InfoPlus.21\xae (IP21)"}),"\n",(0,s.jsx)(n.p,{children:"ODBC connections often suffer from latency issues, particularly during large historian queries, such as those involving\nIP21. This can place a heavy load on both the network and the server."}),"\n",(0,s.jsx)(n.p,{children:"To mitigate these challenges, we recommend installing the OIBus Agent as a service on the same machine as IP21. OIBus\ncan then transmit queries to its agent using the HTTP protocol, and the agent can communicate directly with IP21 using\nODBC, eliminating network latency."}),"\n",(0,s.jsxs)(n.p,{children:["Of course, it's essential to ensure that the appropriate ODBC driver is installed ",(0,s.jsx)(n.strong,{children:"on the agent machine"})," and specified\ncorrectly in the connection string."]}),"\n",(0,s.jsx)(n.admonition,{title:"IP21 ODBC driver",type:"tip",children:(0,s.jsxs)(n.p,{children:["To establish a connection to IP21 via ODBC, you will need the ",(0,s.jsx)(n.code,{children:"AspenTech SQLplus"})," driver installed on your machine.\nPlease ensure that this driver is correctly installed."]})}),"\n",(0,s.jsx)(n.admonition,{title:"ODBC Access",type:"caution",children:(0,s.jsx)(n.p,{children:"Authentication can be handled either through the connection string or locally. When choosing local authentication, it's\nimportant to ensure that the OIBus agent runs with the appropriate permissions. You may need to run the service as a\ndifferent user, which can be configured through the service management window."})}),"\n",(0,s.jsxs)(n.p,{children:["The following connection string works with a basic IP21 installation: ",(0,s.jsx)(n.code,{children:'Driver={AspenTech SQLplus};HOST=<host>;PORT=10014"'})]}),"\n",(0,s.jsx)(o.Ay,{}),"\n",(0,s.jsx)(a.Ay,{})]})}function m(e={}){const{wrapper:n}={...(0,r.R)(),...e.components};return n?(0,s.jsx)(n,{...e,children:(0,s.jsx)(u,{...e})}):u(e)}},8453:(e,n,t)=>{t.d(n,{R:()=>a,x:()=>o});var i=t(6540);const s={},r=i.createContext(s);function a(e){const n=i.useContext(r);return i.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function o(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:a(e.components),i.createElement(r.Provider,{value:n},e.children)}}}]);