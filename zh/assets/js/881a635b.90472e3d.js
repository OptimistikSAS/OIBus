"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[8349],{9193:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>r,contentTitle:()=>d,default:()=>u,frontMatter:()=>s,metadata:()=>o,toc:()=>a});const o=JSON.parse('{"id":"guide/oibus-agent/odbc","title":"ODBC","description":"Send HTTP queries to connect to an ODBC driver and read data through SQL queries.","source":"@site/i18n/zh/docusaurus-plugin-content-docs/current/guide/oibus-agent/odbc.md","sourceDirName":"guide/oibus-agent","slug":"/guide/oibus-agent/odbc","permalink":"/zh/docs/guide/oibus-agent/odbc","draft":false,"unlisted":false,"tags":[],"version":"current","sidebarPosition":2,"frontMatter":{"sidebar_position":2},"sidebar":"guideSidebar","previous":{"title":"Concept and installation","permalink":"/zh/docs/guide/oibus-agent/installation"},"next":{"title":"OPC","permalink":"/zh/docs/guide/oibus-agent/opc"}}');var i=t(4848),c=t(8453);const s={sidebar_position:2},d="ODBC",r={},a=[{value:"HTTP API",id:"http-api",level:2},{value:"Status",id:"status",level:3},{value:"Connection",id:"connection",level:3},{value:"Read",id:"read",level:3},{value:"Disconnection",id:"disconnection",level:3}];function l(e){const n={code:"code",h1:"h1",h2:"h2",h3:"h3",header:"header",p:"p",pre:"pre",...(0,c.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(n.header,{children:(0,i.jsx)(n.h1,{id:"odbc",children:"ODBC"})}),"\n",(0,i.jsx)(n.p,{children:"Send HTTP queries to connect to an ODBC driver and read data through SQL queries."}),"\n",(0,i.jsx)(n.h2,{id:"http-api",children:"HTTP API"}),"\n",(0,i.jsx)(n.h3,{id:"status",children:"Status"}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:"curl --location 'http://localhost:2224/api/odbc/id/status'\n"})}),"\n",(0,i.jsx)(n.h3,{id:"connection",children:"Connection"}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:"curl --location --request PUT 'http://localhost:2224/api/odbc/id/connect' \\\n--header 'Content-Type: application/json' \\\n--data '{\n\"connectionString\": \"Driver={AspenTech SQLplus};HOST=localhost;PORT=10014\",\n\"connectionTimeout\": 10000\n}'\n"})}),"\n",(0,i.jsx)(n.h3,{id:"read",children:"Read"}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:'curl --location --request PUT \'http://localhost:2224/api/odbc/id/read\' \\\n--header \'Content-Type: application/json\' \\\n--data \'{\n    "connectionString": "Driver={AspenTech SQLplus};HOST=localhost;PORT=10014",\n    "sql": "SELECT timestamp, reference, value FROM demo",\n    "readTimeout": 10000,\n    "timeColumn": "timestamp",\n    "datasourceTimestampFormat": "yyyy-MM-dd HH:mm:ss.SSS",\n    "datasourceTimezone": "Europe/Paris",\n    "delimiter": ";",\n    "outputTimestampFormat": "yyyy-MM-dd HH:mm:ss.SSS",\n    "outputTimezone": "UTC"\n}\'\n'})}),"\n",(0,i.jsx)(n.h3,{id:"disconnection",children:"Disconnection"}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:"curl --location --request DELETE 'http://localhost:2224/api/odbc/id/disconnect'\n"})})]})}function u(e={}){const{wrapper:n}={...(0,c.R)(),...e.components};return n?(0,i.jsx)(n,{...e,children:(0,i.jsx)(l,{...e})}):l(e)}},8453:(e,n,t)=>{t.d(n,{R:()=>s,x:()=>d});var o=t(6540);const i={},c=o.createContext(i);function s(e){const n=o.useContext(c);return o.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function d(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:s(e.components),o.createElement(c.Provider,{value:n},e.children)}}}]);