"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[6227],{4765:(e,s,n)=>{n.r(s),n.d(s,{assets:()=>r,contentTitle:()=>a,default:()=>l,frontMatter:()=>o,metadata:()=>c,toc:()=>d});var t=n(4848),i=n(8453);const o={sidebar_position:1},a="OIBus access",c={id:"guide/engine/access",title:"OIBus access",description:"OIBus port",source:"@site/versioned_docs/version-v2/guide/engine/access.md",sourceDirName:"guide/engine",slug:"/guide/engine/access",permalink:"/docs/v2/guide/engine/access",draft:!1,unlisted:!1,tags:[],version:"v2",sidebarPosition:1,frontMatter:{sidebar_position:1},sidebar:"guideSidebar",previous:{title:"Engine",permalink:"/docs/v2/category/engine"},next:{title:"Logging parameters",permalink:"/docs/v2/guide/engine/logging-parameters"}},r={},d=[{value:"OIBus port",id:"oibus-port",level:2},{value:"Safe mode",id:"safe-mode",level:2},{value:"IP Filters",id:"ip-filters",level:2}];function u(e){const s={a:"a",code:"code",h1:"h1",h2:"h2",p:"p",...(0,i.R)(),...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(s.h1,{id:"oibus-access",children:"OIBus access"}),"\n",(0,t.jsx)(s.h2,{id:"oibus-port",children:"OIBus port"}),"\n",(0,t.jsxs)(s.p,{children:["The default port is 2223 and is used to access the OIBus settings from a web interface at ",(0,t.jsx)(s.code,{children:"http://localhost:2223"}),". This\nport can be changed in case of conflict or for security reasons."]}),"\n",(0,t.jsx)(s.h2,{id:"safe-mode",children:"Safe mode"}),"\n",(0,t.jsx)(s.p,{children:"In case of OIBus error, the safe mode is activated. Running OIBus in safe mode deactivates all connectors: it is mostly\nused to be able to access OIBus settings even if there is some runtime issues with a connector. The safe mode must be\ndeactivated for OIBus to receive and send data."}),"\n",(0,t.jsx)(s.h2,{id:"ip-filters",children:"IP Filters"}),"\n",(0,t.jsx)(s.p,{children:"Only local access is enabled by default. You can see that from the IP Filter section where localhost is defined in IPv4\nand IPv6 format."}),"\n",(0,t.jsxs)(s.p,{children:["You can add a remote address to access OIBus from a remote workstation. However, keep in mind that only http is used to\naccess OIBus since OIBus is rarely attached to a machine with a domain name and certificate installed. So, if you need\nto access OIBus remotely, please do so through a VPN or any secure channels. See the\n",(0,t.jsx)(s.a,{href:"/docs/v2/guide/advanced/oibus-security",children:"security section"})," to learn more about the security in OIBus."]})]})}function l(e={}){const{wrapper:s}={...(0,i.R)(),...e.components};return s?(0,t.jsx)(s,{...e,children:(0,t.jsx)(u,{...e})}):u(e)}},8453:(e,s,n)=>{n.d(s,{R:()=>a,x:()=>c});var t=n(6540);const i={},o=t.createContext(i);function a(e){const s=t.useContext(o);return t.useMemo((function(){return"function"==typeof e?e(s):{...s,...e}}),[s,e])}function c(e){let s;return s=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:a(e.components),t.createElement(o.Provider,{value:s},e.children)}}}]);