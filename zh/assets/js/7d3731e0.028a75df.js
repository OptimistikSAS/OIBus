"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[5575],{138:(n,e,s)=>{s.r(e),s.d(e,{assets:()=>d,contentTitle:()=>c,default:()=>u,frontMatter:()=>t,metadata:()=>i,toc:()=>l});const i=JSON.parse('{"id":"guide/south-connectors/opc","title":"OPCHDA","description":"OPCDA\u548cOPCHDA\u662f\u7531OPC\u57fa\u91d1\u4f1a\u5f00\u53d1\u7684\u5de5\u4e1a\u754c\u4f7f\u7528\u7684\u901a\u4fe1\u534f\u8bae\u3002\u8fd9\u9879\u6280\u672f\u5df2\u88abOPCUA\u53d6\u4ee3\uff0c\u4f46\u5728\u5de5\u4e1a\u754c\u4ecd\u5e7f\u6cdb\u4f7f\u7528\u3002\u8981\u5728OIBus\u4e2d\u4f7f\u7528OPCUA\uff0c\u8bf7\u53c2\u9605OPCUA\u8fde\u63a5\u5668\u6587\u6863\u3002","source":"@site/i18n/zh/docusaurus-plugin-content-docs/current/guide/south-connectors/opc.mdx","sourceDirName":"guide/south-connectors","slug":"/guide/south-connectors/opc","permalink":"/zh/docs/guide/south-connectors/opc","draft":false,"unlisted":false,"tags":[],"version":"current","sidebarPosition":10,"frontMatter":{"sidebar_position":10},"sidebar":"guideSidebar","previous":{"title":"MySQL / MariaDB","permalink":"/zh/docs/guide/south-connectors/mysql"},"next":{"title":"Oracle","permalink":"/zh/docs/guide/south-connectors/oracle"}}');var o=s(4848),r=s(8453);const t={sidebar_position:10},c="OPCHDA",d={},l=[{value:"\u7279\u5b9a\u8bbe\u7f6e",id:"\u7279\u5b9a\u8bbe\u7f6e",level:2},{value:"\u9879\u76ee\u8bbe\u7f6e",id:"\u9879\u76ee\u8bbe\u7f6e",level:2}];function h(n){const e={a:"a",admonition:"admonition",code:"code",h1:"h1",h2:"h2",header:"header",li:"li",p:"p",strong:"strong",ul:"ul",...(0,r.R)(),...n.components};return(0,o.jsxs)(o.Fragment,{children:[(0,o.jsx)(e.header,{children:(0,o.jsx)(e.h1,{id:"opchda",children:"OPCHDA"})}),"\n",(0,o.jsxs)(e.p,{children:["OPCDA\u548cOPCHDA\u662f\u7531",(0,o.jsx)(e.a,{href:"https://opcfoundation.org/",children:"OPC\u57fa\u91d1\u4f1a"}),"\u5f00\u53d1\u7684\u5de5\u4e1a\u754c\u4f7f\u7528\u7684\u901a\u4fe1\u534f\u8bae\u3002\u8fd9\u9879\u6280\u672f\u5df2\u88abOPCUA\u53d6\u4ee3\uff0c\u4f46\u5728\u5de5\u4e1a\u754c\u4ecd\u5e7f\u6cdb\u4f7f\u7528\u3002\u8981\u5728OIBus\u4e2d\u4f7f\u7528OPCUA\uff0c\u8bf7\u53c2\u9605",(0,o.jsx)(e.a,{href:"/zh/docs/guide/south-connectors/opcua",children:"OPCUA\u8fde\u63a5\u5668\u6587\u6863"}),"\u3002"]}),"\n",(0,o.jsx)(e.p,{children:"HDA\u670d\u52a1\u5668\u5141\u8bb8\u68c0\u7d22\u6570\u636e\u7684\u5386\u53f2\u8bb0\u5f55\uff0c\u6db5\u76d6\u8f83\u957f\u6216\u8f83\u77ed\u7684\u65f6\u95f4\u6bb5\uff0c\u800cDA\u670d\u52a1\u5668\u53ea\u5141\u8bb8\u68c0\u7d22\u6807\u7b7e\u7684\u6700\u65b0\u503c\u3002"}),"\n",(0,o.jsxs)(e.p,{children:["OIBus\u4ec5\u652f\u6301OPCHDA\u3002\u8be5\u8fde\u63a5\u5668\u4f7f\u7528",(0,o.jsx)(e.a,{href:"/zh/docs/guide/oibus-agent/installation",children:"OIBus Agent"}),"\u548c\u4e00\u4e2a\u4e13\u7528\u7684HDA\u6a21\u5757\u3002"]}),"\n",(0,o.jsx)(e.admonition,{type:"caution",children:(0,o.jsx)(e.p,{children:"\u4f7f\u7528HDA\u6a21\u5757\u65f6\uff0cOIBus Agent\u5fc5\u987b\u5b89\u88c5\u5728Windows\u673a\u5668\u4e0a\u3002"})}),"\n",(0,o.jsxs)(e.p,{children:["HDA\u6a21\u5757\u4e5f\u53ef\u4ee5\u4f5c\u4e3a\u72ec\u7acb\u4f7f\u7528\uff0c\u4ee5\u547d\u4ee4\u884c\u65b9\u5f0f\u6267\u884cOPC\u5386\u53f2\u6570\u636e\u63d0\u53d6\u3002\u53c2\u9605",(0,o.jsx)(e.a,{href:"/zh/docs/guide/oibus-agent/opc",children:"OPC\u4ee3\u7406\u6587\u6863"}),"\u4ee5\u72ec\u7acb\u4f7f\u7528\u8be5\u6a21\u5757\uff0c\u5e76\u67e5\u770bCOM/DCOM\u8bbe\u7f6e\u6587\u6863\uff0c\u4ee5\u6b63\u786e\u5b89\u88c5\u8be5\u6a21\u5757\u3002"]}),"\n",(0,o.jsx)(e.h2,{id:"\u7279\u5b9a\u8bbe\u7f6e",children:"\u7279\u5b9a\u8bbe\u7f6e"}),"\n",(0,o.jsx)(e.p,{children:"OIBus\u901a\u8fc7TCP\u670d\u52a1\u5668/\u5ba2\u6237\u7aef\u901a\u4fe1\u4e0eHDA\u4ee3\u7406\u4ea4\u6362\u547d\u4ee4\u548c\u6570\u636e\u3002\u56e0\u6b64\uff0c\u9700\u8981\u586b\u5199\u51e0\u4e2a\u5b57\u6bb5\uff0c\u4f7fOIBus\u80fd\u591f\u4e0eHDA\u4ee3\u7406\u901a\u4fe1\uff1a"}),"\n",(0,o.jsxs)(e.ul,{children:["\n",(0,o.jsxs)(e.li,{children:[(0,o.jsx)(e.strong,{children:"\u8fdc\u7a0b\u4ee3\u7406URL"}),"\uff1a\u6307\u5b9a\u8fdc\u7a0bOIBus\u4ee3\u7406\u7684URL\uff0c\u4f8b\u5982\uff0c",(0,o.jsx)(e.code,{children:"http://ip-address-or-host:2224"}),"\u3002"]}),"\n",(0,o.jsxs)(e.li,{children:[(0,o.jsx)(e.strong,{children:"\u8fde\u63a5\u8d85\u65f6"}),"\uff1a\u8bbe\u7f6e\u5efa\u7acb\u8fde\u63a5\u7684\u8d85\u65f6\u65f6\u95f4\u3002"]}),"\n",(0,o.jsxs)(e.li,{children:[(0,o.jsx)(e.strong,{children:"\u91cd\u8bd5\u95f4\u9694"}),"\uff1a\u91cd\u65b0\u5c1d\u8bd5\u8fde\u63a5\u524d\u7684\u7b49\u5f85\u65f6\u95f4\u3002"]}),"\n",(0,o.jsxs)(e.li,{children:[(0,o.jsx)(e.strong,{children:"\u670d\u52a1\u5668\u4e3b\u673a"}),"\uff1aOPC\u670d\u52a1\u5668\u7684\u5730\u5740\uff08\u6765\u81ea\u8fdc\u7a0bOIBus\u4ee3\u7406\u673a\u5668\uff09\u3002"]}),"\n",(0,o.jsxs)(e.li,{children:[(0,o.jsx)(e.strong,{children:"\u670d\u52a1\u5668\u540d\u79f0"}),"\uff1aOPC\u670d\u52a1\u5668\u7684\u540d\u79f0\uff08\u4f8b\u5982Matrikon.OPC.Simulation\uff09\u3002"]}),"\n"]}),"\n",(0,o.jsx)(e.h2,{id:"\u9879\u76ee\u8bbe\u7f6e",children:"\u9879\u76ee\u8bbe\u7f6e"}),"\n",(0,o.jsx)(e.p,{children:"\u5728\u914d\u7f6e\u6bcf\u4e2a\u9879\u76ee\u4ee5\u68c0\u7d22JSON\u6709\u6548\u8d1f\u8f7d\u4e2d\u7684\u6570\u636e\u65f6\uff0c\u60a8\u9700\u8981\u6307\u5b9a\u4ee5\u4e0b\u7279\u5b9a\u8bbe\u7f6e\uff1a"}),"\n",(0,o.jsxs)(e.ul,{children:["\n",(0,o.jsxs)(e.li,{children:[(0,o.jsx)(e.strong,{children:"\u8282\u70b9ID"}),"\uff1a\u8282\u70b9ID\u5bf9\u5e94\u4e8eOPC\u670d\u52a1\u5668\u4e0a\u9002\u5f53\u547d\u540d\u7a7a\u95f4\u4e2d\u6570\u636e\u7684\u8def\u5f84\u3002"]}),"\n",(0,o.jsxs)(e.li,{children:[(0,o.jsx)(e.strong,{children:"\u6c47\u603b"}),"\uff1a\u5728\u8bf7\u6c42\u7684\u95f4\u9694\u5185\u6c47\u603b\u68c0\u7d22\u5230\u7684\u503c\uff08\u786e\u4fdd\u670d\u52a1\u5668\u652f\u6301\u8be5\u6c47\u603b\uff09\u3002"]}),"\n",(0,o.jsxs)(e.li,{children:[(0,o.jsx)(e.strong,{children:"\u91cd\u91c7\u6837"}),"\uff1a\u5f53\u6c47\u603b\u4e0d\u540c\u4e8e",(0,o.jsx)(e.code,{children:"Raw"}),"\u65f6\uff0c\u53ef\u4ee5\u5728\u8bf7\u6c42\u7684\u95f4\u9694\u5185\u91cd\u65b0\u91c7\u6837\u68c0\u7d22\u5230\u7684\u503c\u3002"]}),"\n"]}),"\n",(0,o.jsx)(e.admonition,{title:"\u4e0eOPC\u670d\u52a1\u5668\u7684\u517c\u5bb9\u6027",type:"caution",children:(0,o.jsxs)(e.p,{children:["\u91cd\u8981\u7684\u662f\u8981\u6ce8\u610f\uff0c\u5e76\u975e\u6240\u6709\u7684\u805a\u5408\u548c\u91cd\u91c7\u6837\u9009\u9879\u90fd\u7531OPC\u670d\u52a1\u5668\u652f\u6301\u3002\u4e3a\u907f\u514d\u517c\u5bb9\u6027\u95ee\u9898\uff0c\u5efa\u8bae\u5c3d\u53ef\u80fd\u4f7f\u7528",(0,o.jsx)(e.code,{children:"Raw"}),"\u805a\u5408\u548c",(0,o.jsx)(e.code,{children:"None"}),"\u91cd\u91c7\u6837\u3002"]})}),"\n",(0,o.jsxs)(e.p,{children:["\u9879\u76ee\u7684\u540d\u79f0\u5c06\u4f5c\u4e3aJSON\u6709\u6548\u8d1f\u8f7d\u4e2d\u7684\u53c2\u8003\uff0c\u7279\u522b\u662f\u5728\u5317\u5411\u5e94\u7528\u7684",(0,o.jsx)(e.code,{children:"pointID"}),"\u5b57\u6bb5\u4e2d\u3002"]})]})}function u(n={}){const{wrapper:e}={...(0,r.R)(),...n.components};return e?(0,o.jsx)(e,{...n,children:(0,o.jsx)(h,{...n})}):h(n)}},8453:(n,e,s)=>{s.d(e,{R:()=>t,x:()=>c});var i=s(6540);const o={},r=i.createContext(o);function t(n){const e=i.useContext(r);return i.useMemo((function(){return"function"==typeof n?n(e):{...e,...n}}),[e,n])}function c(n){let e;return e=n.disableParentContext?"function"==typeof n.components?n.components(o):n.components||o:t(n.components),i.createElement(r.Provider,{value:e},n.children)}}}]);