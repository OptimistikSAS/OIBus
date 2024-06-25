"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[3659],{5204:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>d,contentTitle:()=>c,default:()=>u,frontMatter:()=>s,metadata:()=>r,toc:()=>a});var o=t(4848),i=t(8453);const s={sidebar_position:4},c="OLEDB",r={id:"guide/oibus-agent/oledb",title:"OLEDB",description:"Send HTTP queries to connect to an ODBC driver and read data through SQL queries.",source:"@site/i18n/zh/docusaurus-plugin-content-docs/current/guide/oibus-agent/oledb.md",sourceDirName:"guide/oibus-agent",slug:"/guide/oibus-agent/oledb",permalink:"/zh/docs/guide/oibus-agent/oledb",draft:!1,unlisted:!1,tags:[],version:"current",sidebarPosition:4,frontMatter:{sidebar_position:4},sidebar:"guideSidebar",previous:{title:"OPCHDA",permalink:"/zh/docs/guide/oibus-agent/opchda"},next:{title:"OSIsoft PI",permalink:"/zh/docs/guide/oibus-agent/osisoft-pi"}},d={},a=[{value:"HTTP API",id:"http-api",level:2},{value:"Status",id:"status",level:3},{value:"Connection",id:"connection",level:3},{value:"Read",id:"read",level:3},{value:"Disconnection",id:"disconnection",level:3}];function l(e){const n={code:"code",h1:"h1",h2:"h2",h3:"h3",p:"p",pre:"pre",...(0,i.R)(),...e.components};return(0,o.jsxs)(o.Fragment,{children:[(0,o.jsx)(n.h1,{id:"oledb",children:"OLEDB"}),"\n",(0,o.jsx)(n.p,{children:"Send HTTP queries to connect to an ODBC driver and read data through SQL queries."}),"\n",(0,o.jsx)(n.h2,{id:"http-api",children:"HTTP API"}),"\n",(0,o.jsx)(n.h3,{id:"status",children:"Status"}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{children:"curl --location 'http://localhost:2224/api/ole/id/status'\n"})}),"\n",(0,o.jsx)(n.h3,{id:"connection",children:"Connection"}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{children:"curl --location --request PUT 'http://localhost:2224/api/ole/id/connect' \\\n--header 'Content-Type: application/json' \\\n--data '{\n\"connectionString\": \"Driver={AspenTech SQLplus};HOST=localhost;PORT=10014\",\n\"connectionTimeout\": 10000\n}'\n"})}),"\n",(0,o.jsx)(n.h3,{id:"read",children:"Read"}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{children:'curl --location --request PUT \'http://localhost:2224/api/ole/id/read\' \\\n--header \'Content-Type: application/json\' \\\n--data \'{\n    "connectionString": "Driver={AspenTech SQLplus};HOST=localhost;PORT=10014",\n    "sql": "SELECT timestamp, reference, value FROM demo",\n    "readTimeout": 10000,\n    "timeColumn": "timestamp",\n    "datasourceTimestampFormat": "yyyy-MM-dd HH:mm:ss.SSS",\n    "datasourceTimezone": "Europe/Paris",\n    "delimiter": ";",\n    "outputTimestampFormat": "yyyy-MM-dd HH:mm:ss.SSS",\n    "outputTimezone": "UTC"\n}\'\n'})}),"\n",(0,o.jsx)(n.h3,{id:"disconnection",children:"Disconnection"}),"\n",(0,o.jsx)(n.pre,{children:(0,o.jsx)(n.code,{children:"curl --location --request DELETE 'http://localhost:2224/api/ole/id/disconnect'\n"})})]})}function u(e={}){const{wrapper:n}={...(0,i.R)(),...e.components};return n?(0,o.jsx)(n,{...e,children:(0,o.jsx)(l,{...e})}):l(e)}},8453:(e,n,t)=>{t.d(n,{R:()=>c,x:()=>r});var o=t(6540);const i={},s=o.createContext(i);function c(e){const n=o.useContext(s);return o.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function r(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:c(e.components),o.createElement(s.Provider,{value:n},e.children)}}}]);