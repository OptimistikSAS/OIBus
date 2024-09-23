"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[4755],{9361:(e,t,n)=>{n.d(t,{Ay:()=>o,RM:()=>r});var i=n(4848),s=n(8453);const r=[{value:"CSV Serialization",id:"csv-serialization",level:3},{value:"Splitting large queries",id:"splitting-large-queries",level:2}];function a(e){const t={a:"a",code:"code",h2:"h2",h3:"h3",li:"li",p:"p",strong:"strong",ul:"ul",...(0,s.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(t.h3,{id:"csv-serialization",children:"CSV Serialization"}),"\n",(0,i.jsx)(t.p,{children:"OIBus offers the option to serialize retrieved data into CSV files, and you can customize the serialization process with\nthe following settings:"}),"\n",(0,i.jsxs)(t.ul,{children:["\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Filename"}),": The name of the file where the result will be stored. You can use several internal variables like\n",(0,i.jsx)(t.strong,{children:"@ConnectorName"})," (the name of the connector) and ",(0,i.jsx)(t.strong,{children:"@CurrentDate"})," (the current date in ",(0,i.jsx)(t.code,{children:"yyyy_MM_dd_HH_mm_ss_SSS"}),"\nformat - it is uncorrelated to the datetime format of the serialization, used for datetime fields)."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Delimiter"}),": The delimiter to use in the CSV."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Compression"}),": Choose whether to compress the file with gzip or not."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Output datetime format"}),": Specify the format of the datetime in the CSV. OIBus will only convert the\n",(0,i.jsx)(t.a,{href:"#datetime-fields",children:"datetime fields"})," specified. The ",(0,i.jsx)(t.strong,{children:"@CurrentDate"})," variable used in the output filename won't be affected."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Output timezone"}),": The timezone to use for storing the datetime."]}),"\n"]}),"\n",(0,i.jsx)(t.h2,{id:"splitting-large-queries",children:"Splitting large queries"}),"\n",(0,i.jsxs)(t.p,{children:["In situations where a query may impose a significant load on the server, especially when a large time interval is requested\nand the @StartTime and @EndTime ",(0,i.jsx)(t.a,{href:"#query-variables",children:"query variables"})," are utilized, you can split the query into several\nsub-queries with smaller intervals. This can be achieved by configuring the ",(0,i.jsx)(t.strong,{children:"Max read interval"})," field in the\n",(0,i.jsx)(t.a,{href:"/docs/guide/south-connectors/common-settings#history-settings",children:"history settings"}),"."]})]})}function o(e={}){const{wrapper:t}={...(0,s.R)(),...e.components};return t?(0,i.jsx)(t,{...e,children:(0,i.jsx)(a,{...e})}):a(e)}},8918:(e,t,n)=>{n.d(t,{Ay:()=>l,RM:()=>a});var i=n(4848),s=n(8453),r=n(9361);const a=[{value:"Item settings",id:"item-settings",level:2},{value:"Query",id:"query",level:3},{value:"Query variables",id:"query-variables",level:4},{value:"Datetime fields",id:"datetime-fields",level:3},...r.RM];function o(e){const t={a:"a",admonition:"admonition",code:"code",em:"em",h2:"h2",h3:"h3",h4:"h4",li:"li",p:"p",pre:"pre",strong:"strong",ul:"ul",...(0,s.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(t.h2,{id:"item-settings",children:"Item settings"}),"\n",(0,i.jsx)(t.p,{children:"In the South connector, each item can be configured to be queried according to the chosen scan mode. Multiple queries to\nthe same database can be configured within the same South connector. OIBus will execute the queries one after another,\nprepare the output file, and then send it to North connectors."}),"\n",(0,i.jsx)(t.h3,{id:"query",children:"Query"}),"\n",(0,i.jsxs)(t.p,{children:["The query field in the South connector accepts SQL syntax and can utilize several internal variables. These variables\nserve various purposes, including enhancing data stream resilience in the event of a connection failure and breaking\ndown large intervals into smaller chunks, which helps reduce the load on the server and network. For more information,\nrefer to the ",(0,i.jsx)(t.a,{href:"#splitting-large-queries",children:"big queries"})," section."]}),"\n",(0,i.jsx)(t.h4,{id:"query-variables",children:"Query variables"}),"\n",(0,i.jsx)(t.p,{children:"In OIBus, you can utilize the following internal variables that will be interpreted by the system:"}),"\n",(0,i.jsxs)(t.ul,{children:["\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"@StartTime"}),": Initially, the @StartTime variable is set to the date of the first execution of the query. When results\nare retrieved from the database, the @StartTime value is updated to the most recent timestamp among those results in the\nfield used as a reference (refer to ",(0,i.jsx)(t.a,{href:"#datetime-fields",children:"the datetime fields section"}),")."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"@EndTime"}),": The @EndTime variable is set to either the current time (",(0,i.jsx)(t.em,{children:"now()"}),") or the end of the sub-interval if a\nquery is split."]}),"\n"]}),"\n",(0,i.jsx)(t.pre,{children:(0,i.jsx)(t.code,{className:"language-sql",metastring:'title="SQL query with @StartTime and @EndTime"',children:"SELECT data_name AS dataName, value, timestamp FROM table WHERE timestamp > @StartTime AND timestamp < @EndTime\n"})}),"\n",(0,i.jsx)(t.h3,{id:"datetime-fields",children:"Datetime fields"}),"\n",(0,i.jsx)(t.p,{children:"In the South connector, you can specify an array of fields that are of datetime type. Each row indicate the format in\nwhich OIBus will parse this field in order to convert it to an internal UTC date. Here are the details for configuring\ndatetime fields:"}),"\n",(0,i.jsxs)(t.ul,{children:["\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Field name"}),": The field name in the SELECT section of the query."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Reference field"}),": Use this field as a reference for the next @StartTime value (refer to ",(0,i.jsx)(t.a,{href:"#query-variables",children:"query variables"}),")."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Type"}),": The type of data in the result."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Timezone"})," (for string, Date, DateTime, DateTime2, SmallDateTime types): The timezone of the datetime stored in the\ndatabase."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Format"})," (for string only): The string format of the datetime stored in the database."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Locale"})," (for string only): The locale to use when the format contains locale-specific strings (such as MMM format\nfor months)."]}),"\n"]}),"\n",(0,i.jsxs)(t.p,{children:["OIBus internally uses these dates in ISO UTC format, and the output datetime format can be set in the\n",(0,i.jsx)(t.a,{href:"#csv-serialization",children:"serialization section"}),". All datetime fields are converted using the same serialization settings."]}),"\n",(0,i.jsxs)(t.admonition,{title:"Conversion in SQL query",type:"warning",children:[(0,i.jsxs)(t.p,{children:["If the ",(0,i.jsx)(t.code,{children:"timestamp"})," field is utilized as a reference of type string, formatted as ",(0,i.jsx)(t.code,{children:"yyyy-MM-dd HH:mm:ss"}),", the @StartTime\nand @EndTime will be injected into the query as ",(0,i.jsx)(t.code,{children:"yyyy-MM-dd HH:mm:ss"})," format strings."]}),(0,i.jsxs)(t.p,{children:["In the subsequent query, the ",(0,i.jsx)(t.code,{children:"datetime"})," field (retrieved from the database) is a DateTime object converted into a\nstring (",(0,i.jsx)(t.code,{children:"timestamp"}),"). OIBus will interpret the ",(0,i.jsx)(t.code,{children:"timestamp"})," (string) field from the query as a reference field. However,\ninjecting @StartTime and @EndTime as string variables in the same format may lead to unexpected behavior due to the\ninconsistency between the injected @StartTime and @EndTime variables (string type) and the datetime field\n(formatted as DateTime from the database)."]}),(0,i.jsx)(t.pre,{children:(0,i.jsx)(t.code,{className:"language-sql",metastring:'title="Bad SQL query with @StartTime and @EndTime and convert"',children:"SELECT data_name AS dataName, value, convert(datetime, DATETIME) AS timestamp FROM table\nWHERE datetime > @StartTime AND datetime < @EndTime\n"})}),(0,i.jsx)(t.p,{children:"In the following case, the uniformity in formats guarantees proper functionality."}),(0,i.jsx)(t.pre,{children:(0,i.jsx)(t.code,{className:"language-sql",metastring:'title="Correct SQL query with @StartTime and @EndTime"',children:"SELECT data_name AS dataName, value, convert(datetime, DATETIME) AS timestamp FROM table\nWHERE convert(datetime, DATETIME) > @StartTime AND convert(datetime, DATETIME) < @EndTime\n"})})]}),"\n",(0,i.jsx)(r.Ay,{})]})}function l(e={}){const{wrapper:t}={...(0,s.R)(),...e.components};return t?(0,i.jsx)(t,{...e,children:(0,i.jsx)(o,{...e})}):o(e)}},5709:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>d,contentTitle:()=>o,default:()=>u,frontMatter:()=>a,metadata:()=>l,toc:()=>c});var i=n(4848),s=n(8453),r=n(8918);const a={sidebar_position:3},o="Microsoft SQL Server (MSSQL)",l={id:"guide/south-connectors/mssql",title:"Microsoft SQL Server (MSSQL)",description:"Send SQL queries to Microsoft SQL Server.",source:"@site/docs/guide/south-connectors/mssql.mdx",sourceDirName:"guide/south-connectors",slug:"/guide/south-connectors/mssql",permalink:"/docs/guide/south-connectors/mssql",draft:!1,unlisted:!1,tags:[],version:"current",sidebarPosition:3,frontMatter:{sidebar_position:3},sidebar:"guideSidebar",previous:{title:"OPCUA",permalink:"/docs/guide/south-connectors/opcua"},next:{title:"Modbus",permalink:"/docs/guide/south-connectors/modbus"}},d={},c=[{value:"Specific settings",id:"specific-settings",level:2},...r.RM];function h(e){const t={admonition:"admonition",h1:"h1",h2:"h2",header:"header",li:"li",p:"p",strong:"strong",ul:"ul",...(0,s.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(t.header,{children:(0,i.jsx)(t.h1,{id:"microsoft-sql-server-mssql",children:"Microsoft SQL Server (MSSQL)"})}),"\n",(0,i.jsx)(t.p,{children:"Send SQL queries to Microsoft SQL Server."}),"\n",(0,i.jsx)(t.h2,{id:"specific-settings",children:"Specific settings"}),"\n",(0,i.jsx)(t.p,{children:"When configuring the SQL connector to send SQL queries to a Microsoft SQL Server, you will need to provide the following\ndetails:"}),"\n",(0,i.jsxs)(t.ul,{children:["\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Host"}),": The address of the Microsoft SQL server."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Port"}),": The MSSQL server port (default is 1433)."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Database"}),": The name of the database to connect to."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Username"}),": The username used for authentication."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Password"}),": The password used for authentication."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Domain"})," (optional): This field is useful when connecting to an Active Directory domain."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Use encryption"}),": Option to encrypt the data between the database and OIBus (note that encryption can potentially\noverload the server)."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Trust server certificate"}),": Option to accept server certificates even if they are outdated or self-signed."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Connection timeout"}),": Timeout setting for establishing the connection."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Request timeout"}),": Timeout for each SQL query."]}),"\n"]}),"\n",(0,i.jsx)(t.admonition,{title:"Database access",type:"tip",children:(0,i.jsx)(t.p,{children:"It is strongly advised to use a read-only user when connecting to the database for security and data integrity purposes."})}),"\n",(0,i.jsx)(r.Ay,{})]})}function u(e={}){const{wrapper:t}={...(0,s.R)(),...e.components};return t?(0,i.jsx)(t,{...e,children:(0,i.jsx)(h,{...e})}):h(e)}},8453:(e,t,n)=>{n.d(t,{R:()=>a,x:()=>o});var i=n(6540);const s={},r=i.createContext(s);function a(e){const t=i.useContext(r);return i.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function o(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:a(e.components),i.createElement(r.Provider,{value:t},e.children)}}}]);