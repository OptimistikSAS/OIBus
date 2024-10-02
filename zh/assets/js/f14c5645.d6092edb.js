"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[9999],{5997:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>c,contentTitle:()=>r,default:()=>h,frontMatter:()=>o,metadata:()=>a,toc:()=>d});var i=t(4848),s=t(8453);const o={sidebar_position:6},r="SQL with ODBC",a={id:"guide/advanced/sql-with-odbc",title:"SQL with ODBC",description:"What is ODBC",source:"@site/versioned_docs/version-v2/guide/advanced/sql-with-odbc.md",sourceDirName:"guide/advanced",slug:"/guide/advanced/sql-with-odbc",permalink:"/zh/docs/v2/guide/advanced/sql-with-odbc",draft:!1,unlisted:!1,tags:[],version:"v2",sidebarPosition:6,frontMatter:{sidebar_position:6},sidebar:"guideSidebar",previous:{title:"OPCHDA agent",permalink:"/zh/docs/v2/guide/advanced/opchda-agent"}},c={},d=[{value:"What is ODBC",id:"what-is-odbc",level:2},{value:"Example with MSSQL ODBC",id:"example-with-mssql-odbc",level:2}];function l(e){const n={a:"a",code:"code",h1:"h1",h2:"h2",li:"li",p:"p",strong:"strong",ul:"ul",...(0,s.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(n.h1,{id:"sql-with-odbc",children:"SQL with ODBC"}),"\n",(0,i.jsx)(n.h2,{id:"what-is-odbc",children:"What is ODBC"}),"\n",(0,i.jsx)(n.p,{children:"ODBC stands for Open Database Connectivity. It is a standard application programming interface (API) for accessing\ndatabases. It was developed by the SQL Access Group in the early 1990s and is now maintained by the Open Data Base\nConnectivity Foundation (ODBC Foundation)."}),"\n",(0,i.jsx)(n.p,{children:"To connect OIBus with a database through ODBC technology, a driver must be installed on the OIBus machine. Each\ndatabase has its own driver. This article will explore how to set up an ODBC connection with a MSSQL database."}),"\n",(0,i.jsx)(n.h2,{id:"example-with-mssql-odbc",children:"Example with MSSQL ODBC"}),"\n",(0,i.jsxs)(n.p,{children:["Microsoft already offers documentation to install its driver on\n",(0,i.jsx)(n.a,{href:"https://learn.microsoft.com/en-us/sql/connect/odbc/windows/microsoft-odbc-driver-for-sql-server-on-windows?view=sql-server-ver16",children:"Window"}),",\n",(0,i.jsx)(n.a,{href:"https://learn.microsoft.com/en-us/sql/connect/odbc/linux-mac/installing-the-microsoft-odbc-driver-for-sql-server?view=sql-server-ver16",children:"Linux"}),"\nand ",(0,i.jsx)(n.a,{href:"https://learn.microsoft.com/en-us/sql/connect/odbc/linux-mac/install-microsoft-odbc-driver-sql-server-macos?view=sql-server-ver16",children:"MacOS"})]}),"\n",(0,i.jsxs)(n.p,{children:["Once the driver installed on the OIBus machine, locate the ",(0,i.jsx)(n.strong,{children:"ODBC Driver Path"})," on the SQL connector, and specify the\nDriver path:"]}),"\n",(0,i.jsxs)(n.ul,{children:["\n",(0,i.jsxs)(n.li,{children:["For macOS, it can be like ",(0,i.jsx)(n.code,{children:"/opt/homebrew/lib/libmsodbcsql.18.dylib"})]}),"\n",(0,i.jsxs)(n.li,{children:["For Windows, only the ODBC Driver Name is needed : ",(0,i.jsx)(n.code,{children:"ODBC Driver 18 for SQL Server"}),". You can retrieve the list of\ninstalled ODBC driver in the ODBC drivers Tab of the Windows ODBC data sources."]}),"\n"]})]})}function h(e={}){const{wrapper:n}={...(0,s.R)(),...e.components};return n?(0,i.jsx)(n,{...e,children:(0,i.jsx)(l,{...e})}):l(e)}},8453:(e,n,t)=>{t.d(n,{R:()=>r,x:()=>a});var i=t(6540);const s={},o=i.createContext(s);function r(e){const n=i.useContext(o);return i.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function a(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:r(e.components),i.createElement(o.Provider,{value:n},e.children)}}}]);