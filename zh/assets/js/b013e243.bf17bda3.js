"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[2927],{1914:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>d,contentTitle:()=>s,default:()=>u,frontMatter:()=>o,metadata:()=>c,toc:()=>l});var r=t(4848),i=t(8453);const o={sidebar_position:3},s="\u6587\u4ef6\u5199\u5165\u5668",c={id:"guide/north-connectors/file-writer",title:"\u6587\u4ef6\u5199\u5165\u5668",description:"\u6587\u4ef6\u5199\u5165\u5668\u8fde\u63a5\u5668\u6267\u884c\u4e00\u4e2a\u7b80\u5355\u7684\u4efb\u52a1\uff0c\u5c06\u6765\u81ea\u5357\u5411\u8fde\u63a5\u5668\u63a5\u6536\u7684\u6570\u636e\u5199\u5165\u5230\u4e00\u4e2a\u6307\u5b9a\u7684\u6587\u4ef6\u5939\u4e2d\u3002",source:"@site/i18n/zh/docusaurus-plugin-content-docs/current/guide/north-connectors/file-writer.md",sourceDirName:"guide/north-connectors",slug:"/guide/north-connectors/file-writer",permalink:"/zh/docs/guide/north-connectors/file-writer",draft:!1,unlisted:!1,tags:[],version:"current",sidebarPosition:3,frontMatter:{sidebar_position:3},sidebar:"guideSidebar",previous:{title:"OIAnalytics",permalink:"/zh/docs/guide/north-connectors/oianalytics"},next:{title:"AWS S3",permalink:"/zh/docs/guide/north-connectors/aws-s3"}},d={},l=[{value:"\u7279\u5b9a\u8bbe\u7f6e",id:"\u7279\u5b9a\u8bbe\u7f6e",level:2},{value:"JSON \u8d1f\u8f7d",id:"json-\u8d1f\u8f7d",level:2}];function a(e){const n={admonition:"admonition",code:"code",em:"em",h1:"h1",h2:"h2",li:"li",p:"p",pre:"pre",strong:"strong",ul:"ul",...(0,i.R)(),...e.components};return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(n.h1,{id:"\u6587\u4ef6\u5199\u5165\u5668",children:"\u6587\u4ef6\u5199\u5165\u5668"}),"\n",(0,r.jsx)(n.p,{children:"\u6587\u4ef6\u5199\u5165\u5668\u8fde\u63a5\u5668\u6267\u884c\u4e00\u4e2a\u7b80\u5355\u7684\u4efb\u52a1\uff0c\u5c06\u6765\u81ea\u5357\u5411\u8fde\u63a5\u5668\u63a5\u6536\u7684\u6570\u636e\u5199\u5165\u5230\u4e00\u4e2a\u6307\u5b9a\u7684\u6587\u4ef6\u5939\u4e2d\u3002"}),"\n",(0,r.jsx)(n.h2,{id:"\u7279\u5b9a\u8bbe\u7f6e",children:"\u7279\u5b9a\u8bbe\u7f6e"}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"\u8f93\u51fa\u6587\u4ef6\u5939"}),"\uff1a\u8fd9\u662f\u5c06\u5b58\u50a8\u6587\u4ef6\u7684\u76ee\u5f55\u3002\u5982\u679c\u662f\u76f8\u5bf9\u8def\u5f84\uff0c\u5b83\u662f\u57fa\u4e8e ",(0,r.jsx)(n.em,{children:"\u5173\u4e8e"})," \u90e8\u5206\u63d0\u5230\u7684",(0,r.jsx)(n.strong,{children:"\u6570\u636e\u6587\u4ef6\u5939"}),"\u8ba1\u7b97\u5f97\u51fa\u7684\u3002"]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"\u6587\u4ef6\u540d\u524d\u7f00"}),"\uff1a\u4f60\u53ef\u4ee5\u52a0\u5165\u4e00\u4e2a\u524d\u7f00\u5230\u6587\u4ef6\u540d\u3002"]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.strong,{children:"\u6587\u4ef6\u540d\u540e\u7f00"}),"\uff1a\u4f60\u53ef\u4ee5\u9009\u62e9\u5728\u6587\u4ef6\u6269\u5c55\u540d\u4e4b\u524d\u8ffd\u52a0\u4e00\u4e2a\u540e\u7f00\u5230\u6587\u4ef6\u540d\u3002"]}),"\n"]}),"\n",(0,r.jsx)(n.admonition,{type:"tip",children:(0,r.jsxs)(n.p,{children:["\u524d\u7f00\u548c\u540e\u7f00\u9009\u9879\u53ef\u4ee5\u5305\u542b\u5185\u90e8\u53d8\u91cf",(0,r.jsx)(n.code,{children:"@ConnectorName"})," \u548c ",(0,r.jsx)(n.code,{children:"@CurrentDate"}),"\u3002\u4f8b\u5982\uff0c\u4f7f\u7528 ",(0,r.jsx)(n.code,{children:"@ConnectorName-"})," \u4f5c\u4e3a\u524d\u7f00\u5e76 ",(0,r.jsx)(n.code,{children:"-@CurrentDate"})," \u4f5c\u4e3a\u540e\u7f00\u65f6\uff0c\u50cf ",(0,r.jsx)(n.em,{children:"example.file"})," \u8fd9\u6837\u7684\u6587\u4ef6\u540d\u5c06\u5bfc\u51fa\u4e3a ",(0,r.jsx)(n.code,{children:"<ConnectorName>-example-<CurrentDate>.file"})," \u7684\u683c\u5f0f\uff0c\u5176\u4e2d ",(0,r.jsx)(n.code,{children:"<CurrentDate>"})," \u4f1a\u88ab\u66ff\u6362\u6210\u5f53\u524d\u65e5\u671f\u548c\u65f6\u95f4\u7684 ",(0,r.jsx)(n.strong,{children:"yyyy_MM_dd_HH_mm_ss_SSS"})," \u683c\u5f0f\u3002"]})}),"\n",(0,r.jsx)(n.h2,{id:"json-\u8d1f\u8f7d",children:"JSON \u8d1f\u8f7d"}),"\n",(0,r.jsx)(n.p,{children:"\u5728JSON\u8d1f\u8f7d\u7684\u60c5\u51b5\u4e0b\uff0cJSON\u6570\u636e\u5c06\u88ab\u5b58\u50a8\u5728\u4e00\u4e2aJSON\u6587\u4ef6\u4e2d\u3002\u4f8b\u5982\uff1a"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-json",metastring:'title="JSON file"',children:'[{"timestamp":"2020-01-01T00:00:00.000Z","data":"{ value: 28 }","pointId":"MyPointId1"}]\n'})})]})}function u(e={}){const{wrapper:n}={...(0,i.R)(),...e.components};return n?(0,r.jsx)(n,{...e,children:(0,r.jsx)(a,{...e})}):a(e)}},8453:(e,n,t)=>{t.d(n,{R:()=>s,x:()=>c});var r=t(6540);const i={},o=r.createContext(i);function s(e){const n=r.useContext(o);return r.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function c(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:s(e.components),r.createElement(o.Provider,{value:n},e.children)}}}]);