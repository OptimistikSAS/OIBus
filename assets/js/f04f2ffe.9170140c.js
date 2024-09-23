"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[4948],{1999:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>a,contentTitle:()=>c,default:()=>h,frontMatter:()=>s,metadata:()=>i,toc:()=>l});var o=n(4848),r=n(8453);const s={displayed_sidebar:"developerSidebar",sidebar_position:1},c="Create a new OIBus connector",i={id:"developer/create-connector/presentation",title:"Create a new OIBus connector",description:"Connectors, both North and South, are written in TypeScript. It allows you to create your",source:"@site/docs/developer/create-connector/presentation.md",sourceDirName:"developer/create-connector",slug:"/developer/create-connector/presentation",permalink:"/docs/developer/create-connector/presentation",draft:!1,unlisted:!1,tags:[],version:"current",sidebarPosition:1,frontMatter:{displayed_sidebar:"developerSidebar",sidebar_position:1},sidebar:"developerSidebar",previous:{title:"Create a connector",permalink:"/docs/category/create-a-connector"},next:{title:"The manifest",permalink:"/docs/developer/create-connector/manifest"}},a={},l=[];function d(e){const t={a:"a",admonition:"admonition",code:"code",h1:"h1",header:"header",li:"li",p:"p",strong:"strong",ul:"ul",...(0,r.R)(),...e.components};return(0,o.jsxs)(o.Fragment,{children:[(0,o.jsx)(t.header,{children:(0,o.jsx)(t.h1,{id:"create-a-new-oibus-connector",children:"Create a new OIBus connector"})}),"\n",(0,o.jsxs)(t.p,{children:["Connectors, both North and South, are written in ",(0,o.jsx)(t.a,{href:"https://www.typescriptlang.org/",children:"TypeScript"}),". It allows you to create your\nown connector while being sure to match OIBus type structures and method calls."]}),"\n",(0,o.jsxs)(t.p,{children:["The connectors source files are located in the ",(0,o.jsx)(t.code,{children:"backend/src"})," folder, either in ",(0,o.jsx)(t.code,{children:"north"})," or in ",(0,o.jsx)(t.code,{children:"south"}),". Most of them are\ncomposed of three files:"]}),"\n",(0,o.jsxs)(t.ul,{children:["\n",(0,o.jsxs)(t.li,{children:[(0,o.jsx)(t.strong,{children:"A manifest"}),": this file is a JSON where you describe all the fields of your connector and how some basic settings of OIBus\nwill apply or not with the connector"]}),"\n",(0,o.jsxs)(t.li,{children:[(0,o.jsx)(t.strong,{children:"A class file"}),": That's where all your logic goes. Connection methods, retrieval or sending of data..."]}),"\n",(0,o.jsxs)(t.li,{children:[(0,o.jsx)(t.strong,{children:"A test file"}),": Tests are mandatory, specially if you want to be sure that future changes won't break your logic. Be sure\nthat your test coverage is 100%."]}),"\n"]}),"\n",(0,o.jsx)(t.p,{children:"Some may have more files to implement protocol-specific logic in another file and better testing."}),"\n",(0,o.jsx)(t.admonition,{type:"tip",children:(0,o.jsx)(t.p,{children:"Please contact us if you don't know where to start with your development! Maybe what you seek can also be done as an\nimprovement of an existing North or South connector."})})]})}function h(e={}){const{wrapper:t}={...(0,r.R)(),...e.components};return t?(0,o.jsx)(t,{...e,children:(0,o.jsx)(d,{...e})}):d(e)}},8453:(e,t,n)=>{n.d(t,{R:()=>c,x:()=>i});var o=n(6540);const r={},s=o.createContext(r);function c(e){const t=o.useContext(s);return o.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function i(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:c(e.components),o.createElement(s.Provider,{value:t},e.children)}}}]);