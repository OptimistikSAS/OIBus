"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[3036],{8703:(e,s,n)=>{n.r(s),n.d(s,{assets:()=>d,contentTitle:()=>a,default:()=>h,frontMatter:()=>o,metadata:()=>t,toc:()=>c});const t=JSON.parse('{"id":"use-cases/use-case-advanced","title":"Advanced use case","description":"Beforehand","source":"@site/i18n/zh/docusaurus-plugin-content-docs/current/use-cases/use-case-advanced.mdx","sourceDirName":"use-cases","slug":"/use-cases/use-case-advanced","permalink":"/zh/docs/use-cases/use-case-advanced","draft":false,"unlisted":false,"tags":[],"version":"current","sidebarPosition":7,"frontMatter":{"displayed_sidebar":"useCasesSidebar","sidebar_position":7},"sidebar":"useCasesSidebar","previous":{"title":"OSIsoftPI \u2192 OIAnalytics","permalink":"/zh/docs/use-cases/use-case-pi"}}');var i=n(4848),r=n(8453);const o={displayed_sidebar:"useCasesSidebar",sidebar_position:7},a="Advanced use case",d={},c=[{value:"Beforehand",id:"beforehand",level:2},{value:"Several OIBus",id:"several-oibus",level:2},{value:"OIBus IT",id:"oibus-it",level:2},{value:"South Connectors",id:"south-connectors",level:3},{value:"MSSQL",id:"mssql",level:4},{value:"MQTT",id:"mqtt",level:4},{value:"Folder Scanner",id:"folder-scanner",level:4},{value:"ODBC (with Remote OIBus Agent)",id:"odbc-with-remote-oibus-agent",level:4},{value:"OSIsoft PI (with Remote OIBus Agent)",id:"osisoft-pi-with-remote-oibus-agent",level:4},{value:"North Connectors",id:"north-connectors",level:3},{value:"OIAnalytics",id:"oianalytics",level:4},{value:"Proxy server",id:"proxy-server",level:3},{value:"OIBus OT",id:"oibus-ot",level:2}];function l(e){const s={a:"a",h1:"h1",h2:"h2",h3:"h3",h4:"h4",header:"header",img:"img",li:"li",p:"p",strong:"strong",ul:"ul",...(0,r.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(s.header,{children:(0,i.jsx)(s.h1,{id:"advanced-use-case",children:"Advanced use case"})}),"\n",(0,i.jsx)(s.h2,{id:"beforehand",children:"Beforehand"}),"\n",(0,i.jsx)(s.p,{children:"This use case shows an advanced setup of a heterogeneous network:"}),"\n",(0,i.jsxs)(s.ul,{children:["\n",(0,i.jsx)(s.li,{children:"Operational Technology (OT) in the industrial network with PLCs"}),"\n",(0,i.jsx)(s.li,{children:"Information Technology (IT) in the enterprise network"}),"\n"]}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)("div",{children:(0,i.jsx)(s.p,{children:(0,i.jsx)(s.img,{alt:"Complex integration",src:n(794).A+"",width:"850",height:"652"})})})}),"\n",(0,i.jsx)(s.h2,{id:"several-oibus",children:"Several OIBus"}),"\n",(0,i.jsxs)(s.p,{children:["In this configuration, two OIBus are set up: ",(0,i.jsx)(s.strong,{children:"OIBus OT"})," and ",(0,i.jsx)(s.strong,{children:"OIBus IT"}),". This way, only one connection between the OT and\nIT networks needs to be allowed through the internal firewall.\n",(0,i.jsx)(s.strong,{children:"OIBus OT"})," sends data to OIAnalytics through the proxy server of ",(0,i.jsx)(s.strong,{children:"OIBus IT"}),"."]}),"\n",(0,i.jsxs)(s.p,{children:["In such a scenario, it is better to first set up the ",(0,i.jsx)(s.strong,{children:"OIBus IT"})," with its proxy server and the proper network firewall rules."]}),"\n",(0,i.jsx)(s.h2,{id:"oibus-it",children:"OIBus IT"}),"\n",(0,i.jsx)(s.h3,{id:"south-connectors",children:"South Connectors"}),"\n",(0,i.jsx)(s.h4,{id:"mssql",children:"MSSQL"}),"\n",(0,i.jsx)(s.h4,{id:"mqtt",children:"MQTT"}),"\n",(0,i.jsx)(s.h4,{id:"folder-scanner",children:"Folder Scanner"}),"\n",(0,i.jsx)(s.h4,{id:"odbc-with-remote-oibus-agent",children:"ODBC (with Remote OIBus Agent)"}),"\n",(0,i.jsx)(s.h4,{id:"osisoft-pi-with-remote-oibus-agent",children:"OSIsoft PI (with Remote OIBus Agent)"}),"\n",(0,i.jsx)(s.h3,{id:"north-connectors",children:"North Connectors"}),"\n",(0,i.jsx)(s.h4,{id:"oianalytics",children:"OIAnalytics"}),"\n",(0,i.jsxs)(s.p,{children:["It is strongly suggested to first ",(0,i.jsx)(s.a,{href:"../guide/advanced/oianalytics-registration",children:"register OIBus into OIAnalytics"})," and to use the registration inside the North OIAnalytics\nconnector."]}),"\n",(0,i.jsx)(s.h3,{id:"proxy-server",children:"Proxy server"}),"\n",(0,i.jsx)(s.p,{children:"Enable the"}),"\n",(0,i.jsx)(s.h2,{id:"oibus-ot",children:"OIBus OT"})]})}function h(e={}){const{wrapper:s}={...(0,r.R)(),...e.components};return s?(0,i.jsx)(s,{...e,children:(0,i.jsx)(l,{...e})}):l(e)}},794:(e,s,n)=>{n.d(s,{A:()=>t});const t=n.p+"assets/images/advanced-integration-0588d8597c0ca5cc3a8f6216c8e1d1af.svg"},8453:(e,s,n)=>{n.d(s,{R:()=>o,x:()=>a});var t=n(6540);const i={},r=t.createContext(i);function o(e){const s=t.useContext(r);return t.useMemo((function(){return"function"==typeof e?e(s):{...s,...e}}),[s,e])}function a(e){let s;return s=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:o(e.components),t.createElement(r.Provider,{value:s},e.children)}}}]);