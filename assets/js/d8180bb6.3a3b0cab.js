"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[4610],{647:(e,n,s)=>{s.r(n),s.d(n,{assets:()=>d,contentTitle:()=>c,default:()=>l,frontMatter:()=>o,metadata:()=>i,toc:()=>a});const i=JSON.parse('{"id":"guide/engine/scan-modes","title":"Scan modes","description":"Cron-defined scan modes are utilized in OIBus to retrieve or send data from","source":"@site/docs/guide/engine/scan-modes.md","sourceDirName":"guide/engine","slug":"/guide/engine/scan-modes","permalink":"/docs/guide/engine/scan-modes","draft":false,"unlisted":false,"tags":[],"version":"current","sidebarPosition":3,"frontMatter":{"sidebar_position":3},"sidebar":"guideSidebar","previous":{"title":"Engine settings","permalink":"/docs/guide/engine/engine-settings"},"next":{"title":"IP Filters","permalink":"/docs/guide/engine/ip-filters"}}');var t=s(4848),r=s(8453);const o={sidebar_position:3},c="Scan modes",d={},a=[];function u(e){const n={a:"a",h1:"h1",header:"header",li:"li",p:"p",ul:"ul",...(0,r.R)(),...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.header,{children:(0,t.jsx)(n.h1,{id:"scan-modes",children:"Scan modes"})}),"\n",(0,t.jsxs)(n.p,{children:["Cron-defined scan modes are utilized in OIBus to retrieve or send data from\n",(0,t.jsx)(n.a,{href:"/docs/guide/south-connectors/common-settings",children:"South connectors"})," at specific dates and intervals."]}),"\n",(0,t.jsx)(n.p,{children:"There are six default scan modes:"}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsx)(n.li,{children:"Every second: (* * * * * *)"}),"\n",(0,t.jsx)(n.li,{children:"Every 10 seconds: (/10 * * * *)"}),"\n",(0,t.jsx)(n.li,{children:"Every minute: (0 * * * * *), running every minute at precisely 0 seconds."}),"\n",(0,t.jsx)(n.li,{children:"Every 10 minutes: (0 /10 * * *), running every 10 minutes at precisely 0 seconds."}),"\n",(0,t.jsx)(n.li,{children:"Every hour: (0 0 * * * *), running every hour at precisely 0 seconds."}),"\n",(0,t.jsx)(n.li,{children:"Every 24 hours: (0 0 0 * * *), running every day at midnight exactly."}),"\n"]}),"\n",(0,t.jsxs)(n.p,{children:["You have the option to create your custom scan modes by adding one, assigning it a name, and specifying the Cron expression.\nYou can test your Cron expression using the following website: ",(0,t.jsx)(n.a,{href:"https://crontab.cronhub.io/",children:"https://crontab.cronhub.io/"}),"."]})]})}function l(e={}){const{wrapper:n}={...(0,r.R)(),...e.components};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(u,{...e})}):u(e)}},8453:(e,n,s)=>{s.d(n,{R:()=>o,x:()=>c});var i=s(6540);const t={},r=i.createContext(t);function o(e){const n=i.useContext(r);return i.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function c(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(t):e.components||t:o(e.components),i.createElement(r.Provider,{value:n},e.children)}}}]);