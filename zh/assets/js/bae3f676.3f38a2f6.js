"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[9383],{5397:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>a,contentTitle:()=>r,default:()=>h,frontMatter:()=>o,metadata:()=>l,toc:()=>d});var s=t(4848),i=t(8453);const o={sidebar_position:6},r="Health signal",l={id:"guide/engine/health-signal",title:"Health signal",description:"A message can be sent regularly to the logs or to an HTTP endpoint to give information about OIBus status.",source:"@site/versioned_docs/version-v2/guide/engine/health-signal.md",sourceDirName:"guide/engine",slug:"/guide/engine/health-signal",permalink:"/zh/docs/v2/guide/engine/health-signal",draft:!1,unlisted:!1,tags:[],version:"v2",sidebarPosition:6,frontMatter:{sidebar_position:6},sidebar:"guideSidebar",previous:{title:"Proxy",permalink:"/zh/docs/v2/guide/engine/proxy"},next:{title:"External sources",permalink:"/zh/docs/v2/guide/engine/external-sources"}},a={},d=[{value:"Log",id:"log",level:2},{value:"HTTP",id:"http",level:2}];function c(e){const n={a:"a",code:"code",h1:"h1",h2:"h2",li:"li",p:"p",pre:"pre",strong:"strong",ul:"ul",...(0,i.R)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(n.h1,{id:"health-signal",children:"Health signal"}),"\n",(0,s.jsx)(n.p,{children:"A message can be sent regularly to the logs or to an HTTP endpoint to give information about OIBus status."}),"\n",(0,s.jsx)(n.h2,{id:"log",children:"Log"}),"\n",(0,s.jsxs)(n.p,{children:["When enabled, the health signal is sent to the logs with an ",(0,s.jsx)(n.code,{children:"info"})," criticality, at the desired frequency. It will be\nsent to the appropriate channels (console, file, SQLite, loki...) according to the\n",(0,s.jsx)(n.a,{href:"/zh/docs/v2/guide/engine/logging-parameters",children:"logging settings"}),"."]}),"\n",(0,s.jsx)(n.h2,{id:"http",children:"HTTP"}),"\n",(0,s.jsx)(n.p,{children:"It is also possible to send the OIBus health signal to a remote HTTP endpoint as a JSON payload:"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{className:"language-json",children:'{\n      "version": "OIBus version",\n      "architecture": "OS architecture",\n      "executable": "path to the OIBus binary",\n      "processId": "Process ID",\n      "hostname": "OS hostname",\n      "osRelease": "OS release",\n      "osType": "OS type",\n      "id": "OIBusName"\n    }\n'})}),"\n",(0,s.jsx)(n.p,{children:"To do so, activate the HTTP signal and fill in the following fields:"}),"\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Host"}),": the hostname or IP address"]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Endpoint"}),": endpoint that will receive the JSON payload"]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Frequency"}),": time interval between HTTP signals (in s)"]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Proxy"}),": select a proxy to use if needed"]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Verbose"}),": to have more details about the status of OIBus"]}),"\n"]}),"\n",(0,s.jsx)(n.p,{children:"Also fill in the authentication section according to the authentication method used in the target endpoint."})]})}function h(e={}){const{wrapper:n}={...(0,i.R)(),...e.components};return n?(0,s.jsx)(n,{...e,children:(0,s.jsx)(c,{...e})}):c(e)}},8453:(e,n,t)=>{t.d(n,{R:()=>r,x:()=>l});var s=t(6540);const i={},o=s.createContext(i);function r(e){const n=s.useContext(o);return s.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function l(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:r(e.components),s.createElement(o.Provider,{value:n},e.children)}}}]);