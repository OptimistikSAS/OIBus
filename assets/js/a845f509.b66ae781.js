"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[9431],{5519:(e,n,i)=>{i.r(n),i.d(n,{assets:()=>c,contentTitle:()=>r,default:()=>h,frontMatter:()=>a,metadata:()=>t,toc:()=>l});const t=JSON.parse('{"id":"guide/north-connectors/oianalytics","title":"OIAnalytics\xae","description":"Send files and values to OIAnalytics\xae.","source":"@site/docs/guide/north-connectors/oianalytics.md","sourceDirName":"guide/north-connectors","slug":"/guide/north-connectors/oianalytics","permalink":"/docs/guide/north-connectors/oianalytics","draft":false,"unlisted":false,"tags":[],"version":"current","sidebarPosition":1,"frontMatter":{"sidebar_position":1},"sidebar":"guideSidebar","previous":{"title":"Concept","permalink":"/docs/guide/north-connectors/common-settings"},"next":{"title":"File Writer","permalink":"/docs/guide/north-connectors/file-writer"}}');var s=i(4848),o=i(8453);const a={sidebar_position:1},r="OIAnalytics\xae",c={},l=[{value:"Settings",id:"settings",level:2},{value:"OIAnalytics access",id:"oianalytics-access",level:2},{value:"Best Practice for Connecting OIBus to OIAnalytics",id:"best-practice-for-connecting-oibus-to-oianalytics",level:3},{value:"Alternative Approach: Obtaining an API Key",id:"alternative-approach-obtaining-an-api-key",level:3},{value:"OIBus Time values",id:"oibus-time-values",level:2}];function d(e){const n={a:"a",admonition:"admonition",code:"code",h1:"h1",h2:"h2",h3:"h3",header:"header",img:"img",li:"li",ol:"ol",p:"p",strong:"strong",ul:"ul",...(0,o.R)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(n.header,{children:(0,s.jsx)(n.h1,{id:"oianalytics",children:"OIAnalytics\xae"})}),"\n",(0,s.jsx)(n.p,{children:"Send files and values to OIAnalytics\xae."}),"\n",(0,s.jsx)(n.p,{children:"The OIAnalytics SaaS application is equipped to handle both JSON and file payloads. JSON payloads consist of formatted\ndata points obtained from various South point protocols such as OPCUA and MQTT."}),"\n",(0,s.jsx)(n.p,{children:"Files, on the other hand, are transmitted exactly as they are received by the North connector, whether compressed or\nnot.\nOIAnalytics has the capability to manage various file formats, including CSV, TXT, and XLSX. OIAnalytics offers the\nadvantage\nof its built-in file parsers, alleviating the necessity for any pre-processing of data. The parsing process seamlessly\nunfolds within the SaaS application, courtesy of its easily configurable settings."}),"\n",(0,s.jsx)(n.h2,{id:"settings",children:"Settings"}),"\n",(0,s.jsx)(n.p,{children:"Here are the important parameters for configuring connectivity with the OIAnalytics SaaS application:"}),"\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Use OIAnalytics Module"}),": Use the connection settings of the OIAnalytics module"]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Timeout"}),": The duration before a connection failure is reported in HTTP requests."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Compress data"}),": Compress the data if not already compressed. Compressed files will be detected with the .gz file\nextension,\nand JSON payload will be compressed and sent to a specific OIAnalytics endpoint."]}),"\n"]}),"\n",(0,s.jsx)(n.p,{children:"If OIAnalytics module is not used, the following fields will be used:"}),"\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Host"}),": The hostname of the SaaS application (e.g., ",(0,s.jsx)(n.code,{children:"https://optimistik.oianalytics.com"}),")."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Accept unauthorized certificate"}),": This option is useful when HTTP queries traverse a firewall that strips the\ncertificate."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Authentication"}),":","\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Basic Auth"}),":","\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsx)(n.li,{children:"Access key: Provide the access key used for authentication."}),"\n",(0,s.jsx)(n.li,{children:"Secret key: Enter the secret key used for authentication."}),"\n"]}),"\n"]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Azure Active Directory with client secret"}),":","\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsx)(n.li,{children:"Tenant ID"}),"\n",(0,s.jsx)(n.li,{children:"Client ID"}),"\n",(0,s.jsx)(n.li,{children:"Client secret"}),"\n"]}),"\n"]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Azure Active Directory with certificate"}),":","\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsx)(n.li,{children:"Tenant ID"}),"\n",(0,s.jsx)(n.li,{children:"Client ID"}),"\n",(0,s.jsx)(n.li,{children:"Certificate"}),"\n",(0,s.jsx)(n.li,{children:"Scope"}),"\n"]}),"\n"]}),"\n"]}),"\n"]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Use proxy"}),": Choose whether to route the request through a proxy.","\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Proxy URL"}),": The URL of the proxy server to pass through."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Proxy username"}),": The username associated with the proxy."]}),"\n",(0,s.jsxs)(n.li,{children:[(0,s.jsx)(n.strong,{children:"Proxy password"}),": The password linked to the proxy."]}),"\n"]}),"\n"]}),"\n"]}),"\n",(0,s.jsx)(n.h2,{id:"oianalytics-access",children:"OIAnalytics access"}),"\n",(0,s.jsx)(n.h3,{id:"best-practice-for-connecting-oibus-to-oianalytics",children:"Best Practice for Connecting OIBus to OIAnalytics"}),"\n",(0,s.jsx)(n.p,{children:"To securely connect OIBus to OIAnalytics, follow these steps:"}),"\n",(0,s.jsxs)(n.ol,{children:["\n",(0,s.jsxs)(n.li,{children:["Register OIBus on OIAnalytics:","\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsx)(n.li,{children:"This ensures seamless integration and secure communication between OIBus and OIAnalytics."}),"\n"]}),"\n"]}),"\n",(0,s.jsxs)(n.li,{children:["Enable the Use OIAnalytics Module Option:","\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsx)(n.li,{children:"In the North connector settings, enable the Use OIAnalytics Module option to establish the connection."}),"\n",(0,s.jsx)(n.li,{children:"By doing this, you eliminate the need to manually transfer API keys, simplifying the process and enhancing security."}),"\n"]}),"\n"]}),"\n"]}),"\n",(0,s.jsx)(n.admonition,{title:"Proxy client",type:"tip",children:(0,s.jsxs)(n.p,{children:["If you want to pass data through a proxy, be sure to set the proxy in the\n",(0,s.jsx)(n.a,{href:"/docs/guide/advanced/oianalytics-registration",children:"OIAnalytics registration"}),"."]})}),"\n",(0,s.jsx)(n.h3,{id:"alternative-approach-obtaining-an-api-key",children:"Alternative Approach: Obtaining an API Key"}),"\n",(0,s.jsx)(n.p,{children:"If you choose not to register OIBus on OIAnalytics, you can still connect by obtaining an API Key. Here\u2019s how."}),"\n",(0,s.jsx)(n.p,{children:"Data sent to OIAnalytics is transmitted through the OIAnalytics public API. API access in OIAnalytics is linked to a\nuser account. Instead of conventional login credentials, an API key must be established within OIAnalytics using the\nfollowing steps:"}),"\n",(0,s.jsxs)(n.ol,{children:["\n",(0,s.jsx)(n.li,{children:"Navigate to Configuration -> Users."}),"\n",(0,s.jsx)(n.li,{children:"Locate the user for whom you intend to generate an API key, and click on the key icon."}),"\n",(0,s.jsx)(n.li,{children:"Create an API key to generate a new API key. Be sure to copy and securely store both the key and its associated\npassword."}),"\n",(0,s.jsx)(n.li,{children:"In OIBus, fill the API key and the associated secret key."}),"\n"]}),"\n",(0,s.jsx)(n.p,{children:(0,s.jsx)(n.img,{alt:"OIAnalytics API Key gen",src:i(8405).A+"",width:"791",height:"311"})}),"\n",(0,s.jsx)(n.admonition,{title:"Password retrieval",type:"danger",children:(0,s.jsx)(n.p,{children:"It's crucial to emphasize that the API key generation is the only opportunity to access and copy the password associated\nwith it. If you happen to lose this password, you will need to generate a new API key in order to obtain it."})}),"\n",(0,s.jsx)(n.admonition,{title:"API user",type:"tip",children:(0,s.jsx)(n.p,{children:"We recommend creating a dedicated API user in OIAnalytics with exclusive API access. It's advisable to assign a unique\nAPI key to each OIBus instance. This approach offers the advantage of easier key management, allowing you to revoke a\nspecific API key if necessary without affecting other instances."})}),"\n",(0,s.jsx)(n.h2,{id:"oibus-time-values",children:"OIBus Time values"}),"\n",(0,s.jsx)(n.p,{children:"OIBus time values are sent as JSON payloads to OIAnalytics. It does not use file parser, but directly look for external\nreferences in time values."})]})}function h(e={}){const{wrapper:n}={...(0,o.R)(),...e.components};return n?(0,s.jsx)(n,{...e,children:(0,s.jsx)(d,{...e})}):d(e)}},8405:(e,n,i)=>{i.d(n,{A:()=>t});const t=i.p+"assets/images/oia-api-key-gen-0e032c6f08e008247b7c22bb33ae98b1.png"},8453:(e,n,i)=>{i.d(n,{R:()=>a,x:()=>r});var t=i(6540);const s={},o=t.createContext(s);function a(e){const n=t.useContext(o);return t.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function r(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:a(e.components),t.createElement(o.Provider,{value:n},e.children)}}}]);