"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[9450],{1052:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>d,contentTitle:()=>r,default:()=>h,frontMatter:()=>a,metadata:()=>i,toc:()=>c});const i=JSON.parse('{"id":"guide/oibus-agent/installation","title":"Concept and installation","description":"The OIBus Agent is a specialized tool designed to handle protocol-specific queries via HTTP. It is primarily used for","source":"@site/docs/guide/oibus-agent/installation.mdx","sourceDirName":"guide/oibus-agent","slug":"/guide/oibus-agent/installation","permalink":"/docs/guide/oibus-agent/installation","draft":false,"unlisted":false,"tags":[],"version":"current","sidebarPosition":1,"frontMatter":{"sidebar_position":1},"sidebar":"guideSidebar","previous":{"title":"OIBus Agent","permalink":"/docs/category/oibus-agent"},"next":{"title":"ODBC","permalink":"/docs/guide/oibus-agent/odbc"}}');var s=t(4848),l=t(8453),o=t(3566);const a={sidebar_position:1},r="Concept and installation",d={},c=[{value:"Download",id:"download",level:2},{value:"Setup",id:"setup",level:2},{value:"Installation",id:"installation",level:3},{value:"Uninstalling",id:"uninstalling",level:3},{value:"Running the agent",id:"running-the-agent",level:2}];function u(e){const n={code:"code",h1:"h1",h2:"h2",h3:"h3",header:"header",li:"li",p:"p",pre:"pre",ul:"ul",...(0,l.R)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(n.header,{children:(0,s.jsx)(n.h1,{id:"concept-and-installation",children:"Concept and installation"})}),"\n",(0,s.jsx)(n.p,{children:"The OIBus Agent is a specialized tool designed to handle protocol-specific queries via HTTP. It is primarily used for\nWindows-only technologies, such as OPC Classic\u2122, OLEDB, and OSIsoft PI System\u2122. Additionally, it natively supports\ncertain protocols, like ODBC, to ensure optimal performance."}),"\n",(0,s.jsx)(n.p,{children:"The primary purpose of the OIBus Agent is to integrate seamlessly with OIBus and its South connectors. However, it can\nalso function independently via its API. This documentation provides a detailed overview of the API, organized protocol\nby protocol."}),"\n",(0,s.jsx)(n.h2,{id:"download",children:"Download"}),"\n",(0,s.jsxs)("div",{style:{display:"flex",justifyContent:"space-around"},children:[(0,s.jsx)(o.A,{link:"https://github.com/OptimistikSAS/OIBusAgentRelease/releases/latest/download/oibus-agent-win_x64.zip",children:(0,s.jsx)("div",{children:"Windows (x64)"})}),(0,s.jsx)(o.A,{link:"https://github.com/OptimistikSAS/OIBusAgentRelease/releases/latest/download/oibus-agent-win_x86.zip",children:(0,s.jsx)("div",{children:"Windows (x86)"})}),(0,s.jsx)(o.A,{link:"https://github.com/OptimistikSAS/OIBusAgentRelease/releases/latest/download/oibus-agent-win_arm64.zip",children:(0,s.jsx)("div",{children:"Windows (arm64)"})})]}),"\n",(0,s.jsx)(n.h2,{id:"setup",children:"Setup"}),"\n",(0,s.jsx)(n.p,{children:"Unzip the archive, from which you will get three files:"}),"\n",(0,s.jsxs)(n.ul,{children:["\n",(0,s.jsx)(n.li,{children:"OIBusAgent.exe: binary used to run the agent"}),"\n",(0,s.jsx)(n.li,{children:"install-agent.bat: script used to install the agent as a Windows service"}),"\n",(0,s.jsx)(n.li,{children:"uninstall-agent.bat: script used to uninstall the service"}),"\n"]}),"\n",(0,s.jsx)(n.h3,{id:"installation",children:"Installation"}),"\n",(0,s.jsxs)(n.p,{children:["By default, running ",(0,s.jsx)(n.code,{children:"install-agent.bat"})," install the agent as a service with the name ",(0,s.jsx)(n.code,{children:"OIBusAgent"})," and will listen to\nport ",(0,s.jsx)(n.code,{children:"2224"}),":"]}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"install-agent.bat\n"})}),"\n",(0,s.jsx)(n.p,{children:"But it is also possible to specify a name and a port through the command line:"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:'install-agent.bat -n="My OIBus Agent" -p=2225\n'})}),"\n",(0,s.jsx)(n.h3,{id:"uninstalling",children:"Uninstalling"}),"\n",(0,s.jsx)(n.p,{children:"If the agent has been set up with default values, running the uninstallation script is enough:"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"uninstall-agent.bat\n"})}),"\n",(0,s.jsx)(n.p,{children:"If the agent has been installed with a specific name, you must specify its name:"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:'uninstall-agent.bat -n="My OIBus Agent"\n'})}),"\n",(0,s.jsx)(n.h2,{id:"running-the-agent",children:"Running the agent"}),"\n",(0,s.jsx)(n.p,{children:"If you just want to run the agent without using the service manager, simply run the following command in a terminal:"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"OIBusAgent.exe\n"})}),"\n",(0,s.jsx)(n.p,{children:"That will run the OIBus agent on its default HTTP port 2224. You can specify another port with:"}),"\n",(0,s.jsx)(n.pre,{children:(0,s.jsx)(n.code,{children:"OIBusAgent.exe -p 2225\n"})})]})}function h(e={}){const{wrapper:n}={...(0,l.R)(),...e.components};return n?(0,s.jsx)(n,{...e,children:(0,s.jsx)(u,{...e})}):u(e)}},3566:(e,n,t)=>{t.d(n,{A:()=>a});t(6540);var i=t(5556),s=t.n(i),l=t(4848);const o=e=>{let{children:n,link:t,color:i}=e;return(0,l.jsx)("div",{style:{marginBottom:"20px",marginTop:"10px",textAlign:"center"},children:(0,l.jsx)("a",{rel:"nofollow",href:t,style:{backgroundColor:i,borderRadius:"10px",color:"#f5f5f5",padding:"10px",cursor:"pointer",minWidth:"10rem",textAlign:"center",display:"flex",justifyContent:"space-around"},children:n})})};o.propTypes={link:s().string.isRequired,color:s().string,children:s().object.isRequired},o.defaultProps={color:"#009ee0"};const a=o},8453:(e,n,t)=>{t.d(n,{R:()=>o,x:()=>a});var i=t(6540);const s={},l=i.createContext(s);function o(e){const n=i.useContext(l);return i.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function a(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:o(e.components),i.createElement(l.Provider,{value:n},e.children)}}}]);