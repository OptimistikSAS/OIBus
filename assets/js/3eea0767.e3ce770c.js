"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[7227],{8342:(e,t,s)=>{s.d(t,{Ay:()=>r,RM:()=>o});var n=s(4848),i=s(8453);const o=[{value:"North OIAnalytics",id:"north-oianalytics",level:2}];function c(e){const t={a:"a",admonition:"admonition",code:"code",h2:"h2",img:"img",p:"p",...(0,i.R)(),...e.components};return(0,n.jsxs)(n.Fragment,{children:[(0,n.jsx)(t.h2,{id:"north-oianalytics",children:"North OIAnalytics"}),"\n",(0,n.jsxs)(t.p,{children:["Verify that the OIAnalytics platform is accessible from the machine where OIBus is installed. To check this, enter the\nOIAnalytics URL in your web browser's address bar (here ",(0,n.jsx)(t.code,{children:"https://instance.oianalytics.fr"}),").\nIf the page loads correctly, OIAnalytics is reachable. If not, ensure that your network firewall permits the connection."]}),"\n",(0,n.jsx)(t.p,{children:"A connection issue might be due to a port rule (HTTPS / 443, although very unlikely) or a domain name rule. Consult\nyour IT team to add a rule allowing communication."}),"\n",(0,n.jsxs)(t.p,{children:["A best practice for sending values into OIAnalytics is to ",(0,n.jsx)(t.a,{href:"/docs/guide/engine/oianalytics-module",children:"register OIBus first"}),"."]}),"\n",(0,n.jsxs)(t.p,{children:["Create the OIAnalytics North connector and populate the relevant fields. If OIBus has been registered into OIAnalytics,\ncheck the ",(0,n.jsx)(t.code,{children:"Use OIAnalytics Module"})," toggle."]}),"\n",(0,n.jsxs)(t.p,{children:["You can test the settings by clicking the ",(0,n.jsx)(t.code,{children:"Test settings"})," button to verify the connection."]}),"\n",(0,n.jsxs)(t.p,{children:["Confirm accessibility of the OIAnalytics platform from the machine hosting OIBus. To do so, type the OIAnalytics URL\n(",(0,n.jsx)(t.code,{children:"https://instance.oianalytics.fr"}),") into your web browser's address bar. If the page loads successfully, OIAnalytics is\nreachable. If not, ensure that your network firewall allows the connection."]}),"\n",(0,n.jsx)(t.p,{children:"Connection issues may arise from a port rule (HTTPS / 443, though unlikely) or a domain name rule. Consult your IT team\nto add a rule permitting communication."}),"\n",(0,n.jsxs)(t.p,{children:["For optimal functionality, it is recommended to ",(0,n.jsx)(t.a,{href:"/docs/guide/engine/oianalytics-module",children:"register OIBus"})," before sending\nvalues to OIAnalytics."]}),"\n",(0,n.jsxs)(t.p,{children:["If OIBus has been registered with OIAnalytics, activate the ",(0,n.jsx)(t.code,{children:"Use OIAnalytics Module"})," toggle."]}),"\n",(0,n.jsx)("div",{style:{textAlign:"center"},children:(0,n.jsx)("div",{children:(0,n.jsx)(t.p,{children:(0,n.jsx)(t.img,{alt:"OPCUA settings",src:s(8363).A+"",width:"1914",height:"198"})})})}),"\n",(0,n.jsx)(t.admonition,{title:"Testing connection",type:"tip",children:(0,n.jsxs)(t.p,{children:["You can verify the connection by testing the settings using the ",(0,n.jsx)(t.code,{children:"Test settings"})," button."]})})]})}function r(e={}){const{wrapper:t}={...(0,i.R)(),...e.components};return t?(0,n.jsx)(t,{...e,children:(0,n.jsx)(c,{...e})}):c(e)}},9812:(e,t,s)=>{s.r(t),s.d(t,{assets:()=>d,contentTitle:()=>r,default:()=>u,frontMatter:()=>c,metadata:()=>a,toc:()=>l});var n=s(4848),i=s(8453),o=s(8342);const c={displayed_sidebar:"useCasesSidebar",sidebar_position:1},r="OPCUA \u2192 OIAnalytics",a={id:"use-cases/use-case-opcua",title:"OPCUA \u2192 OIAnalytics",description:"Beforehand",source:"@site/docs/use-cases/use-case-opcua.mdx",sourceDirName:"use-cases",slug:"/use-cases/use-case-opcua",permalink:"/docs/use-cases/use-case-opcua",draft:!1,unlisted:!1,tags:[],version:"current",sidebarPosition:1,frontMatter:{displayed_sidebar:"useCasesSidebar",sidebar_position:1},sidebar:"useCasesSidebar",previous:{title:"Use cases main page",permalink:"/docs/use-cases/"},next:{title:"MSSQL \u2192 Azure Blob",permalink:"/docs/use-cases/use-case-mssql"}},d={},l=[{value:"Beforehand",id:"beforehand",level:2},{value:"South OPCUA",id:"south-opcua",level:2},{value:"Items",id:"items",level:3},...o.RM];function h(e){const t={a:"a",admonition:"admonition",code:"code",h1:"h1",h2:"h2",h3:"h3",img:"img",li:"li",p:"p",pre:"pre",ul:"ul",...(0,i.R)(),...e.components};return(0,n.jsxs)(n.Fragment,{children:[(0,n.jsx)(t.h1,{id:"opcua--oianalytics",children:"OPCUA \u2192 OIAnalytics"}),"\n",(0,n.jsx)(t.h2,{id:"beforehand",children:"Beforehand"}),"\n",(0,n.jsxs)(t.p,{children:["Details regarding the configurations can be located on the ",(0,n.jsx)(t.a,{href:"/docs/guide/north-connectors/oianalytics",children:"North OIAnalytics"}),"\nand ",(0,n.jsx)(t.a,{href:"/docs/guide/south-connectors/opcua",children:"South OPCUA"})," connectors pages."]}),"\n",(0,n.jsxs)(t.p,{children:["Additionally, ensure that the selected protocol for connection is OPCUA, distinguishing it from\n",(0,n.jsx)(t.a,{href:"/docs/guide/south-connectors/opc-hda",children:"OPCDA or OPCHDA"}),", which represent entirely distinct technologies."]}),"\n",(0,n.jsx)(t.p,{children:"This specific scenario is constructed around the depicted fictional network."}),"\n",(0,n.jsx)("div",{style:{textAlign:"center"},children:(0,n.jsx)("div",{children:(0,n.jsx)(t.p,{children:(0,n.jsx)(t.img,{alt:"OPCUA -&gt; OIAnalytics use case",src:s(9399).A+"",width:"805",height:"617"})})})}),"\n",(0,n.jsx)(t.h2,{id:"south-opcua",children:"South OPCUA"}),"\n",(0,n.jsx)(t.p,{children:"The complete URL format for the OPCUA server should adhere to the following structure:"}),"\n",(0,n.jsx)(t.pre,{children:(0,n.jsx)(t.code,{children:"opc.tcp://<host>:<port>/<name>\n"})}),"\n",(0,n.jsx)(t.p,{children:"Here's a breakdown:"}),"\n",(0,n.jsxs)(t.ul,{children:["\n",(0,n.jsxs)(t.li,{children:[(0,n.jsx)(t.code,{children:"host"})," represents either the host name or IP address of the server (e.g., ",(0,n.jsx)(t.code,{children:"10.0.0.1"}),")."]}),"\n",(0,n.jsxs)(t.li,{children:[(0,n.jsx)(t.code,{children:"port"})," specifies the port through which the server accepts connections (e.g., ",(0,n.jsx)(t.code,{children:"53530"}),")."]}),"\n",(0,n.jsxs)(t.li,{children:[(0,n.jsx)(t.code,{children:"name"})," indicates the name assigned to the OPCUA server (e.g., ",(0,n.jsx)(t.code,{children:"OPCUA/SimulationServer"}),").\nFor instance, in this example, the OPCUA server URL is ",(0,n.jsx)(t.code,{children:"opc.tcp://10.0.0.1:53530/OPCUA/SimulationServer"}),"."]}),"\n"]}),"\n",(0,n.jsxs)(t.p,{children:["Specify the security mode supported by your server. If it differs from None, provide details about the security policy\nas well. Using ",(0,n.jsx)(t.code,{children:"None"})," for authentication with OIBus is discouraged, except for testing purposes."]}),"\n",(0,n.jsx)(t.p,{children:"Ensure you have the necessary credentials or certificates for authentication, which can be obtained from your IT team\nor the individual overseeing the OPCUA server."}),"\n",(0,n.jsx)("div",{style:{textAlign:"center"},children:(0,n.jsx)("div",{children:(0,n.jsx)(t.p,{children:(0,n.jsx)(t.img,{alt:"OPCUA settings",src:s(7678).A+"",width:"1908",height:"528"})})})}),"\n",(0,n.jsx)(t.admonition,{title:"Testing connection",type:"tip",children:(0,n.jsxs)(t.p,{children:["You can verify the connection by testing the settings using the ",(0,n.jsx)(t.code,{children:"Test settings"})," button."]})}),"\n",(0,n.jsx)(t.h3,{id:"items",children:"Items"}),"\n",(0,n.jsx)(t.p,{children:"Add the node ID you wish to read. Consult the person in charge of the OPCUA server to determine the available data points."}),"\n",(0,n.jsxs)(t.p,{children:["You have the option to choose the access ",(0,n.jsx)(t.code,{children:"mode"})," (DA or HA). In HA mode, you can aggregate and resample the data. Ensure\nthat the server supports the selected aggregate and resampling options. If in doubt, stick with the ",(0,n.jsx)(t.code,{children:"Raw"})," aggregate."]}),"\n",(0,n.jsxs)(t.p,{children:["Opt for a ",(0,n.jsx)(t.a,{href:"/docs/guide/engine/scan-modes",children:"scan mode"})," to fetch the data. In HA mode, a list of values is retrieved for\nan item since the last value was obtained, while in DA mode, only one value is retrieved at the requested time for one item."]}),"\n",(0,n.jsx)("div",{style:{textAlign:"center"},children:(0,n.jsx)("div",{children:(0,n.jsx)(t.p,{children:(0,n.jsx)(t.img,{alt:"OPCUA settings",src:s(8904).A+"",width:"2280",height:"698"})})})}),"\n",(0,n.jsx)(t.admonition,{title:"Massive import",type:"tip",children:(0,n.jsxs)(t.p,{children:["For bulk item import, start by clicking the ",(0,n.jsx)(t.code,{children:"Export"})," button to obtain a CSV file with the correct columns. Each line in\nthe file will correspond to a new item. Ensure that the names are unique."]})}),"\n",(0,n.jsx)(o.Ay,{})]})}function u(e={}){const{wrapper:t}={...(0,i.R)(),...e.components};return t?(0,n.jsx)(t,{...e,children:(0,n.jsx)(h,{...e})}):h(e)}},8363:(e,t,s)=>{s.d(t,{A:()=>n});const n=s.p+"assets/images/oia-settings-de6f9e8cc3d0109963bd15b3ce6d034b.png"},8904:(e,t,s)=>{s.d(t,{A:()=>n});const n=s.p+"assets/images/opcua-item-8e9b0d88fbc8ef1a101264da317a6875.png"},9399:(e,t,s)=>{s.d(t,{A:()=>n});const n=s.p+"assets/images/opcua-oia-9bd75deece98fdd3635587c2257111f3.svg"},7678:(e,t,s)=>{s.d(t,{A:()=>n});const n=s.p+"assets/images/opcua-settings-64d63d434f52c08bb7a2759b0dfdfd53.png"},8453:(e,t,s)=>{s.d(t,{R:()=>c,x:()=>r});var n=s(6540);const i={},o=n.createContext(i);function c(e){const t=n.useContext(o);return n.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function r(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:c(e.components),n.createElement(o.Provider,{value:t},e.children)}}}]);