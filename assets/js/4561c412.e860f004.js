"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[2033],{8342:(e,s,t)=>{t.d(s,{Ay:()=>c,RM:()=>o});var n=t(4848),i=t(8453);const o=[{value:"North OIAnalytics",id:"north-oianalytics",level:2}];function a(e){const s={a:"a",admonition:"admonition",code:"code",h2:"h2",img:"img",p:"p",...(0,i.R)(),...e.components};return(0,n.jsxs)(n.Fragment,{children:[(0,n.jsx)(s.h2,{id:"north-oianalytics",children:"North OIAnalytics"}),"\n",(0,n.jsxs)(s.p,{children:["Verify that the OIAnalytics platform is accessible from the machine where OIBus is installed. To check this, enter the\nOIAnalytics URL in your web browser's address bar (here ",(0,n.jsx)(s.code,{children:"https://instance.oianalytics.fr"}),").\nIf the page loads correctly, OIAnalytics is reachable. If not, ensure that your network firewall permits the connection."]}),"\n",(0,n.jsx)(s.p,{children:"A connection issue might be due to a port rule (HTTPS / 443, although very unlikely) or a domain name rule. Consult\nyour IT team to add a rule allowing communication."}),"\n",(0,n.jsxs)(s.p,{children:["A best practice for sending values into OIAnalytics is to ",(0,n.jsx)(s.a,{href:"/docs/guide/engine/oianalytics-module",children:"register OIBus first"}),"."]}),"\n",(0,n.jsxs)(s.p,{children:["Create the OIAnalytics North connector and populate the relevant fields. If OIBus has been registered into OIAnalytics,\ncheck the ",(0,n.jsx)(s.code,{children:"Use OIAnalytics Module"})," toggle."]}),"\n",(0,n.jsxs)(s.p,{children:["You can test the settings by clicking the ",(0,n.jsx)(s.code,{children:"Test settings"})," button to verify the connection."]}),"\n",(0,n.jsxs)(s.p,{children:["Confirm accessibility of the OIAnalytics platform from the machine hosting OIBus. To do so, type the OIAnalytics URL\n(",(0,n.jsx)(s.code,{children:"https://instance.oianalytics.fr"}),") into your web browser's address bar. If the page loads successfully, OIAnalytics is\nreachable. If not, ensure that your network firewall allows the connection."]}),"\n",(0,n.jsx)(s.p,{children:"Connection issues may arise from a port rule (HTTPS / 443, though unlikely) or a domain name rule. Consult your IT team\nto add a rule permitting communication."}),"\n",(0,n.jsxs)(s.p,{children:["For optimal functionality, it is recommended to ",(0,n.jsx)(s.a,{href:"/docs/guide/engine/oianalytics-module",children:"register OIBus"})," before sending\nvalues to OIAnalytics."]}),"\n",(0,n.jsxs)(s.p,{children:["If OIBus has been registered with OIAnalytics, activate the ",(0,n.jsx)(s.code,{children:"Use OIAnalytics Module"})," toggle."]}),"\n",(0,n.jsx)("div",{style:{textAlign:"center"},children:(0,n.jsx)("div",{children:(0,n.jsx)(s.p,{children:(0,n.jsx)(s.img,{alt:"OPCUA settings",src:t(8363).A+"",width:"1914",height:"198"})})})}),"\n",(0,n.jsx)(s.admonition,{title:"Testing connection",type:"tip",children:(0,n.jsxs)(s.p,{children:["You can verify the connection by testing the settings using the ",(0,n.jsx)(s.code,{children:"Test settings"})," button."]})})]})}function c(e={}){const{wrapper:s}={...(0,i.R)(),...e.components};return s?(0,n.jsx)(s,{...e,children:(0,n.jsx)(a,{...e})}):a(e)}},8382:(e,s,t)=>{t.r(s),t.d(s,{assets:()=>l,contentTitle:()=>r,default:()=>u,frontMatter:()=>c,metadata:()=>n,toc:()=>d});const n=JSON.parse('{"id":"use-cases/use-case-pi","title":"OSIsoftPI \u2192 OIAnalytics","description":"Beforehand","source":"@site/docs/use-cases/use-case-pi.mdx","sourceDirName":"use-cases","slug":"/use-cases/use-case-pi","permalink":"/docs/use-cases/use-case-pi","draft":false,"unlisted":false,"tags":[],"version":"current","sidebarPosition":6,"frontMatter":{"displayed_sidebar":"useCasesSidebar","sidebar_position":6},"sidebar":"useCasesSidebar","previous":{"title":"IP21 \u2192 AWS S3","permalink":"/docs/use-cases/use-case-ip21"},"next":{"title":"Advanced use case","permalink":"/docs/use-cases/use-case-advanced"}}');var i=t(4848),o=t(8453),a=t(8342);const c={displayed_sidebar:"useCasesSidebar",sidebar_position:6},r="OSIsoftPI \u2192 OIAnalytics",l={},d=[{value:"Beforehand",id:"beforehand",level:2},{value:"South PI",id:"south-pi",level:2},{value:"Items",id:"items",level:3},{value:"Point ID",id:"point-id",level:4},{value:"Query",id:"query",level:4},...a.RM];function h(e){const s={a:"a",admonition:"admonition",code:"code",h1:"h1",h2:"h2",h3:"h3",h4:"h4",header:"header",img:"img",li:"li",p:"p",strong:"strong",ul:"ul",...(0,o.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(s.header,{children:(0,i.jsx)(s.h1,{id:"osisoftpi--oianalytics",children:"OSIsoftPI \u2192 OIAnalytics"})}),"\n",(0,i.jsx)(s.h2,{id:"beforehand",children:"Beforehand"}),"\n",(0,i.jsx)(s.p,{children:"OSIsoft PI is a software suite used for real-time data management and analytics in industrial settings, providing\ntools to collect, store, and analyze time-series data from various sources. It supports operational efficiency, process\noptimization, and decision-making across industries like manufacturing, energy, and utilities."}),"\n",(0,i.jsxs)(s.p,{children:["Details regarding the configurations can be located on the ",(0,i.jsx)(s.a,{href:"../guide/north-connectors/oianalytics",children:"North OIAnalytics"}),"\nand ",(0,i.jsx)(s.a,{href:"../guide/south-connectors/osisoft-pi",children:"South OSIsoft PI"})," connectors pages."]}),"\n",(0,i.jsxs)(s.p,{children:["This use case requires the installation of an ",(0,i.jsx)(s.a,{href:"../guide/oibus-agent/installation",children:"OIBus Agent"})," and is based on the\ndepicted fictional network scenario."]}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)("div",{children:(0,i.jsx)(s.p,{children:(0,i.jsx)(s.img,{alt:"OSIsoft PI -&gt; OIAnalytics use case",src:t(102).A+"",width:"804",height:"617"})})})}),"\n",(0,i.jsxs)(s.p,{children:["You can either install the OIBus Agent on the same machine as OSIsoft PI, or install it on a remote machine where the\nOSIsoft PI SDK is installed. More information can be found on the ",(0,i.jsx)(s.a,{href:"../guide/south-connectors/osisoft-pi#osisoft-pi-sdk-configuration",children:"OSIsoft PI SDK settings"}),"."]}),"\n",(0,i.jsx)(s.h2,{id:"south-pi",children:"South PI"}),"\n",(0,i.jsxs)(s.p,{children:["Enter the ",(0,i.jsx)(s.code,{children:"Remote agent URL"}),". From the example, the value here is ",(0,i.jsx)(s.code,{children:"http://localhost:2224"}),"."]}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)("div",{children:(0,i.jsx)(s.p,{children:(0,i.jsx)(s.img,{alt:"OSIsoft PI settings",src:t(4781).A+"",width:"1914",height:"198"})})})}),"\n",(0,i.jsx)(s.admonition,{title:"Testing connection",type:"tip",children:(0,i.jsxs)(s.p,{children:["You can verify the connection by testing the settings using the ",(0,i.jsx)(s.code,{children:"Test settings"})," button."]})}),"\n",(0,i.jsx)(s.h3,{id:"items",children:"Items"}),"\n",(0,i.jsx)(s.p,{children:"OSIsoft PI items can be of two types:"}),"\n",(0,i.jsxs)(s.ul,{children:["\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.strong,{children:"Point ID"}),": Retrieve time values for a single point."]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.strong,{children:"Query"}),": Retrieve time values for a list of points that match a regex-like query."]}),"\n"]}),"\n",(0,i.jsx)(s.h4,{id:"point-id",children:"Point ID"}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)("div",{children:(0,i.jsx)(s.p,{children:(0,i.jsx)(s.img,{alt:"OSIsoft PI item point ID settings",src:t(9346).A+"",width:"2280",height:"638"})})})}),"\n",(0,i.jsx)(s.h4,{id:"query",children:"Query"}),"\n",(0,i.jsx)(s.p,{children:"When using a query, the item name is used solely for logging purposes. The actual name attached to the data corresponds\nto the references of the points found by the query."}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)("div",{children:(0,i.jsx)(s.p,{children:(0,i.jsx)(s.img,{alt:"OSIsoft PI item query settings",src:t(7660).A+"",width:"2280",height:"674"})})})}),"\n",(0,i.jsx)(a.Ay,{})]})}function u(e={}){const{wrapper:s}={...(0,o.R)(),...e.components};return s?(0,i.jsx)(s,{...e,children:(0,i.jsx)(h,{...e})}):h(e)}},8363:(e,s,t)=>{t.d(s,{A:()=>n});const n=t.p+"assets/images/oia-settings-de6f9e8cc3d0109963bd15b3ce6d034b.png"},9346:(e,s,t)=>{t.d(s,{A:()=>n});const n=t.p+"assets/images/pi-item-point-id-0ba13a25239ac5f08d4c63a7e1eac390.png"},7660:(e,s,t)=>{t.d(s,{A:()=>n});const n=t.p+"assets/images/pi-item-query-466a81c74ae74b2cadb5070dcbe7fc59.png"},102:(e,s,t)=>{t.d(s,{A:()=>n});const n=t.p+"assets/images/pi-oia-ed54291917ee0960d0cc193a18d2a94e.svg"},4781:(e,s,t)=>{t.d(s,{A:()=>n});const n=t.p+"assets/images/pi-settings-bd99f74f38e9051a6393c4acec097477.png"},8453:(e,s,t)=>{t.d(s,{R:()=>a,x:()=>c});var n=t(6540);const i={},o=n.createContext(i);function a(e){const s=n.useContext(o);return n.useMemo((function(){return"function"==typeof e?e(s):{...s,...e}}),[s,e])}function c(e){let s;return s=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:a(e.components),n.createElement(o.Provider,{value:s},e.children)}}}]);