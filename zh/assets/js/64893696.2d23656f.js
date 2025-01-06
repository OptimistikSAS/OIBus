"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[8014],{254:(e,n,o)=>{o.r(n),o.d(n,{assets:()=>a,contentTitle:()=>c,default:()=>h,frontMatter:()=>r,metadata:()=>t,toc:()=>d});const t=JSON.parse('{"id":"guide/north-connectors/oiconnect","title":"OIConnect","description":"OIConnect is a North connector used to send both files and JSON payloads to a REST API endpoint (one for JSON, one for","source":"@site/versioned_docs/version-v2/guide/north-connectors/oiconnect.md","sourceDirName":"guide/north-connectors","slug":"/guide/north-connectors/oiconnect","permalink":"/zh/docs/v2/guide/north-connectors/oiconnect","draft":false,"unlisted":false,"tags":[],"version":"v2","sidebarPosition":3,"frontMatter":{"sidebar_position":3},"sidebar":"guideSidebar","previous":{"title":"OIAnalytics","permalink":"/zh/docs/v2/guide/north-connectors/oianalytics"},"next":{"title":"File Writer","permalink":"/zh/docs/v2/guide/north-connectors/file-writer"}}');var s=o(4848),i=o(8453);const r={sidebar_position:3},c="OIConnect",a={},d=[{value:"Connection",id:"connection",level:2},{value:"JSON payload",id:"json-payload",level:2},{value:"Query param",id:"query-param",level:2},{value:"Connecting two OIBus together",id:"connecting-two-oibus-together",level:2}];function l(e){const n={a:"a",code:"code",em:"em",h1:"h1",h2:"h2",header:"header",li:"li",p:"p",pre:"pre",strong:"strong",ul:"ul",...(0,i.R)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(n.header,{children:(0,s.jsx)(n.h1,{id:"oiconnect",children:"OIConnect"})}),"\n",(0,s.jsx)(n.p,{children:"OIConnect is a North connector used to send both files and JSON payloads to a REST API endpoint (one for JSON, one for\nfiles). The files are not transformed, they are sent as they are received by the North (compressed or not)."}),"\n",(0,s.jsx)(n.h2,{id:"connection",children:"Connection"}),"\n",(0,s.jsx)(n.p,{children:"To send data (JSON or files) to OIAnalytics, the following fields must be filled:"}),"\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Host"}),": the hostname of the SaaS application (example: ",(0,s.jsx)(n.code,{children:"https://myapp.mycompany.com"}),")"]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Values endpoint"}),": the endpoint that will receive JSON payloads ",(0,s.jsx)(n.a,{href:"#json-payload",children:"(see JSON payload section)"})]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"File endpoint"}),": the endpoint that will receive files"]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Host"}),": the hostname of the SaaS application (example: ",(0,s.jsx)(n.code,{children:"https://myapp.mycompany.com"}),")"]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Authentication type"}),": Basic, Bearer, Api key (custom)"]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Username"})," (for ",(0,s.jsx)(n.em,{children:"Basic"}),"): the username to connect to"]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Password"})," (for ",(0,s.jsx)(n.em,{children:"Basic"}),"): the password associated to the username"]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Token"})," (for ",(0,s.jsx)(n.em,{children:"Bearer"}),"): The token to use in the HTTP header"]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Key"})," (for ",(0,s.jsx)(n.em,{children:"API key"}),"): the name of the key field in the HTTP header"]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Secret"})," (for ",(0,s.jsx)(n.em,{children:"API key"}),"): the value associated to the key field in the HTTP header"]}),"\n"]}),"\n",(0,s.jsx)(n.h2,{id:"json-payload",children:"JSON payload"}),"\n",(0,s.jsx)(n.p,{children:"The target application must be able to manage the payload that OIConnect send. Here is a payload example:"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-json",children:'[\n  {\n    "timestamp": "2020-01-01T00:00:00.000Z",\n    "data": "{ value: 28 }",\n    "pointId": "MyPointId1"\n  }\n]\n'})}),"\n",(0,s.jsx)(n.h2,{id:"query-param",children:"Query param"}),"\n",(0,s.jsxs)(n.p,{children:["A query param is added to the HTTP query. It is called ",(0,s.jsx)(n.em,{children:"name"})," and can be used to identify the source of the data.\nIts value is in the form of ",(0,s.jsx)(n.em,{children:(0,s.jsx)(n.code,{children:"<oibus-name>:<north-connector-name>"})}),"."]}),"\n",(0,s.jsxs)(n.p,{children:["Example of an HTTP query: ",(0,s.jsx)(n.code,{children:"http://1.2.3.4:2223/engine/addValues?name=MyOIBus:MyOIConnect"})]}),"\n",(0,s.jsx)(n.h2,{id:"connecting-two-oibus-together",children:"Connecting two OIBus together"}),"\n",(0,s.jsxs)(n.p,{children:["See ",(0,s.jsx)(n.a,{href:"/zh/docs/v2/guide/advanced/oibus-to-oibus",children:"this doc"})," to learn more on how to connect one OIBus to another."]})]})}function h(e={}){const{wrapper:n}={...(0,i.R)(),...e.components};return n?(0,s.jsx)(n,{...e,children:(0,s.jsx)(l,{...e})}):l(e)}},8453:(e,n,o)=>{o.d(n,{R:()=>r,x:()=>c});var t=o(6540);const s={},i=t.createContext(s);function r(e){const n=t.useContext(i);return t.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function c(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:r(e.components),t.createElement(i.Provider,{value:n},e.children)}}}]);