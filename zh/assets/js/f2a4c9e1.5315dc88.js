"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[1594],{7721:(e,n,s)=>{s.r(n),s.d(n,{assets:()=>c,contentTitle:()=>a,default:()=>h,frontMatter:()=>o,metadata:()=>t,toc:()=>d});const t=JSON.parse('{"id":"guide/south-connectors/opcua","title":"OPCUA","description":"OPCUA technology is a protocol for accessing data in read or write mode. The data are organized in a tree-like address","source":"@site/versioned_docs/version-v2/guide/south-connectors/opcua.md","sourceDirName":"guide/south-connectors","slug":"/guide/south-connectors/opcua","permalink":"/zh/docs/v2/guide/south-connectors/opcua","draft":false,"unlisted":false,"tags":[],"version":"v2","sidebarPosition":4,"frontMatter":{"sidebar_position":4},"sidebar":"guideSidebar","previous":{"title":"Folder Scanner","permalink":"/zh/docs/v2/guide/south-connectors/folder-scanner"},"next":{"title":"OPCHDA (Windows only)","permalink":"/zh/docs/v2/guide/south-connectors/opchda"}}');var i=s(4848),r=s(8453);const o={sidebar_position:4},a="OPCUA",c={},d=[{value:"Connection settings",id:"connection-settings",level:2},{value:"Network",id:"network",level:3},{value:"Security settings",id:"security-settings",level:2},{value:"Communication",id:"communication",level:3},{value:"Authentication",id:"authentication",level:3},{value:"Accessing data",id:"accessing-data",level:2},{value:"Scan groups (HA only)",id:"scan-groups-ha-only",level:3},{value:"Points and nodes",id:"points-and-nodes",level:3}];function l(e){const n={a:"a",admonition:"admonition",code:"code",em:"em",h1:"h1",h2:"h2",h3:"h3",header:"header",img:"img",li:"li",p:"p",strong:"strong",ul:"ul",...(0,r.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(n.header,{children:(0,i.jsx)(n.h1,{id:"opcua",children:"OPCUA"})}),"\n",(0,i.jsxs)(n.p,{children:["OPCUA technology is a protocol for accessing data in read or write mode. The data are organized in a tree-like address\nspace and are referenced with a unique address each (called node ID). OPCUA is a modern standard based on TPC, replacing\nOPC HDA/DA (see ",(0,i.jsx)(n.a,{href:"/zh/docs/v2/guide/south-connectors/opchda",children:"OPCHDA connector"}),") technologies, and is often embedded natively in industrial controllers."]}),"\n",(0,i.jsx)(n.p,{children:"OPCUA embeds two variants of the protocol: HA (Historical Access) and DA (Data Access). The first mode allows access to\na history of values over a time interval for the requested points (data), while the second mode accesses the values at\neach request."}),"\n",(0,i.jsxs)(n.p,{children:["OIBus integrates the two OPCUA modes (HA and DA) in read-only mode. Each mode has its own connector.\nThe ",(0,i.jsx)(n.a,{href:"https://github.com/node-opcua/node-opcua",children:"node-opcua"})," library is used."]}),"\n",(0,i.jsx)(n.h2,{id:"connection-settings",children:"Connection settings"}),"\n",(0,i.jsx)(n.p,{children:"To connect to a OPCUA server, OIBus needs an URL which is composed of several part:"}),"\n",(0,i.jsxs)(n.ul,{children:["\n",(0,i.jsxs)(n.li,{children:["The protocol: ",(0,i.jsx)(n.code,{children:"opc.tcp://"})," (for now, only this one is supported)"]}),"\n",(0,i.jsx)(n.li,{children:"The host or IP address"}),"\n",(0,i.jsx)(n.li,{children:"The port number"}),"\n",(0,i.jsx)(n.li,{children:"The endpoint (or server name)"}),"\n"]}),"\n",(0,i.jsxs)(n.p,{children:["All together, these elements form a URL. Here is an example: ",(0,i.jsx)(n.code,{children:"opc.tcp://localhost:53530/OPCUA/MyServer"})]}),"\n",(0,i.jsx)(n.h3,{id:"network",children:"Network"}),"\n",(0,i.jsx)(n.p,{children:"Several options are available to better manage network failure or inactivity:"}),"\n",(0,i.jsxs)(n.ul,{children:["\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Retry interval"}),": in case of connection failure, time to wait before reconnecting (in ms)"]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Read timeout"})," (HA only): time to wait before aborting a read request (in ms). It may happen if the read request\nretrieves too many values at once or if the network has a problem."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Max read interval"})," (HA only): split the request interval into smaller chunks (in s)"]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Read interval delay"})," (HA only): time to wait (in ms) between two sub-interval in case a split occurs (ignored\notherwise)"]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Max return values"})," (HA only): max number of values to retrieve ",(0,i.jsx)(n.strong,{children:"per node"}),". If 100 nodes are requested, this value\nis multiplied by 100 to have the total number of values retrieved."]}),"\n"]}),"\n",(0,i.jsx)(n.h2,{id:"security-settings",children:"Security settings"}),"\n",(0,i.jsx)(n.h3,{id:"communication",children:"Communication"}),"\n",(0,i.jsxs)(n.p,{children:["The communications can be secured thanks to the ",(0,i.jsx)(n.strong,{children:"security mode"})," and ",(0,i.jsx)(n.strong,{children:"security policy"})," fields. Available modes are:"]}),"\n",(0,i.jsxs)(n.ul,{children:["\n",(0,i.jsx)(n.li,{children:"None"}),"\n",(0,i.jsx)(n.li,{children:"Sign"}),"\n",(0,i.jsx)(n.li,{children:"SignAndEncrypt"}),"\n"]}),"\n",(0,i.jsx)(n.p,{children:"OIBus supports the following policies:"}),"\n",(0,i.jsxs)(n.ul,{children:["\n",(0,i.jsx)(n.li,{children:"None"}),"\n",(0,i.jsx)(n.li,{children:"Basic128"}),"\n",(0,i.jsx)(n.li,{children:"Basic192"}),"\n",(0,i.jsx)(n.li,{children:"Basic256"}),"\n",(0,i.jsx)(n.li,{children:"Basic128Rsa15"}),"\n",(0,i.jsx)(n.li,{children:"Basic192Rsa15"}),"\n",(0,i.jsx)(n.li,{children:"Basic256Rsa15"}),"\n",(0,i.jsx)(n.li,{children:"Basic256Sha256"}),"\n",(0,i.jsx)(n.li,{children:"Aes128_Sha256_RsaOaep"}),"\n",(0,i.jsx)(n.li,{children:"PubSub_Aes128_CTR"}),"\n",(0,i.jsx)(n.li,{children:"PubSub_Aes256_CTR"}),"\n"]}),"\n",(0,i.jsx)(n.admonition,{title:"Compatibility with the OPCUA server",type:"info",children:(0,i.jsx)(n.p,{children:"Be careful to select a security mode and a security policy supported by the OPCUA server!"})}),"\n",(0,i.jsxs)(n.p,{children:["If a security mode other than ",(0,i.jsx)(n.em,{children:"None"})," is used, a certificate will be needed to sign and possible encrypt the\ncommunications. A self-signed certificate called ",(0,i.jsx)(n.strong,{children:"OIBus"})," (generated by OIBus at startup) is used to secure the\ncommunication with the OPCUA server. It must be trusted by the OPCUA server to allow communication."]}),"\n",(0,i.jsxs)(n.admonition,{title:"Example on Prosys OPCUA Simulation Server",type:"info",children:[(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Prosys OPCUA Simulation Server Certificates",src:s(1414).A+"",width:"995",height:"627"})}),(0,i.jsxs)(n.p,{children:["If the certificate is not trusted, an error will occur: ",(0,i.jsx)(n.code,{children:"Error: The connection may have been rejected by server"})]})]}),"\n",(0,i.jsx)(n.h3,{id:"authentication",children:"Authentication"}),"\n",(0,i.jsx)(n.p,{children:"If the certificate and key paths are empty, OIBus will try to use a user authentication with username and password. The\nusername and password must exist on the OPCUA server."}),"\n",(0,i.jsx)(n.p,{children:"If the username and password are empty, an anonymous authentication will be used. In this case, Anonymous authentication\nmust be accepted by the OPCUA server."}),"\n",(0,i.jsxs)(n.p,{children:["The certificate, used to authenticate the client, must be added in the trusted user certificates of the OPCUA server. It\nis managed differently than the ",(0,i.jsx)(n.strong,{children:"OIBus"})," certificate mentioned before, used for ",(0,i.jsx)(n.a,{href:"#communication",children:"secure communication"}),"."]}),"\n",(0,i.jsxs)(n.admonition,{title:"Example on Prosys OPCUA Simulation Server",type:"info",children:[(0,i.jsxs)(n.p,{children:["For Prosys, the certificate used to authenticate OIBus must be placed in the ",(0,i.jsx)(n.code,{children:".prosysopc\\prosys-opc-ua-simulation-server\\USERS_PKI\\CA\\certs"}),"\nfolder. Otherwise, an error will occur: ",(0,i.jsx)(n.code,{children:"Error:  serviceResult = BadIdentityTokenRejected (0x80210000)"}),"."]}),(0,i.jsxs)(n.p,{children:["If a connection has already been tried and rejected, the certificate must be removed from the rejected certificates'\nfolder ",(0,i.jsx)(n.code,{children:".prosysopc\\prosys-opc-ua-simulation-server\\USERS_PKI\\CA\\rejected"})," and be placed in the trusted folder\n(",(0,i.jsx)(n.code,{children:".prosysopc\\prosys-opc-ua-simulation-server\\USERS_PKI\\CA\\certs"}),")."]})]}),"\n",(0,i.jsxs)(n.admonition,{title:"Use the same certificate for user authentication and secure communications",type:"tip",children:[(0,i.jsx)(n.p,{children:"The same certificate can be used. To do that, the cert.pem and privateKey.pem file paths must be specified. They are\nlocated in the cache/certs folder of OIBus."}),(0,i.jsxs)(n.p,{children:["On the OPCUA server side, the ",(0,i.jsx)(n.strong,{children:"OIBus"})," certificate (cert.pem) must be copied in the user certificates' folder."]}),(0,i.jsxs)(n.p,{children:["For example, with Prosys OPCUA Simulation Server: ",(0,i.jsx)(n.code,{children:".prosysopc\\prosys-opc-ua-simulation-server\\USERS_PKI\\CA\\certs"}),"."]})]}),"\n",(0,i.jsx)(n.h2,{id:"accessing-data",children:"Accessing data"}),"\n",(0,i.jsx)(n.h3,{id:"scan-groups-ha-only",children:"Scan groups (HA only)"}),"\n",(0,i.jsxs)(n.p,{children:["With HA mode, data are retrieved by intervals. It is then possible to aggregate these values or to resample them. To do\nso, a scan mode must be selected (to create additional scan modes, see ",(0,i.jsx)(n.a,{href:"/zh/docs/v2/guide/engine/scan-modes",children:"Engine settings"}),"), with\nits associated aggregate and resampling options."]}),"\n",(0,i.jsx)(n.admonition,{title:"Creating scan groups",type:"info",children:(0,i.jsxs)(n.p,{children:["Creating scan groups is mandatory to choose them in the ",(0,i.jsx)(n.em,{children:"Points"})," section when adding new points to request."]})}),"\n",(0,i.jsx)(n.admonition,{title:"Compatibility with the OPCUA server",type:"danger",children:(0,i.jsxs)(n.p,{children:["Not every aggregate and resampling are supported by OPCUA server. ",(0,i.jsx)(n.em,{children:"Raw"})," aggregate and ",(0,i.jsx)(n.em,{children:"None"})," resampling are preferred to\navoid compatibility issues."]})}),"\n",(0,i.jsx)(n.h3,{id:"points-and-nodes",children:"Points and nodes"}),"\n",(0,i.jsxs)(n.p,{children:["The OPCUA connector retrieves values from specific addresses. Addresses (called node ID, or just node) are organized in\nnamespaces, in a tree-like structure. These can be added in the ",(0,i.jsx)(n.em,{children:"Points section"})," (in the upper right corner)."]}),"\n",(0,i.jsx)(n.p,{children:"To request a data, specify the following fields:"}),"\n",(0,i.jsxs)(n.ul,{children:["\n",(0,i.jsx)(n.li,{children:"Point ID"}),"\n",(0,i.jsx)(n.li,{children:"Node ID"}),"\n",(0,i.jsx)(n.li,{children:"Scan Mode (DA only)"}),"\n",(0,i.jsx)(n.li,{children:"Scan Group (HA only)"}),"\n"]}),"\n",(0,i.jsx)(n.p,{children:"The Node ID matches the path of the data in the appropriate namespace in the OPCUA server. The point ID will be used\nwhen sent to North connectors. It can be the same as the Node ID, but it allows friendlier names to manage."})]})}function h(e={}){const{wrapper:n}={...(0,r.R)(),...e.components};return n?(0,i.jsx)(n,{...e,children:(0,i.jsx)(l,{...e})}):l(e)}},1414:(e,n,s)=>{s.d(n,{A:()=>t});const t=s.p+"assets/images/prosys-opcua-simulation-server-certificates-3aa9f72ae5a03d39b377b01e927c54ba.png"},8453:(e,n,s)=>{s.d(n,{R:()=>o,x:()=>a});var t=s(6540);const i={},r=t.createContext(i);function o(e){const n=t.useContext(r);return t.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function a(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:o(e.components),t.createElement(r.Provider,{value:n},e.children)}}}]);