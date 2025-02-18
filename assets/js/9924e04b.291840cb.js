"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[9330],{855:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>a,contentTitle:()=>c,default:()=>h,frontMatter:()=>o,metadata:()=>s,toc:()=>d});const s=JSON.parse('{"id":"guide/north-connectors/sftp","title":"SFTP","description":"Upload files and data to an SFTP server.","source":"@site/docs/guide/north-connectors/sftp.md","sourceDirName":"guide/north-connectors","slug":"/guide/north-connectors/sftp","permalink":"/docs/guide/north-connectors/sftp","draft":false,"unlisted":false,"tags":[],"version":"current","sidebarPosition":3,"frontMatter":{"sidebar_position":3},"sidebar":"guideSidebar","previous":{"title":"File Writer","permalink":"/docs/guide/north-connectors/file-writer"},"next":{"title":"Amazon S3\u2122","permalink":"/docs/guide/north-connectors/aws-s3"}}');var i=t(4848),r=t(8453);const o={sidebar_position:3},c="SFTP",a={},d=[{value:"Specific settings",id:"specific-settings",level:2},{value:"OIBus Time values",id:"oibus-time-values",level:2}];function l(e){const n={admonition:"admonition",code:"code",em:"em",h1:"h1",h2:"h2",header:"header",li:"li",p:"p",strong:"strong",ul:"ul",...(0,r.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(n.header,{children:(0,i.jsx)(n.h1,{id:"sftp",children:"SFTP"})}),"\n",(0,i.jsx)(n.p,{children:"Upload files and data to an SFTP server."}),"\n",(0,i.jsx)(n.h2,{id:"specific-settings",children:"Specific settings"}),"\n",(0,i.jsxs)(n.ul,{children:["\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Host"}),": IP address or hostname of the SFTP server machine."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Port"}),": The port to use for connection (8080 by default)."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Authentication"}),":","\n",(0,i.jsxs)(n.ul,{children:["\n",(0,i.jsx)(n.li,{children:"Password: The username and password"}),"\n",(0,i.jsx)(n.li,{children:"Private key: The username and the path of the private key (PEM format). A passphrase can be used with the private\nkey."}),"\n"]}),"\n"]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Remote folder"}),": This is the directory where files will be stored."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Prefix"}),": You can include a prefix to be added to the filename."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Suffix"}),": You have the option to append a suffix to the filename, which appears just before the file extension."]}),"\n"]}),"\n",(0,i.jsx)(n.admonition,{type:"tip",children:(0,i.jsxs)(n.p,{children:["Prefix and suffix options can incorporate the internal variables ",(0,i.jsx)(n.code,{children:"@ConnectorName"})," and ",(0,i.jsx)(n.code,{children:"@CurrentDate"}),". For instance,\nwhen using ",(0,i.jsx)(n.code,{children:"@ConnectorName-"})," as a prefix and ",(0,i.jsx)(n.code,{children:"-@CurrentDate"})," as a suffix, a filename like ",(0,i.jsx)(n.em,{children:"example.file"})," will result\nin an output format of ",(0,i.jsx)(n.code,{children:"<ConnectorName>-example-<CurrentDate>.file"}),", where ",(0,i.jsx)(n.code,{children:"<CurrentDate>"})," will be replaced with the\ncurrent date and time in the ",(0,i.jsx)(n.strong,{children:"yyyy_MM_dd_HH_mm_ss_SSS"})," format."]})}),"\n",(0,i.jsx)(n.h2,{id:"oibus-time-values",children:"OIBus Time values"}),"\n",(0,i.jsx)(n.p,{children:"OIBus time values are converted into CSV format before being sent to the SFTP server."})]})}function h(e={}){const{wrapper:n}={...(0,r.R)(),...e.components};return n?(0,i.jsx)(n,{...e,children:(0,i.jsx)(l,{...e})}):l(e)}},8453:(e,n,t)=>{t.d(n,{R:()=>o,x:()=>c});var s=t(6540);const i={},r=s.createContext(i);function o(e){const n=s.useContext(r);return s.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function c(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:o(e.components),s.createElement(r.Provider,{value:n},e.children)}}}]);