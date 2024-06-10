"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[6854],{7879:(e,s,t)=>{t.r(s),t.d(s,{assets:()=>a,contentTitle:()=>o,default:()=>l,frontMatter:()=>r,metadata:()=>d,toc:()=>c});var i=t(4848),n=t(8453);const r={displayed_sidebar:"useCasesSidebar",sidebar_position:4},o="Modbus \u2192 File Writer",d={id:"use-cases/use-case-modbus",title:"Modbus \u2192 File Writer",description:"Beforehand",source:"@site/i18n/zh/docusaurus-plugin-content-docs/current/use-cases/use-case-modbus.mdx",sourceDirName:"use-cases",slug:"/use-cases/use-case-modbus",permalink:"/zh/docs/use-cases/use-case-modbus",draft:!1,unlisted:!1,tags:[],version:"current",sidebarPosition:4,frontMatter:{displayed_sidebar:"useCasesSidebar",sidebar_position:4},sidebar:"useCasesSidebar",previous:{title:"TwinCAT ADS \u2192 OIAnalytics",permalink:"/zh/docs/use-cases/use-case-ads"}},a={},c=[{value:"Beforehand",id:"beforehand",level:2},{value:"South Modbus",id:"south-modbus",level:2},{value:"Items",id:"items",level:3},{value:"North File Writer",id:"north-file-writer",level:2}];function h(e){const s={a:"a",admonition:"admonition",code:"code",h1:"h1",h2:"h2",h3:"h3",img:"img",p:"p",...(0,n.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(s.h1,{id:"modbus--file-writer",children:"Modbus \u2192 File Writer"}),"\n",(0,i.jsx)(s.h2,{id:"beforehand",children:"Beforehand"}),"\n",(0,i.jsx)(s.p,{children:"This use case is useful to properly test OIBus. You can use a Modbus Simulator."}),"\n",(0,i.jsxs)(s.p,{children:["Details regarding the configurations can be located on the ",(0,i.jsx)(s.a,{href:"/zh/docs/guide/north-connectors/file-writer",children:"North File Writer"}),"\nand ",(0,i.jsx)(s.a,{href:"/zh/docs/guide/south-connectors/modbus",children:"South Modbus"})," connectors pages."]}),"\n",(0,i.jsx)(s.p,{children:"This specific scenario is constructed around the depicted fictional network."}),"\n",(0,i.jsx)("div",{style:{display:"flex",justifyContent:"center",marginBottom:"2rem"},children:(0,i.jsx)("div",{children:(0,i.jsx)(s.p,{children:(0,i.jsx)(s.img,{alt:"Modbus -&gt; File writer",src:t(7225).A+"",width:"804",height:"617"})})})}),"\n",(0,i.jsx)(s.h2,{id:"south-modbus",children:"South Modbus"}),"\n",(0,i.jsx)(s.p,{children:"Be sure to have the URL (or IP address) of the Modbus server and the access port (typically 502). Some servers (or\nmasters) may have multiple clients (or slaves) connected. Be sure to know the slave ID to distinguish the target, or\nmaintain it as 1 if there is only one slave."}),"\n",(0,i.jsxs)(s.p,{children:["In this example, the IP address is ",(0,i.jsx)(s.code,{children:"10.0.0.1"})," and the port is ",(0,i.jsx)(s.code,{children:"502"}),"."]}),"\n",(0,i.jsx)(s.p,{children:"Based on the address schema of the PLC, opt for either JBus or Modbus offset to indicate whether register addresses\nstart at 0 or 1."}),"\n",(0,i.jsx)(s.p,{children:"Additionally, note that PLCs may store retrieved values differently. Be sure to know the endianness, byte swapping, and\nword swapping."}),"\n",(0,i.jsx)("div",{style:{display:"flex",justifyContent:"center",marginBottom:"2rem"},children:(0,i.jsx)("div",{children:(0,i.jsx)(s.p,{children:(0,i.jsx)(s.img,{alt:"Modbus settings",src:t(8449).A+"",width:"1914",height:"442"})})})}),"\n",(0,i.jsx)(s.admonition,{title:"Testing connection",type:"tip",children:(0,i.jsxs)(s.p,{children:["You can verify the connection by testing the settings using the ",(0,i.jsx)(s.code,{children:"Test settings"})," button."]})}),"\n",(0,i.jsx)(s.h3,{id:"items",children:"Items"}),"\n",(0,i.jsxs)(s.p,{children:["Include the addresses you intend to read. Consult the person responsible for the Modbus server to identify the available\naddresses, their Modbus type, data type, and multiplier coefficient.\nChoose a ",(0,i.jsx)(s.a,{href:"/zh/docs/guide/engine/scan-modes",children:"scan mode"})," to retrieve the data."]}),"\n",(0,i.jsx)("div",{style:{display:"flex",justifyContent:"center"},children:(0,i.jsx)("div",{children:(0,i.jsx)(s.p,{children:(0,i.jsx)(s.img,{alt:"Modbus item settings",src:t(5391).A+"",width:"2280",height:"474"})})})}),"\n",(0,i.jsx)(s.admonition,{title:"Massive import",type:"tip",children:(0,i.jsxs)(s.p,{children:["For bulk item import, start by clicking the ",(0,i.jsx)(s.code,{children:"Export"})," button to obtain a CSV file with the correct columns. Each line in\nthe file will correspond to a new item. Ensure that the names are unique."]})}),"\n",(0,i.jsx)(s.h2,{id:"north-file-writer",children:"North File Writer"}),"\n",(0,i.jsxs)(s.p,{children:["Be sure to have the path to the folder that needs to be accessed. The user running OIBus must have the appropriate\naccess rights for that folder (here ",(0,i.jsx)(s.code,{children:"D:\\Data"}),")"]}),"\n",(0,i.jsxs)(s.admonition,{title:"OIBus System user",type:"info",children:[(0,i.jsx)(s.p,{children:"When OIBus operates as a service on Windows, the default user is SYSTEM. You can modify this setting through the service\nmanagement tool by selecting OIBus and changing the user running the service. After saving the changes, make sure to\nrestart the service."}),(0,i.jsx)(s.p,{children:"OIBus has the capability to access remote folders. In such instances, recheck the user permissions for accessing the\nremote folder. Keep in mind that SYSTEM users on Windows may not have access to remote folders."})]}),"\n",(0,i.jsx)(s.p,{children:"OIBus offers the capability to generate either files or JSON values. Files will be directly written as they are, while\nJSON values will be converted into JSON files."}),"\n",(0,i.jsx)(s.p,{children:"Additionally, you have the option to specify a prefix and suffix to be appended to each file written in the output folder."}),"\n",(0,i.jsx)("div",{style:{display:"flex",justifyContent:"center",marginBottom:"2rem"},children:(0,i.jsx)("div",{children:(0,i.jsx)(s.p,{children:(0,i.jsx)(s.img,{alt:"File writer settings",src:t(9957).A+"",width:"1914",height:"326"})})})}),"\n",(0,i.jsx)(s.admonition,{title:"Testing connection",type:"tip",children:(0,i.jsxs)(s.p,{children:["You can verify the connection by testing the settings using the ",(0,i.jsx)(s.code,{children:"Test settings"})," button."]})})]})}function l(e={}){const{wrapper:s}={...(0,n.R)(),...e.components};return s?(0,i.jsx)(s,{...e,children:(0,i.jsx)(h,{...e})}):h(e)}},9957:(e,s,t)=>{t.d(s,{A:()=>i});const i=t.p+"assets/images/file-writer-settings-ecd3a36d90271370d99d7176358d43dd.png"},7225:(e,s,t)=>{t.d(s,{A:()=>i});const i=t.p+"assets/images/modbus-file-writer-73f14d83fd18137ca1bfa13ca549873c.svg"},5391:(e,s,t)=>{t.d(s,{A:()=>i});const i=t.p+"assets/images/modbus-item-5138691feae8aaf2a7a5c6270371181b.png"},8449:(e,s,t)=>{t.d(s,{A:()=>i});const i=t.p+"assets/images/modbus-settings-df23e1d7cbf88278ac5d14a33da96638.png"},8453:(e,s,t)=>{t.d(s,{R:()=>o,x:()=>d});var i=t(6540);const n={},r=i.createContext(n);function o(e){const s=i.useContext(r);return i.useMemo((function(){return"function"==typeof e?e(s):{...s,...e}}),[s,e])}function d(e){let s;return s=e.disableParentContext?"function"==typeof e.components?e.components(n):e.components||n:o(e.components),i.createElement(r.Provider,{value:s},e.children)}}}]);