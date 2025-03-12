"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[7444],{9859:(e,t,s)=>{s.r(t),s.d(t,{assets:()=>c,contentTitle:()=>r,default:()=>h,frontMatter:()=>a,metadata:()=>n,toc:()=>l});const n=JSON.parse('{"id":"guide/installation/first-access","title":"First access","description":"OIBus configuration interface is available on http2223.","source":"@site/docs/guide/installation/first-access.mdx","sourceDirName":"guide/installation","slug":"/guide/installation/first-access","permalink":"/docs/guide/installation/first-access","draft":false,"unlisted":false,"tags":[],"version":"current","sidebarPosition":5,"frontMatter":{"sidebar_position":5},"sidebar":"guideSidebar","previous":{"title":"Installation","permalink":"/docs/guide/installation/"},"next":{"title":"Migrate to v3","permalink":"/docs/guide/installation/migrate"}}');var i=s(4848),o=s(8453);const a={sidebar_position:5},r="First access",c={},l=[{value:"OIBus pages",id:"oibus-pages",level:2},{value:"Home page",id:"home-page",level:3},{value:"Engine",id:"engine",level:3},{value:"North",id:"north",level:3},{value:"South",id:"south",level:3},{value:"History",id:"history",level:3},{value:"Logs",id:"logs",level:3},{value:"About",id:"about",level:3},{value:"User settings",id:"user-settings",level:3}];function d(e){const t={a:"a",admonition:"admonition",code:"code",em:"em",h1:"h1",h2:"h2",h3:"h3",header:"header",img:"img",p:"p",pre:"pre",strong:"strong",...(0,o.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(t.header,{children:(0,i.jsx)(t.h1,{id:"first-access",children:"First access"})}),"\n",(0,i.jsxs)(t.p,{children:["OIBus configuration interface is available on ",(0,i.jsx)(t.code,{children:"http://localhost:2223"}),"."]}),"\n",(0,i.jsxs)(t.admonition,{title:"Default access",type:"caution",children:[(0,i.jsxs)(t.p,{children:["By default, the user is ",(0,i.jsx)(t.strong,{children:"admin"})," and the password is ",(0,i.jsx)(t.strong,{children:"pass"}),"."]}),(0,i.jsxs)(t.p,{children:["We strongly advise to change the password in the ",(0,i.jsx)(t.a,{href:"#user-settings",children:"user settings"}),"."]})]}),"\n",(0,i.jsx)(t.h2,{id:"oibus-pages",children:"OIBus pages"}),"\n",(0,i.jsx)(t.h3,{id:"home-page",children:"Home page"}),"\n",(0,i.jsx)(t.p,{children:"The OIBus home page show enabled connectors and the engine with their associated metrics."}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)(t.p,{children:(0,i.jsx)(t.img,{alt:"Home page",src:s(5693).A+"",width:"1469",height:"1061"})})}),"\n",(0,i.jsx)(t.p,{children:"The magnifying glass icon redirect you to the display page of the connector or of the engine."}),"\n",(0,i.jsx)(t.h3,{id:"engine",children:"Engine"}),"\n",(0,i.jsxs)(t.p,{children:["The engine page allows you to set logger, ",(0,i.jsx)(t.a,{href:"/docs/guide/engine/scan-modes",children:"Scan Modes"})," and ",(0,i.jsx)(t.a,{href:"/docs/guide/engine/ip-filters",children:"IP Filters"}),"."]}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)(t.p,{children:(0,i.jsx)(t.img,{alt:"Engine",src:s(3178).A+"",width:"1260",height:"821"})})}),"\n",(0,i.jsx)(t.p,{children:"The restart button and the shutdown button has an effect on the engine only, not on the service. It means it will shut down\nthe connectors, but not the web service, which allows you to still access the OIBus interface."}),"\n",(0,i.jsxs)(t.p,{children:["When installing OIBus, remember to choose an appropriate name. The ",(0,i.jsx)(t.em,{children:"Engine name"})," is important mainly if you use several\nOIBus and send the logs to a remote ",(0,i.jsx)(t.a,{href:"/docs/guide/engine/engine-settings#loki",children:"loki instance"})," or when you register OIBus into OIAnalytics."]}),"\n",(0,i.jsxs)(t.p,{children:[(0,i.jsx)(t.a,{href:"../advanced/oianalytics-registration",children:"Registering OIBus into OIAnalytics"})," is useful when sending data to a ",(0,i.jsx)(t.a,{href:"../north-connectors/oianalytics",children:"North OIAnalytics"}),"\nconnector and when sending logs to OIAnalytics. From OIAnalytics, once registered, you can update OIBus remotely or parse the logs."]}),"\n",(0,i.jsxs)(t.admonition,{title:"Allow remote access by adding an IP filter with curl",type:"tip",children:[(0,i.jsx)(t.p,{children:"If you want to automatize the setup of OIBus, and access it remotely, you can send a curl command to accept connection\nfrom various IP addresses. Here is an example that accepts all IP addresses."}),(0,i.jsx)(t.pre,{children:(0,i.jsx)(t.code,{className:"language-curl",metastring:'title="curl command"',children:'curl --location --request POST "http://localhost:2223/api/ip-filters" --header "Content-Type: application/json" --data-raw "{\\"address\\": \\"*\\", \\"description\\": \\"All\\" }" -u "admin:pass"\n'})})]}),"\n",(0,i.jsx)(t.h3,{id:"north",children:"North"}),"\n",(0,i.jsx)(t.p,{children:'To add a North connector, simply click the "+" button.'}),"\n",(0,i.jsx)(t.p,{children:"On the list's right-hand side, you have the options to activate/deactivate a connector, access its display page or\nediting form, create a duplicate, or delete it."}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)(t.p,{children:(0,i.jsx)(t.img,{alt:"North",src:s(1543).A+"",width:"1148",height:"465"})})}),"\n",(0,i.jsx)(t.h3,{id:"south",children:"South"}),"\n",(0,i.jsx)(t.p,{children:'To add a South connector, simply click the "+" button.'}),"\n",(0,i.jsx)(t.p,{children:"On the list's right-hand side, you have the options to activate/deactivate a connector, access its display page or\nediting form, create a duplicate, or delete it."}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)(t.p,{children:(0,i.jsx)(t.img,{alt:"South",src:s(4421).A+"",width:"1133",height:"634"})})}),"\n",(0,i.jsx)(t.h3,{id:"history",children:"History"}),"\n",(0,i.jsx)(t.p,{children:'To add a History query, simply click the "+" button. You can then either create a History query from scratch or\nby importing existing South or North settings.'}),"\n",(0,i.jsx)(t.p,{children:"On the list's right-hand side, you have the options to activate/deactivate a connector, access its display page or\nediting form, create a duplicate, or delete it."}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)(t.p,{children:(0,i.jsx)(t.img,{alt:"History Queries",src:s(6949).A+"",width:"1281",height:"439"})})}),"\n",(0,i.jsx)(t.h3,{id:"logs",children:"Logs"}),"\n",(0,i.jsx)(t.p,{children:"The log page automatically refreshes every 10 seconds. You have the ability to filter the logs based on dates, log level,\nlog type (logs generated by South, North, engine, etc.), scope (the connector or history query responsible for the log),\nor the content of the log message."}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)(t.p,{children:(0,i.jsx)(t.img,{alt:"Logs",src:s(6393).A+"",width:"1269",height:"500"})})}),"\n",(0,i.jsx)(t.h3,{id:"about",children:"About"}),"\n",(0,i.jsx)(t.p,{children:"Information about the OIBus process and link to the documentation."}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)(t.p,{children:(0,i.jsx)(t.img,{alt:"About",src:s(3433).A+"",width:"1512",height:"352"})})}),"\n",(0,i.jsx)(t.h3,{id:"user-settings",children:"User settings"}),"\n",(0,i.jsx)(t.p,{children:"You can modify your password and select the timezone for how you'd like dates to appear in the interface."}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)(t.p,{children:(0,i.jsx)(t.img,{alt:"User settings",src:s(7931).A+"",width:"1512",height:"331"})})})]})}function h(e={}){const{wrapper:t}={...(0,o.R)(),...e.components};return t?(0,i.jsx)(t,{...e,children:(0,i.jsx)(d,{...e})}):d(e)}},3433:(e,t,s)=>{s.d(t,{A:()=>n});const n=s.p+"assets/images/about-97755b871577a200b7ff6b5d44871357.png"},3178:(e,t,s)=>{s.d(t,{A:()=>n});const n=s.p+"assets/images/engine-422d059483ce0fa96dc5791e8b8ef357.png"},6949:(e,t,s)=>{s.d(t,{A:()=>n});const n=s.p+"assets/images/history-query-37b46683783e4838e6b271e8a3758575.png"},5693:(e,t,s)=>{s.d(t,{A:()=>n});const n=s.p+"assets/images/home-page-d5db6eeb9a272d3523e46446aa0dc7c0.png"},6393:(e,t,s)=>{s.d(t,{A:()=>n});const n=s.p+"assets/images/logs-f3c4d32fa3f7969f4e575327342c39a2.png"},1543:(e,t,s)=>{s.d(t,{A:()=>n});const n=s.p+"assets/images/north-4b6cf2332b9fd3207a3f8dd3dca2212a.png"},4421:(e,t,s)=>{s.d(t,{A:()=>n});const n=s.p+"assets/images/south-a24ff2975bf0d3c66947e71106628a28.png"},7931:(e,t,s)=>{s.d(t,{A:()=>n});const n=s.p+"assets/images/user-settings-bb3f3410b7eefefbc11c70d0ffc883a5.png"},8453:(e,t,s)=>{s.d(t,{R:()=>a,x:()=>r});var n=s(6540);const i={},o=n.createContext(i);function a(e){const t=n.useContext(o);return n.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function r(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:a(e.components),n.createElement(o.Provider,{value:t},e.children)}}}]);