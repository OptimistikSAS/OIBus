"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[2054],{1447:(n,e,s)=>{s.r(e),s.d(e,{assets:()=>d,contentTitle:()=>i,default:()=>h,frontMatter:()=>o,metadata:()=>c,toc:()=>l});var r=s(4848),t=s(8453);const o={sidebar_position:4},i="AWS S3",c={id:"guide/north-connectors/aws-s3",title:"AWS S3",description:"AWS S3 \u5317\u5411\u8fde\u63a5\u5668\u65e8\u5728\u5c06\u5357\u5411\u8fde\u63a5\u5668\u63a5\u6536\u7684\u6587\u4ef6\u5199\u5165\u6307\u5b9a\u7684 AWS S3 \u5b58\u50a8\u6876\u4e2d\u3002",source:"@site/i18n/zh/docusaurus-plugin-content-docs/current/guide/north-connectors/aws-s3.md",sourceDirName:"guide/north-connectors",slug:"/guide/north-connectors/aws-s3",permalink:"/zh/docs/guide/north-connectors/aws-s3",draft:!1,unlisted:!1,tags:[],version:"current",sidebarPosition:4,frontMatter:{sidebar_position:4},sidebar:"guideSidebar",previous:{title:"\u6587\u4ef6\u5199\u5165\u5668",permalink:"/zh/docs/guide/north-connectors/file-writer"},next:{title:"Azure Blob",permalink:"/zh/docs/guide/north-connectors/azure-blob"}},d={},l=[{value:"\u7279\u5b9a\u8bbe\u7f6e",id:"\u7279\u5b9a\u8bbe\u7f6e",level:2}];function u(n){const e={code:"code",h1:"h1",h2:"h2",li:"li",p:"p",strong:"strong",ul:"ul",...(0,t.R)(),...n.components};return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(e.h1,{id:"aws-s3",children:"AWS S3"}),"\n",(0,r.jsx)(e.p,{children:"AWS S3 \u5317\u5411\u8fde\u63a5\u5668\u65e8\u5728\u5c06\u5357\u5411\u8fde\u63a5\u5668\u63a5\u6536\u7684\u6587\u4ef6\u5199\u5165\u6307\u5b9a\u7684 AWS S3 \u5b58\u50a8\u6876\u4e2d\u3002"}),"\n",(0,r.jsx)(e.h2,{id:"\u7279\u5b9a\u8bbe\u7f6e",children:"\u7279\u5b9a\u8bbe\u7f6e"}),"\n",(0,r.jsx)(e.p,{children:"\u4ee5\u4e0b\u662f\u914d\u7f6e AWS S3 \u8fde\u63a5\u5668\u7684\u5fc5\u8981\u53c2\u6570\uff1a"}),"\n",(0,r.jsxs)(e.ul,{children:["\n",(0,r.jsxs)(e.li,{children:[(0,r.jsx)(e.strong,{children:"\u5b58\u50a8\u6876"}),"\uff1aAWS S3 \u5b58\u50a8\u6876\u7684\u540d\u79f0\u3002"]}),"\n",(0,r.jsxs)(e.li,{children:[(0,r.jsx)(e.strong,{children:"\u533a\u57df"}),"\uff1a\u5b58\u50a8\u6876\u6240\u5728\u7684\u533a\u57df\uff08\u4f8b\u5982\uff0c",(0,r.jsx)(e.code,{children:"eu-west-3"}),"\uff09\u3002"]}),"\n",(0,r.jsxs)(e.li,{children:[(0,r.jsx)(e.strong,{children:"\u6587\u4ef6\u5939"}),"\uff1a\u6587\u4ef6\u5e94\u5b58\u50a8\u5728\u5b58\u50a8\u6876\u4e2d\u7684\u7279\u5b9a\u6587\u4ef6\u5939\u3002"]}),"\n",(0,r.jsxs)(e.li,{children:[(0,r.jsx)(e.strong,{children:"\u8bbf\u95ee\u5bc6\u94a5"}),"\uff1a\u7528\u4e8e\u8fde\u63a5\u5230 Amazon S3 \u5b58\u50a8\u6876\u7684\u9a8c\u8bc1\u5bc6\u94a5\u3002"]}),"\n",(0,r.jsxs)(e.li,{children:[(0,r.jsx)(e.strong,{children:"\u79d8\u5bc6\u5bc6\u94a5"}),"\uff1a\u4e0e\u8bbf\u95ee\u5bc6\u94a5\u5173\u8054\u7684\u79d8\u5bc6\u5bc6\u94a5\u3002"]}),"\n",(0,r.jsxs)(e.li,{children:[(0,r.jsx)(e.strong,{children:"\u4f7f\u7528\u4ee3\u7406"}),"\uff1a\u4f7f\u7528\u4ee3\u7406\u53d1\u9001 HTTP \u8bf7\u6c42\u7684\u9009\u9879\u3002"]}),"\n",(0,r.jsxs)(e.li,{children:[(0,r.jsx)(e.strong,{children:"\u4ee3\u7406 URL"}),"\uff1a\u901a\u8fc7\u8be5\u4ee3\u7406\u670d\u52a1\u5668\u4f20\u9012\u8bf7\u6c42\u7684 URL\u3002"]}),"\n",(0,r.jsxs)(e.li,{children:[(0,r.jsx)(e.strong,{children:"\u4ee3\u7406\u7528\u6237\u540d"}),"\uff1a\u4e0e\u4ee3\u7406\u76f8\u5173\u7684\u7528\u6237\u540d\u3002"]}),"\n",(0,r.jsxs)(e.li,{children:[(0,r.jsx)(e.strong,{children:"\u4ee3\u7406\u5bc6\u7801"}),"\uff1a\u4e0e\u4ee3\u7406\u7528\u6237\u540d\u5173\u8054\u7684\u5bc6\u7801\u3002"]}),"\n"]})]})}function h(n={}){const{wrapper:e}={...(0,t.R)(),...n.components};return e?(0,r.jsx)(e,{...n,children:(0,r.jsx)(u,{...n})}):u(n)}},8453:(n,e,s)=>{s.d(e,{R:()=>i,x:()=>c});var r=s(6540);const t={},o=r.createContext(t);function i(n){const e=r.useContext(o);return r.useMemo((function(){return"function"==typeof n?n(e):{...e,...n}}),[e,n])}function c(n){let e;return e=n.disableParentContext?"function"==typeof n.components?n.components(t):n.components||t:i(n.components),r.createElement(o.Provider,{value:e},n.children)}}}]);