"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[2019],{4541:(e,n,s)=>{s.r(n),s.d(n,{assets:()=>c,contentTitle:()=>o,default:()=>h,frontMatter:()=>a,metadata:()=>t,toc:()=>l});const t=JSON.parse('{"id":"guide/advanced/oianalytics-registration","title":"OIAnalytics registration","description":"The OIAnalytics Registration is accessible through the OIBus Engine page by clicking on the OIAnalytics button.","source":"@site/docs/guide/advanced/oianalytics-registration.mdx","sourceDirName":"guide/advanced","slug":"/guide/advanced/oianalytics-registration","permalink":"/docs/guide/advanced/oianalytics-registration","draft":false,"unlisted":false,"tags":[],"version":"current","sidebarPosition":1,"frontMatter":{"sidebar_position":1},"sidebar":"guideSidebar","previous":{"title":"Advanced","permalink":"/docs/category/advanced"},"next":{"title":"OIBus security","permalink":"/docs/guide/advanced/oibus-security"}}');var i=s(4848),r=s(8453);const a={sidebar_position:1},o="OIAnalytics registration",c={},l=[{value:"Registration process",id:"registration-process",level:2},{value:"Registration settings",id:"registration-settings",level:2},{value:"Network",id:"network",level:3},{value:"Timing",id:"timing",level:3},{value:"Commands permission",id:"commands-permission",level:3},{value:"OIAnalytics logs",id:"oianalytics-logs",level:2},{value:"Commands",id:"commands",level:2},{value:"Upgrade version",id:"upgrade-version",level:3},{value:"Restart",id:"restart",level:3},{value:"Update engine settings",id:"update-engine-settings",level:3},{value:"Regenerate cipher keys",id:"regenerate-cipher-keys",level:3},{value:"Update registration settings",id:"update-registration-settings",level:3},{value:"Scan mode",id:"scan-mode",level:3},{value:"North connector",id:"north-connector",level:3},{value:"South connector",id:"south-connector",level:3},{value:"Messages",id:"messages",level:2},{value:"Security concerns",id:"security-concerns",level:2},{value:"Network consideration",id:"network-consideration",level:3},{value:"Secrets management",id:"secrets-management",level:3}];function d(e){const n={a:"a",admonition:"admonition",h1:"h1",h2:"h2",h3:"h3",header:"header",img:"img",li:"li",ol:"ol",p:"p",strong:"strong",ul:"ul",...(0,r.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(n.header,{children:(0,i.jsx)(n.h1,{id:"oianalytics-registration",children:"OIAnalytics registration"})}),"\n",(0,i.jsxs)(n.p,{children:["The OIAnalytics Registration is accessible through the OIBus Engine page by clicking on the ",(0,i.jsx)(n.strong,{children:"OIAnalytics"})," button."]}),"\n",(0,i.jsx)(n.h2,{id:"registration-process",children:"Registration process"}),"\n",(0,i.jsxs)(n.ol,{children:["\n",(0,i.jsxs)(n.li,{children:["Click on ",(0,i.jsx)(n.strong,{children:"Register"})," and complete the settings."]}),"\n",(0,i.jsx)(n.li,{children:"Validate the registration. It will start the registration on OIAnalytics."}),"\n",(0,i.jsxs)(n.li,{children:["Navigate to your OIAnalytics application, access the configuration page, and locate the OIBus section. Proceed to the\nregistrations page, complete the registration by copying the 6 characters code and give the appropriate permissions.\n",(0,i.jsx)(n.strong,{children:"OIBus needs API access"}),"."]}),"\n",(0,i.jsx)(n.li,{children:"OIBus regularly checks if the registration is completed on OIAnalytics."}),"\n",(0,i.jsxs)(n.li,{children:["On completion, OIBus sends the full configuration to OIAnalytics and activate the logs (if enabled in\nthe ",(0,i.jsx)(n.a,{href:"/docs/guide/engine/engine-settings#logging-parameters",children:"engine settings"}),")."]}),"\n",(0,i.jsxs)(n.li,{children:["OIBus regularly retrieves ",(0,i.jsx)(n.a,{href:"#commands",children:"commands from OIAnalytics"}),"."]}),"\n"]}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"OIAnalytics registration process",src:s(1629).A+"",width:"804",height:"617"})})}),"\n",(0,i.jsx)(n.h2,{id:"registration-settings",children:"Registration settings"}),"\n",(0,i.jsx)(n.h3,{id:"network",children:"Network"}),"\n",(0,i.jsxs)(n.ul,{children:["\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Host"}),": The address of the OIAnalytics instance"]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Accept unauthorized"}),": Discard HTTPS certificate verification. Useful when behind a proxy that alters the HTTPS\nheaders."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Use proxy"}),": Choose whether to route the request through a proxy."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Proxy URL"}),": The URL of the proxy server to pass through."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Proxy username"}),": The username associated with the proxy."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Proxy password"}),": The password linked to the proxy."]}),"\n"]}),"\n",(0,i.jsx)(n.h3,{id:"timing",children:"Timing"}),"\n",(0,i.jsxs)(n.ul,{children:["\n",(0,i.jsxs)(n.li,{children:["Command retrieval interval (from OIAnalytics): Specifies the time OIBus waits between two HTTPS requests to fetch the\n",(0,i.jsx)(n.a,{href:"#commands",children:"commands"})," to execute."]}),"\n",(0,i.jsx)(n.li,{children:"Command retry interval (from OIAnalytics): In case of a network failure, defines the time OIBus waits before\nattempting to retry the request."}),"\n",(0,i.jsx)(n.li,{children:"Message retry interval (to OIAnalytics): OIBus sends messages to OIAnalytics when specific events occur (e.g.,\nconfiguration changes). If a network failure happens, this interval determines how long OIBus waits before retrying\nthe message delivery."}),"\n"]}),"\n",(0,i.jsx)(n.h3,{id:"commands-permission",children:"Commands permission"}),"\n",(0,i.jsxs)(n.p,{children:["OIBus retrieves all commands created in OIAnalytics but executes only those that are permitted. You can view the full\nlist of available commands ",(0,i.jsx)(n.a,{href:"#commands",children:"here"}),"."]}),"\n",(0,i.jsx)(n.h2,{id:"oianalytics-logs",children:"OIAnalytics logs"}),"\n",(0,i.jsxs)(n.p,{children:["If configured within the logging parameters section of\nthe ",(0,i.jsx)(n.a,{href:"/docs/guide/engine/engine-settings#logging-parameters",children:"OIBus Engine settings"}),", logs have the capability to be transmitted via\nHTTPS to OIAnalytics, allowing access to them on the OIAnalytics OIBus log page."]}),"\n",(0,i.jsx)(n.h2,{id:"commands",children:"Commands"}),"\n",(0,i.jsxs)(n.p,{children:["OIBus periodically checks for commands on OIAnalytics (see ",(0,i.jsx)(n.a,{href:"#registration-settings",children:"registration settings"}),"). Upon\nexecution, OIBus promptly sends acknowledgments back to OIAnalytics."]}),"\n",(0,i.jsx)(n.h3,{id:"upgrade-version",children:"Upgrade version"}),"\n",(0,i.jsx)(n.p,{children:"An OIAnalytics user has the ability to initiate an upgrade command by selecting the desired version for upgrading OIBus\nto a newer release."}),"\n",(0,i.jsx)(n.p,{children:"Initially, OIBus retrieves the upgrade command and then requests OIAnalytics to download the corresponding binary from\nGitHub. Upon download completion, the zip file is unpacked in the designated update folder, inside the installation\ndirectory of OIBus. Subsequently, the data folder is backed up, and OIBus is exited."}),"\n",(0,i.jsx)(n.p,{children:"The launcher actively monitors the process exit and checks the update folder for the presence of a new version. If a\nnew version is found, the launcher proceeds to copy the new binaries into the binary folder and run the OIBus process."}),"\n",(0,i.jsx)(n.p,{children:"In the event of a failure during the upgrade process, the previous version and its associated data folder are restored\nto ensure system stability and continuity."}),"\n",(0,i.jsx)(n.h3,{id:"restart",children:"Restart"}),"\n",(0,i.jsx)(n.p,{children:"The restart command kills the current process of OIBus. The OIBus launcher then restart the binary."}),"\n",(0,i.jsx)(n.h3,{id:"update-engine-settings",children:"Update engine settings"}),"\n",(0,i.jsxs)(n.p,{children:["Apply the settings set on OIAnalytics for the ",(0,i.jsx)(n.a,{href:"/docs/guide/engine/engine-settings",children:"engine settings"}),"."]}),"\n",(0,i.jsx)(n.h3,{id:"regenerate-cipher-keys",children:"Regenerate cipher keys"}),"\n",(0,i.jsxs)(n.p,{children:["To ensure the secure exchange of secrets, OIBus employs asymmetric encryption (RSA-OAEP) to encrypt secrets entered in\nOIAnalytics. Keys can be regenerated using the Regenerate Cipher Keys command. For more information about the security\nof OIAnalytics registration, refer to ",(0,i.jsx)(n.a,{href:"#security-concerns",children:"this section"}),"."]}),"\n",(0,i.jsx)(n.h3,{id:"update-registration-settings",children:"Update registration settings"}),"\n",(0,i.jsxs)(n.p,{children:["Update ",(0,i.jsx)(n.a,{href:"#timing",children:"timing settings"})," of OIAnalytics registration."]}),"\n",(0,i.jsx)(n.h3,{id:"scan-mode",children:"Scan mode"}),"\n",(0,i.jsx)(n.p,{children:"Create, update or delete scan modes."}),"\n",(0,i.jsx)(n.h3,{id:"north-connector",children:"North connector"}),"\n",(0,i.jsx)(n.p,{children:"Create, update or delete north connectors."}),"\n",(0,i.jsx)(n.h3,{id:"south-connector",children:"South connector"}),"\n",(0,i.jsx)(n.p,{children:"Create, update or delete south connectors."}),"\n",(0,i.jsx)(n.h2,{id:"messages",children:"Messages"}),"\n",(0,i.jsx)(n.p,{children:"Messages are payloads sent by OIBus to OIAnalytics, in order to update configuration of OIBus in OIAnalytics."}),"\n",(0,i.jsx)(n.h2,{id:"security-concerns",children:"Security concerns"}),"\n",(0,i.jsx)(n.h3,{id:"network-consideration",children:"Network consideration"}),"\n",(0,i.jsx)(n.p,{children:"OIBus always initiates communication, while OIAnalytics never connects to OIBus directly."}),"\n",(0,i.jsx)(n.p,{children:"Specifically, OIBus sends logs, data, and messages to OIAnalytics in response to event triggers. Additionally, OIBus\nretrieves commands by making HTTPS requests to OIAnalytics."}),"\n",(0,i.jsxs)(n.admonition,{title:"HTTPS is bidirectional",type:"info",children:[(0,i.jsx)(n.p,{children:"HTTPS operates over TCP, which is a bidirectional protocol. OIBus always initiates the connection, using HTTPS to\nretrieve payloads."}),(0,i.jsx)(n.p,{children:"For firewall configuration, outbound connections from OIBus to OIAnalytics must be permitted."})]}),"\n",(0,i.jsx)(n.h3,{id:"secrets-management",children:"Secrets management"}),"\n",(0,i.jsxs)(n.p,{children:["When OIBus sends messages to OIAnalytics, all secrets are filtered out and never leave OIBus. For more details on local\nsecret management, refer to ",(0,i.jsx)(n.a,{href:"/docs/guide/advanced/oibus-security",children:"this page"}),"."]}),"\n",(0,i.jsx)(n.p,{children:"OIAnalytics allows users to create or update south or north connectors, which may involve entering secrets. When a\nsecret is provided, it is encrypted using a public key. Plain text secrets are never stored on OIAnalytics. Only the\nprivate key, securely stored in OIBus, can decrypt the secrets."}),"\n",(0,i.jsxs)(n.p,{children:["The public/private key pair is generated during OIBus registration or when executing\na ",(0,i.jsx)(n.a,{href:"#regenerate-cipher-keys",children:"Regenerate Cipher Keys"})," command."]})]})}function h(e={}){const{wrapper:n}={...(0,r.R)(),...e.components};return n?(0,i.jsx)(n,{...e,children:(0,i.jsx)(d,{...e})}):d(e)}},1629:(e,n,s)=>{s.d(n,{A:()=>t});const t=s.p+"assets/images/oianalytics-registration-411d0594ecb77cd140eef4e0c78b7580.svg"},8453:(e,n,s)=>{s.d(n,{R:()=>a,x:()=>o});var t=s(6540);const i={},r=t.createContext(i);function a(e){const n=t.useContext(r);return t.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function o(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:a(e.components),t.createElement(r.Provider,{value:n},e.children)}}}]);