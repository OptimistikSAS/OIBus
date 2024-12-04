"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[3419],{5886:(e,n,i)=>{i.r(n),i.d(n,{assets:()=>c,contentTitle:()=>a,default:()=>u,frontMatter:()=>o,metadata:()=>r,toc:()=>d});var t=i(4848),s=i(8453);const o={sidebar_position:2},a="OIAnalytics Module",r={id:"guide/engine/oianalytics-module",title:"OIAnalytics Module",description:"The OIAnalytics Module is accessible through the OIBus Engine page by clicking on the OIAnalytics button.",source:"@site/i18n/zh/docusaurus-plugin-content-docs/current/guide/engine/oianalytics-module.md",sourceDirName:"guide/engine",slug:"/guide/engine/oianalytics-module",permalink:"/zh/docs/guide/engine/oianalytics-module",draft:!1,unlisted:!1,tags:[],version:"current",sidebarPosition:2,frontMatter:{sidebar_position:2},sidebar:"guideSidebar",previous:{title:"OIBus \u8a2d\u5b9a",permalink:"/zh/docs/guide/engine/engine-settings"},next:{title:"\u626b\u63cf\u6a21\u5f0f",permalink:"/zh/docs/guide/engine/scan-modes"}},c={},d=[{value:"Registration process",id:"registration-process",level:2},{value:"OIAnalytics logs",id:"oianalytics-logs",level:2},{value:"Commands",id:"commands",level:2},{value:"Upgrade command",id:"upgrade-command",level:3}];function l(e){const n={a:"a",h1:"h1",h2:"h2",h3:"h3",li:"li",ol:"ol",p:"p",strong:"strong",...(0,s.R)(),...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:"oianalytics-module",children:"OIAnalytics Module"}),"\n",(0,t.jsxs)(n.p,{children:["The OIAnalytics Module is accessible through the OIBus Engine page by clicking on the ",(0,t.jsx)(n.strong,{children:"OIAnalytics"})," button."]}),"\n",(0,t.jsx)(n.h2,{id:"registration-process",children:"Registration process"}),"\n",(0,t.jsxs)(n.ol,{children:["\n",(0,t.jsxs)(n.li,{children:["Click on ",(0,t.jsx)(n.strong,{children:"Register"}),"."]}),"\n",(0,t.jsx)(n.li,{children:"Provide the requested information."}),"\n",(0,t.jsx)(n.li,{children:"Navigate to your OIAnalytics application, access the configuration page, and locate the OIBus section. Proceed to the\nregistrations page."}),"\n",(0,t.jsxs)(n.li,{children:["Click on the ",(0,t.jsx)(n.strong,{children:"Add"})," button of your OIBus."]}),"\n",(0,t.jsx)(n.li,{children:"In the new modal, input the registration code displayed on OIBus and select access rights with API permissions."}),"\n",(0,t.jsx)(n.li,{children:"Upon verification of the registration code's correctness, OIBus will finalize the registration process."}),"\n"]}),"\n",(0,t.jsx)(n.h2,{id:"oianalytics-logs",children:"OIAnalytics logs"}),"\n",(0,t.jsxs)(n.p,{children:["If configured within the logging parameters section of\nthe ",(0,t.jsx)(n.a,{href:"/zh/docs/guide/engine/engine-settings#%E6%97%A5%E8%AA%8C%E5%8F%83%E6%95%B8",children:"OIBus Engine settings"}),", logs have the capability to be transmitted via\nHTTPS to OIAnalytics, allowing access to them on the OIAnalytics OIBus log page."]}),"\n",(0,t.jsx)(n.h2,{id:"commands",children:"Commands"}),"\n",(0,t.jsx)(n.p,{children:"OIBus periodically checks for commands on OIAnalytics. Upon execution, OIBus promptly sends acknowledgments back to\nOIAnalytics."}),"\n",(0,t.jsx)(n.h3,{id:"upgrade-command",children:"Upgrade command"}),"\n",(0,t.jsx)(n.p,{children:"An OIAnalytics user has the ability to initiate an upgrade command by selecting the desired version for upgrading OIBus\nto a newer release."}),"\n",(0,t.jsx)(n.p,{children:"Initially, OIBus retrieves the upgrade command and then requests OIAnalytics to download the corresponding binary from\nGitHub. Upon download completion, the zip file is unpacked in the designated update folder, inside the installation\ndirectory of OIBus. Subsequently, the data folder is backed up, and OIBus is exited."}),"\n",(0,t.jsx)(n.p,{children:"The launcher actively monitors the process exit and checks the update folder for the presence of a new version. If a\nnew version is found, the launcher proceeds to copy the new binaries into the binary folder and run the OIBus process."}),"\n",(0,t.jsx)(n.p,{children:"In the event of a failure during the upgrade process, the previous version and its associated data folder are restored\nto ensure system stability and continuity."})]})}function u(e={}){const{wrapper:n}={...(0,s.R)(),...e.components};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(l,{...e})}):l(e)}},8453:(e,n,i)=>{i.d(n,{R:()=>a,x:()=>r});var t=i(6540);const s={},o=t.createContext(s);function a(e){const n=t.useContext(o);return t.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function r(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:a(e.components),t.createElement(o.Provider,{value:n},e.children)}}}]);