"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[1689],{8743:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>c,contentTitle:()=>s,default:()=>h,frontMatter:()=>o,metadata:()=>a,toc:()=>d});var i=t(4848),r=t(8453);const o={sidebar_position:3},s="File Writer",a={id:"guide/north-connectors/file-writer",title:"File Writer",description:"The File Writer connector performs a straightforward task of writing the data received from the South connector to a",source:"@site/docs/guide/north-connectors/file-writer.md",sourceDirName:"guide/north-connectors",slug:"/guide/north-connectors/file-writer",permalink:"/docs/guide/north-connectors/file-writer",draft:!1,unlisted:!1,tags:[],version:"current",sidebarPosition:3,frontMatter:{sidebar_position:3},sidebar:"guideSidebar",previous:{title:"OIAnalytics",permalink:"/docs/guide/north-connectors/oianalytics"},next:{title:"AWS S3",permalink:"/docs/guide/north-connectors/aws-s3"}},c={},d=[{value:"Specific settings",id:"specific-settings",level:2},{value:"JSON payloads",id:"json-payloads",level:2}];function l(e){const n={admonition:"admonition",code:"code",em:"em",h1:"h1",h2:"h2",li:"li",p:"p",pre:"pre",strong:"strong",ul:"ul",...(0,r.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(n.h1,{id:"file-writer",children:"File Writer"}),"\n",(0,i.jsx)(n.p,{children:"The File Writer connector performs a straightforward task of writing the data received from the South connector to a\ndesignated folder."}),"\n",(0,i.jsx)(n.h2,{id:"specific-settings",children:"Specific settings"}),"\n",(0,i.jsxs)(n.ul,{children:["\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Output folder"}),": This is the directory where files will be stored. In the case of a relative path, it is computed based\non the ",(0,i.jsx)(n.strong,{children:"Data folder"})," mentioned in the ",(0,i.jsx)(n.em,{children:"About"})," section."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Prefix filename"}),": You can include a prefix to be added to the filename."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Suffix filename"}),": You have the option to append a suffix to the filename, which appears just before the file extension."]}),"\n"]}),"\n",(0,i.jsx)(n.admonition,{type:"tip",children:(0,i.jsxs)(n.p,{children:["Prefix and suffix options can incorporate the internal variables ",(0,i.jsx)(n.code,{children:"@ConnectorName"})," and ",(0,i.jsx)(n.code,{children:"@CurrentDate"}),". For instance,\nwhen using ",(0,i.jsx)(n.code,{children:"@ConnectorName-"})," as a prefix and ",(0,i.jsx)(n.code,{children:"-@CurrentDate"})," as a suffix, a filename like ",(0,i.jsx)(n.em,{children:"example.file"})," will result\nin an output format of ",(0,i.jsx)(n.code,{children:"<ConnectorName>-example-<CurrentDate>.file"}),", where ",(0,i.jsx)(n.code,{children:"<CurrentDate>"})," will be replaced with the\ncurrent date and time in the ",(0,i.jsx)(n.strong,{children:"yyyy_MM_dd_HH_mm_ss_SSS"})," format."]})}),"\n",(0,i.jsx)(n.h2,{id:"json-payloads",children:"JSON payloads"}),"\n",(0,i.jsx)(n.p,{children:"In the case of JSON payloads, the JSON data is stored in a JSON file. For instance:"}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{className:"language-json",metastring:'title="JSON file"',children:'[{"timestamp":"2020-01-01T00:00:00.000Z","data":"{ value: 28 }","pointId":"MyPointId1"}]\n'})})]})}function h(e={}){const{wrapper:n}={...(0,r.R)(),...e.components};return n?(0,i.jsx)(n,{...e,children:(0,i.jsx)(l,{...e})}):l(e)}},8453:(e,n,t)=>{t.d(n,{R:()=>s,x:()=>a});var i=t(6540);const r={},o=i.createContext(r);function s(e){const n=i.useContext(o);return i.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function a(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:s(e.components),i.createElement(o.Provider,{value:n},e.children)}}}]);