"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[9780],{6798:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>c,contentTitle:()=>r,default:()=>h,frontMatter:()=>a,metadata:()=>i,toc:()=>d});const i=JSON.parse('{"id":"guide/south-connectors/osisoft-pi","title":"OSIsoft PI","description":"OSIsoft PI is a software platform used for collecting, and visualizing data from industrial operations. These data","source":"@site/i18n/zh/docusaurus-plugin-content-docs/current/guide/south-connectors/osisoft-pi.mdx","sourceDirName":"guide/south-connectors","slug":"/guide/south-connectors/osisoft-pi","permalink":"/zh/docs/guide/south-connectors/osisoft-pi","draft":false,"unlisted":false,"tags":[],"version":"current","sidebarPosition":16,"frontMatter":{"sidebar_position":16},"sidebar":"guideSidebar","previous":{"title":"OLEDB","permalink":"/zh/docs/guide/south-connectors/oledb"},"next":{"title":"\u5386\u53f2\u67e5\u8be2","permalink":"/zh/docs/guide/history-queries"}}');var s=n(4848),o=n(8453);const a={sidebar_position:16},r="OSIsoft PI",c={},d=[{value:"Specific settings",id:"specific-settings",level:2},{value:"Item settings",id:"item-settings",level:2},{value:"OSIsoft PI SDK configuration",id:"osisoft-pi-sdk-configuration",level:2},{value:"Installation",id:"installation",level:3},{value:"User creation and configuration",id:"user-creation-and-configuration",level:3},{value:"Trust configuration",id:"trust-configuration",level:3},{value:"Mapping creation",id:"mapping-creation",level:3}];function l(e){const t={a:"a",admonition:"admonition",code:"code",h1:"h1",h2:"h2",h3:"h3",header:"header",img:"img",li:"li",p:"p",strong:"strong",ul:"ul",...(0,o.R)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(t.header,{children:(0,s.jsx)(t.h1,{id:"osisoft-pi",children:"OSIsoft PI"})}),"\n",(0,s.jsxs)(t.p,{children:["OSIsoft PI is a software platform used for collecting, and visualizing data from industrial operations. These data\ncan be retrieved through the OSIsoft PI driver embedded in our ",(0,s.jsx)(t.a,{href:"/zh/docs/guide/oibus-agent/installation",children:"OIBus Agent"}),", in a\ndedicated PI module."]}),"\n",(0,s.jsx)(t.admonition,{type:"caution",children:(0,s.jsxs)(t.p,{children:["The OIBus Agent must be installed on a Windows machine to use the PI module. It can be installed on the same machine as\nOSIsoft PI or on another machine with the ",(0,s.jsx)(t.a,{href:"#osisoft-pi-sdk-configuration",children:"PI SDK properly configured"}),"."]})}),"\n",(0,s.jsx)(t.h2,{id:"specific-settings",children:"Specific settings"}),"\n",(0,s.jsx)(t.p,{children:"OIBus exchanges commands and data with the PI Agent through an HTTP communication. Therefore, several\nfields must be filled to make OIBus communicate with the PI Agent:"}),"\n",(0,s.jsxs)(t.ul,{children:["\n",(0,s.jsxs)(t.li,{children:[(0,s.jsx)(t.strong,{children:"Remote agent URL"}),": Specify the URL of the remote OIBus agent, e.g., ",(0,s.jsx)(t.code,{children:"http://ip-address-or-host:2224"}),"."]}),"\n",(0,s.jsxs)(t.li,{children:[(0,s.jsx)(t.strong,{children:"Retry interval"}),": Time to wait before retrying connection."]}),"\n"]}),"\n",(0,s.jsx)(t.h2,{id:"item-settings",children:"Item settings"}),"\n",(0,s.jsx)(t.p,{children:"When configuring each item to retrieve data in JSON payload, you'll need to specify the following specific settings:"}),"\n",(0,s.jsxs)(t.ul,{children:["\n",(0,s.jsxs)(t.li,{children:[(0,s.jsx)(t.strong,{children:"Type"}),": pointId to access a point through its fully qualified ID, or pointQuery to access a list of points that"]}),"\n",(0,s.jsxs)(t.li,{children:[(0,s.jsx)(t.strong,{children:"Point ID"}),": The fully qualified ID of the point (without the server name)"]}),"\n",(0,s.jsxs)(t.li,{children:[(0,s.jsx)(t.strong,{children:"Point Query"}),": A selector to access multiple points at once.\nSee ",(0,s.jsx)(t.a,{href:"https://docs.aveva.com/bundle/af-sdk/page/html/pipoint-query-syntax-overview.htm#Examples",children:"this documentation"}),"\nfor example."]}),"\n"]}),"\n",(0,s.jsx)(t.p,{children:"The name of the item will serve as a reference in JSON payloads if the type is pointId. For pointQuery items, the PI\nname will be used as reference."}),"\n",(0,s.jsx)(t.h2,{id:"osisoft-pi-sdk-configuration",children:"OSIsoft PI SDK configuration"}),"\n",(0,s.jsx)(t.p,{children:"When the OIBus Agent is installed on the machine of OSIsoft PI, there is no need to set a connection between the agent\nand PI because de SDK is included in PI System Access (PSA)."}),"\n",(0,s.jsx)(t.p,{children:"However, some situations ask to install the OIBus Agent remotely, with the SDK."}),"\n",(0,s.jsx)(t.h3,{id:"installation",children:"Installation"}),"\n",(0,s.jsx)(t.p,{children:"When installing the SDK, specify the default data server."}),"\n",(0,s.jsx)("div",{style:{textAlign:"center"},children:(0,s.jsx)(t.p,{children:(0,s.jsx)(t.img,{alt:"PI SDK installation",src:n(4454).A+"",width:"497",height:"477"})})}),"\n",(0,s.jsx)(t.h3,{id:"user-creation-and-configuration",children:"User creation and configuration"}),"\n",(0,s.jsx)(t.p,{children:"Create a user account on the machine domain (this domain must be accessible from both machines). If the domain does\nnot exist and cannot be created, it is possible to create one user on each machine, with the same password."}),"\n",(0,s.jsx)(t.p,{children:"OIBus Agent must be run with the user created on the previous step."}),"\n",(0,s.jsx)(t.h3,{id:"trust-configuration",children:"Trust configuration"}),"\n",(0,s.jsxs)(t.p,{children:["Open PI System Management Tools and create a trust from the ",(0,s.jsx)(t.code,{children:"Mapping & Trusts"})," section, in the ",(0,s.jsx)(t.code,{children:"Trusts"})," tab:"]}),"\n",(0,s.jsxs)(t.ul,{children:["\n",(0,s.jsx)(t.li,{children:"IP address and Net Mask of the OIBus Agent machine"}),"\n",(0,s.jsx)(t.li,{children:"Domain (if existing)"}),"\n",(0,s.jsx)(t.li,{children:"PI Identity: choose the identity that needs to connect into PI"}),"\n"]}),"\n",(0,s.jsx)("div",{style:{textAlign:"center"},children:(0,s.jsx)(t.p,{children:(0,s.jsx)(t.img,{alt:"PI SDK add trust",src:n(6089).A+"",width:"398",height:"558"})})}),"\n",(0,s.jsx)(t.p,{children:"The trust has been added on the trust list:"}),"\n",(0,s.jsx)("div",{style:{textAlign:"center"},children:(0,s.jsx)(t.p,{children:(0,s.jsx)(t.img,{alt:"PI SDK list trust",src:n(9879).A+"",width:"1562",height:"807"})})}),"\n",(0,s.jsx)(t.h3,{id:"mapping-creation",children:"Mapping creation"}),"\n",(0,s.jsxs)(t.p,{children:["Still on the PI System Management Tools, create a mapping from the ",(0,s.jsx)(t.code,{children:"Mapping & Trusts"})," section, in the ",(0,s.jsx)(t.code,{children:"Mappings"})," tab:"]}),"\n",(0,s.jsxs)(t.ul,{children:["\n",(0,s.jsx)(t.li,{children:"Select the user used by the OIBus Agent service"}),"\n",(0,s.jsx)(t.li,{children:"PI Identity: the identity indicated in the trust"}),"\n"]}),"\n",(0,s.jsx)("div",{style:{textAlign:"center"},children:(0,s.jsx)(t.p,{children:(0,s.jsx)(t.img,{alt:"PI SDK add mapping",src:n(4691).A+"",width:"452",height:"350"})})}),"\n",(0,s.jsx)(t.p,{children:"The mapping has been added on the mapping list:"}),"\n",(0,s.jsx)("div",{style:{textAlign:"center"},children:(0,s.jsx)(t.p,{children:(0,s.jsx)(t.img,{alt:"PI SDK list trust",src:n(9813).A+"",width:"909",height:"300"})})}),"\n",(0,s.jsx)(t.admonition,{title:"Log access",type:"tip",children:(0,s.jsxs)(t.p,{children:["It is possible to access the logs from PI System Management Tools in ",(0,s.jsx)(t.code,{children:"Operation"})," \u2192 ",(0,s.jsx)(t.code,{children:"Messages Logs"})]})})]})}function h(e={}){const{wrapper:t}={...(0,o.R)(),...e.components};return t?(0,s.jsx)(t,{...e,children:(0,s.jsx)(l,{...e})}):l(e)}},4454:(e,t,n)=>{n.d(t,{A:()=>i});const i=n.p+"assets/images/0-installation-e46e308c4fbb7742f2d6582692ded0f6.png"},6089:(e,t,n)=>{n.d(t,{A:()=>i});const i=n.p+"assets/images/1-add-trust-5e7c781541059487c64fb8e73c06f090.png"},9879:(e,t,n)=>{n.d(t,{A:()=>i});const i=n.p+"assets/images/2-trust-list-00b6203bcdae456c6559eb549f4adf28.png"},4691:(e,t,n)=>{n.d(t,{A:()=>i});const i=n.p+"assets/images/3-add-mapping-044cce38265cb93af407f53587ced15f.png"},9813:(e,t,n)=>{n.d(t,{A:()=>i});const i=n.p+"assets/images/4-mapping-list-430eb3b249d24ba972140249b8c7939d.png"},8453:(e,t,n)=>{n.d(t,{R:()=>a,x:()=>r});var i=n(6540);const s={},o=i.createContext(s);function a(e){const t=i.useContext(o);return i.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function r(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:a(e.components),i.createElement(o.Provider,{value:t},e.children)}}}]);