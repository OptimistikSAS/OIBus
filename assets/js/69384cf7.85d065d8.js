"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[9363],{9233:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>c,contentTitle:()=>r,default:()=>l,frontMatter:()=>i,metadata:()=>a,toc:()=>h});var o=n(4848),s=n(8453);const i={displayed_sidebar:"useCasesSidebar",sidebar_position:1},r="OPCUA with OIAnalytics",a={id:"use-cases/use-case-opcua",title:"OPCUA with OIAnalytics",description:"Beforehand",source:"@site/docs/use-cases/use-case-opcua.md",sourceDirName:"use-cases",slug:"/use-cases/use-case-opcua",permalink:"/docs/use-cases/use-case-opcua",draft:!1,unlisted:!1,tags:[],version:"current",sidebarPosition:1,frontMatter:{displayed_sidebar:"useCasesSidebar",sidebar_position:1},sidebar:"useCasesSidebar",previous:{title:"Use cases main page",permalink:"/docs/use-cases/"},next:{title:"MSSQL with Azure Blob",permalink:"/docs/use-cases/use-case-mssql"}},c={},h=[{value:"Beforehand",id:"beforehand",level:2},{value:"South OPCUA",id:"south-opcua",level:2},{value:"What you need to know",id:"what-you-need-to-know",level:3},{value:"Preparation",id:"preparation",level:3},{value:"South connector",id:"south-connector",level:3},{value:"Items",id:"items",level:3},{value:"North OIAnalytics",id:"north-oianalytics",level:2},{value:"What you need to know",id:"what-you-need-to-know-1",level:3},{value:"Preparation",id:"preparation-1",level:3},{value:"North connector",id:"north-connector",level:3}];function d(e){const t={a:"a",admonition:"admonition",code:"code",h1:"h1",h2:"h2",h3:"h3",li:"li",p:"p",ul:"ul",...(0,s.R)(),...e.components};return(0,o.jsxs)(o.Fragment,{children:[(0,o.jsx)(t.h1,{id:"opcua-with-oianalytics",children:"OPCUA with OIAnalytics"}),"\n",(0,o.jsx)(t.h2,{id:"beforehand",children:"Beforehand"}),"\n",(0,o.jsxs)(t.p,{children:["Details regarding the configurations can be located on the ",(0,o.jsx)(t.a,{href:"/docs/guide/north-connectors/oianalytics",children:"North OIAnalytics"}),"\nand ",(0,o.jsx)(t.a,{href:"/docs/guide/south-connectors/opcua",children:"South OPCUA"})," connectors pages."]}),"\n",(0,o.jsxs)(t.p,{children:["Additionally, ensure that the selected protocol for connection is OPCUA, distinguishing it from\n",(0,o.jsx)(t.a,{href:"/docs/guide/south-connectors/opc-hda",children:"OPCDA or OPCHDA"}),", which represent entirely distinct technologies."]}),"\n",(0,o.jsx)(t.h2,{id:"south-opcua",children:"South OPCUA"}),"\n",(0,o.jsx)(t.h3,{id:"what-you-need-to-know",children:"What you need to know"}),"\n",(0,o.jsxs)(t.p,{children:["The complete URL of the OPCUA server, including the name, should be in the format ",(0,o.jsx)(t.code,{children:"opc.tcp://<host>:<port>/<name>"}),", where:"]}),"\n",(0,o.jsxs)(t.ul,{children:["\n",(0,o.jsxs)(t.li,{children:[(0,o.jsx)(t.code,{children:"host"})," represents the host name or IP address of the server."]}),"\n",(0,o.jsxs)(t.li,{children:[(0,o.jsx)(t.code,{children:"port"})," indicates the port used by the server to accept connections."]}),"\n",(0,o.jsxs)(t.li,{children:[(0,o.jsx)(t.code,{children:"name"})," denotes the name of the OPCUA server."]}),"\n"]}),"\n",(0,o.jsxs)(t.p,{children:["Specify the security mode your server accepts. If it differs from ",(0,o.jsx)(t.code,{children:"None"}),", specify the security policy as well.\nRegarding authentication for OIBus on the server, it is not recommended to use ",(0,o.jsx)(t.code,{children:"None"})," except for testing purposes."]}),"\n",(0,o.jsx)(t.p,{children:"Provide the necessary username/password or certificates for authentication."}),"\n",(0,o.jsx)(t.p,{children:"These details can be obtained from your IT team or the person responsible for the OPCUA server."}),"\n",(0,o.jsx)(t.h3,{id:"preparation",children:"Preparation"}),"\n",(0,o.jsx)(t.p,{children:"Prior to establishing the South connector, ensure that the OPCUA server is accessible (via IP address/hostname and port)\nfrom the machine where you have OIBus installed."}),"\n",(0,o.jsx)(t.h3,{id:"south-connector",children:"South connector"}),"\n",(0,o.jsxs)(t.p,{children:["Enter the required data into the settings. Before saving, use the ",(0,o.jsx)(t.code,{children:"Test settings"})," button to verify the connection."]}),"\n",(0,o.jsx)(t.h3,{id:"items",children:"Items"}),"\n",(0,o.jsx)(t.p,{children:"Add the node ID you wish to read. Consult the person in charge of the OPCUA server to determine the available data points."}),"\n",(0,o.jsxs)(t.p,{children:["You have the option to choose the access ",(0,o.jsx)(t.code,{children:"mode"})," (DA or HA). In HA mode, you can aggregate and resample the data. Ensure\nthat the server supports the selected aggregate and resampling options. If in doubt, stick with the ",(0,o.jsx)(t.code,{children:"Raw"})," aggregate."]}),"\n",(0,o.jsxs)(t.p,{children:["Opt for a ",(0,o.jsx)(t.a,{href:"/docs/guide/engine/scan-modes",children:"scan mode"})," to fetch the data. In HA mode, a list of values is retrieved for\nan item since the last value was obtained, while in DA mode, only one value is retrieved at the requested time for one item."]}),"\n",(0,o.jsx)(t.admonition,{title:"Massive import",type:"tip",children:(0,o.jsxs)(t.p,{children:["For bulk item import, start by clicking the ",(0,o.jsx)(t.code,{children:"Export"})," button to obtain a CSV file with the correct columns. Each line in\nthe file will correspond to a new item. Ensure that the names are unique."]})}),"\n",(0,o.jsx)(t.h2,{id:"north-oianalytics",children:"North OIAnalytics"}),"\n",(0,o.jsx)(t.h3,{id:"what-you-need-to-know-1",children:"What you need to know"}),"\n",(0,o.jsx)(t.h3,{id:"preparation-1",children:"Preparation"}),"\n",(0,o.jsx)(t.p,{children:"Verify that the OIAnalytics platform is accessible from the machine where OIBus is installed. To check this, enter the\nOIAnalytics URL in your web browser's address bar. If the page loads correctly, OIAnalytics is reachable. If not, ensure\nthat your network firewall permits the connection."}),"\n",(0,o.jsx)(t.p,{children:"The connection issue might be due to a port rule (HTTPS / 443, although very unlikely) or a domain name rule. Consult\nyour IT team to add a rule allowing communication."}),"\n",(0,o.jsx)(t.p,{children:"Within the OIAnalytics platform, navigate to the configuration settings.\nIn the user management section, create a profile with the following access rights:"}),"\n",(0,o.jsxs)(t.ul,{children:["\n",(0,o.jsx)(t.li,{children:(0,o.jsx)(t.code,{children:"Value: Query | Update"})}),"\n",(0,o.jsx)(t.li,{children:(0,o.jsx)(t.code,{children:"File upload: Update resource"})}),"\n"]}),"\n",(0,o.jsx)(t.p,{children:"Then create a user with such a profile and generate an access key for him.\nTake care to securely store both the key and the secret : they will be required to set up the North OIAnalytics connector."}),"\n",(0,o.jsx)(t.h3,{id:"north-connector",children:"North connector"}),"\n",(0,o.jsxs)(t.p,{children:["Create the OIAnalytics North connector and populate the relevant fields.\nPrior to saving, use the ",(0,o.jsx)(t.code,{children:"Test settings"})," button to check the connection."]})]})}function l(e={}){const{wrapper:t}={...(0,s.R)(),...e.components};return t?(0,o.jsx)(t,{...e,children:(0,o.jsx)(d,{...e})}):d(e)}},8453:(e,t,n)=>{n.d(t,{R:()=>r,x:()=>a});var o=n(6540);const s={},i=o.createContext(s);function r(e){const t=o.useContext(i);return o.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function a(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:r(e.components),o.createElement(i.Provider,{value:t},e.children)}}}]);