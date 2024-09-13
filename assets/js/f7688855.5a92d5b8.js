"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[6038],{3699:(e,t,i)=>{i.r(t),i.d(t,{assets:()=>u,contentTitle:()=>o,default:()=>l,frontMatter:()=>s,metadata:()=>a,toc:()=>c});var n=i(4848),r=i(8453);const s={sidebar_position:6},o="History queries",a={id:"guide/history-queries",title:"History queries",description:"OIBus primarily serves as a tool for data streaming, allowing you to retrieve data in real-time from various sources,",source:"@site/docs/guide/history-queries.md",sourceDirName:"guide",slug:"/guide/history-queries",permalink:"/docs/guide/history-queries",draft:!1,unlisted:!1,tags:[],version:"current",sidebarPosition:6,frontMatter:{sidebar_position:6},sidebar:"guideSidebar",previous:{title:"OSIsoft PI",permalink:"/docs/guide/south-connectors/osisoft-pi"},next:{title:"Advanced",permalink:"/docs/category/advanced"}},u={},c=[{value:"Create a History Query",id:"create-a-history-query",level:2},{value:"History main query settings",id:"history-main-query-settings",level:2},{value:"Resilience",id:"resilience",level:2},{value:"Running a query",id:"running-a-query",level:2}];function h(e){const t={admonition:"admonition",code:"code",h1:"h1",h2:"h2",header:"header",p:"p",strong:"strong",...(0,r.R)(),...e.components};return(0,n.jsxs)(n.Fragment,{children:[(0,n.jsx)(t.header,{children:(0,n.jsx)(t.h1,{id:"history-queries",children:"History queries"})}),"\n",(0,n.jsx)(t.p,{children:"OIBus primarily serves as a tool for data streaming, allowing you to retrieve data in real-time from various sources,\nsuch as points or files. However, it can also be valuable for retrieving historical data in situations where you need to\naccess information prior to setting up the data streaming process. In such instances, historical queries can prove to\nbe exceptionally beneficial."}),"\n",(0,n.jsx)(t.h2,{id:"create-a-history-query",children:"Create a History Query"}),"\n",(0,n.jsx)(t.p,{children:"On the History Query page, you have the option to generate new history query either through new South and North connectors\nor by choosing from existing South/North connectors."}),"\n",(0,n.jsx)(t.admonition,{type:"info",children:(0,n.jsx)(t.p,{children:"You can select South connectors for historical data retrieval, but only those that are compatible with the historian,\nsuch as OPC UA, MSSQL, and others."})}),"\n",(0,n.jsx)(t.p,{children:"When you select both the South and North connectors, all the information, including items from the South, is copied into\nthe new History query. Please remove any unnecessary items."}),"\n",(0,n.jsx)(t.h2,{id:"history-main-query-settings",children:"History main query settings"}),"\n",(0,n.jsxs)(t.p,{children:["When you edit a History query, make sure to specify the start time and end time. If the time interval is substantial,\nyou have the option to divide the query into smaller intervals within the ",(0,n.jsx)(t.code,{children:"History settings"})," section."]}),"\n",(0,n.jsx)(t.admonition,{title:"About SQL connectors",type:"caution",children:(0,n.jsxs)(t.p,{children:["Make sure to incorporate the ",(0,n.jsx)(t.strong,{children:"@StartTime"})," and ",(0,n.jsx)(t.strong,{children:"@EndTime"})," variables in SQL queries to effectively utilize split intervals."]})}),"\n",(0,n.jsx)(t.h2,{id:"resilience",children:"Resilience"}),"\n",(0,n.jsx)(t.p,{children:"The maximum instant retrieved from a query is stored in a local cache database. In the event of a connection failure\nduring a history query, OIBus will attempt to reconnect. Upon successful reconnection, it will resume the query from its\nlast recorded maximum instant."}),"\n",(0,n.jsxs)(t.p,{children:["Certain connectors, such as OPC UA, offer the ability to group items together to share the same maximum instant. This\ngrouping enhances OIBus's performance. However, there may be situations where it's beneficial to isolate individual items.\nTo achieve this, you can select the ",(0,n.jsx)(t.strong,{children:"Max instant per item"})," option."]}),"\n",(0,n.jsx)(t.admonition,{title:"When to use Max instant per item",type:"tip",children:(0,n.jsx)(t.p,{children:"If data is not stored synchronously in the OPC UA server, there is a risk of losing some of it. To prevent such loss,\nit's advisable to maintain a maximum instant per item. However, it's important to exercise caution, as this approach will\nresult in a separate query for each item instead of grouping them. While this ensures that you keep track of individual\nmaximum instants, it may also potentially overload the server due to the increased query volume."})}),"\n",(0,n.jsx)(t.h2,{id:"running-a-query",children:"Running a query"}),"\n",(0,n.jsx)(t.p,{children:"You have the flexibility to initiate or pause a history query from its editing page, the list page, or the display page.\nWhen on the display page, you can also monitor the progress and status of the history query."}),"\n",(0,n.jsx)(t.admonition,{type:"caution",children:(0,n.jsx)(t.p,{children:"When you make modifications to a history query by adding, removing, or updating items, the query will restart from the\nspecified start time."})})]})}function l(e={}){const{wrapper:t}={...(0,r.R)(),...e.components};return t?(0,n.jsx)(t,{...e,children:(0,n.jsx)(h,{...e})}):h(e)}},8453:(e,t,i)=>{i.d(t,{R:()=>o,x:()=>a});var n=i(6540);const r={},s=n.createContext(r);function o(e){const t=n.useContext(s);return n.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function a(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:o(e.components),n.createElement(s.Provider,{value:t},e.children)}}}]);