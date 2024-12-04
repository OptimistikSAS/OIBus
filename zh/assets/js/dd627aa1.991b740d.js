"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[5153],{2105:(n,e,s)=>{s.r(e),s.d(e,{assets:()=>l,contentTitle:()=>c,default:()=>a,frontMatter:()=>t,metadata:()=>d,toc:()=>o});var i=s(4848),r=s(8453);const t={sidebar_position:9},c="ADS - TwinCAT",d={id:"guide/south-connectors/ads",title:"ADS - TwinCAT",description:"\u81ea\u52a8\u5316\u8bbe\u5907\u89c4\u8303\uff08ADS\uff09\u534f\u8bae\u4f5c\u4e3a\u96c6\u6210\u5230TwinCAT\u7cfb\u7edf\u4e2d\u7684\u4f20\u8f93\u5c42\uff0c\u7531Beckhoff\u8bbe\u8ba1\u5e76\u5f00\u53d1\u3002",source:"@site/i18n/zh/docusaurus-plugin-content-docs/current/guide/south-connectors/ads.md",sourceDirName:"guide/south-connectors",slug:"/guide/south-connectors/ads",permalink:"/zh/docs/guide/south-connectors/ads",draft:!1,unlisted:!1,tags:[],version:"current",sidebarPosition:9,frontMatter:{sidebar_position:9},sidebar:"guideSidebar",previous:{title:"PostgreSQL",permalink:"/zh/docs/guide/south-connectors/postgresql"},next:{title:"MySQL / MariaDB",permalink:"/zh/docs/guide/south-connectors/mysql"}},l={},o=[{value:"\u7279\u5b9a\u8bbe\u7f6e",id:"\u7279\u5b9a\u8bbe\u7f6e",level:2},{value:"\u4e0e\u672c\u5730AMS\u670d\u52a1\u5668\uff08TwinCAT\u8fd0\u884c\u65f6\uff09",id:"\u4e0e\u672c\u5730ams\u670d\u52a1\u5668twincat\u8fd0\u884c\u65f6",level:3},{value:"\u4e0e\u8fdc\u7a0bAMS\u670d\u52a1\u5668",id:"\u4e0e\u8fdc\u7a0bams\u670d\u52a1\u5668",level:3},{value:"\u5176\u4ed6\u7279\u5b9a\u8bbe\u7f6e",id:"\u5176\u4ed6\u7279\u5b9a\u8bbe\u7f6e",level:3},{value:"\u7ed3\u6784\u8fc7\u6ee4",id:"\u7ed3\u6784\u8fc7\u6ee4",level:4},{value:"\u9879\u76ee\u8bbe\u7f6e",id:"\u9879\u76ee\u8bbe\u7f6e",level:2}];function h(n){const e={a:"a",admonition:"admonition",code:"code",em:"em",h1:"h1",h2:"h2",h3:"h3",h4:"h4",img:"img",li:"li",p:"p",strong:"strong",ul:"ul",...(0,r.R)(),...n.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(e.h1,{id:"ads---twincat",children:"ADS - TwinCAT"}),"\n",(0,i.jsx)(e.p,{children:"\u81ea\u52a8\u5316\u8bbe\u5907\u89c4\u8303\uff08ADS\uff09\u534f\u8bae\u4f5c\u4e3a\u96c6\u6210\u5230TwinCAT\u7cfb\u7edf\u4e2d\u7684\u4f20\u8f93\u5c42\uff0c\u7531Beckhoff\u8bbe\u8ba1\u5e76\u5f00\u53d1\u3002"}),"\n",(0,i.jsx)(e.p,{children:"\u63a7\u5236\u5668\u4e2d\u7684\u6bcf\u4e2a\u6570\u636e\u9879\u90fd\u6709\u4e00\u4e2a\u72ec\u7279\u7684\u5730\u5740\uff0c\u53ef\u4ee5\u901a\u8fc7OIBus\u4e0a\u7684ADS\u8fde\u63a5\u5668\u65b9\u4fbf\u5730\u8bbf\u95ee\u3002"}),"\n",(0,i.jsxs)(e.p,{children:["OIBus\u4f7f\u7528",(0,i.jsx)(e.a,{href:"https://github.com/jisotalo/ads-client",children:"ads-client"}),"\u5e93\u6765\u5b9e\u73b0\u8fd9\u4e00\u76ee\u7684\u3002"]}),"\n",(0,i.jsx)(e.h2,{id:"\u7279\u5b9a\u8bbe\u7f6e",children:"\u7279\u5b9a\u8bbe\u7f6e"}),"\n",(0,i.jsx)(e.p,{children:"OIBus\u4f7f\u7528ADS\u534f\u8bae\u8fde\u63a5\u5230AMS\u8def\u7531\u5668\u3002AMS\u8def\u7531\u5668\u4f5c\u4e3a\u4e2d\u4ecb\uff0c\u5c06\u8bf8\u5982OIBus\u4e4b\u7c7b\u7684ADS\u5ba2\u6237\u7aef\u8fde\u63a5\u5230PLC\u548cTwinCAT\u8fd0\u884c\u65f6\u3002\u8fd9\u79cd\u8fde\u63a5\u6027\u4f7fOIBus\u80fd\u591f\u8bbf\u95eePLC\u4e2d\u7684\u6570\u636e\u3002"}),"\n",(0,i.jsx)(e.p,{children:"\u5177\u4f53\u7684\u914d\u7f6e\u53ef\u80fd\u6027\u53d6\u51b3\u4e8eAMS\u8def\u7531\u5668\u7684\u653e\u7f6e\u548c\u4f4d\u7f6e\u3002"}),"\n",(0,i.jsx)(e.h3,{id:"\u4e0e\u672c\u5730ams\u670d\u52a1\u5668twincat\u8fd0\u884c\u65f6",children:"\u4e0e\u672c\u5730AMS\u670d\u52a1\u5668\uff08TwinCAT\u8fd0\u884c\u65f6\uff09"}),"\n",(0,i.jsxs)(e.p,{children:["\u5f53TwinCAT\u5b89\u88c5\u5728\u4e0eOIBus\u76f8\u540c\u7684\u673a\u5668\u548c\u7f51\u7edc\u4e0a\u65f6\uff0cADS\u8fde\u63a5\u5668\u80fd\u591f\u5229\u7528TwinCAT\u8fd0\u884c\u65f6\uff0c\u4f7f\u7528\u5176",(0,i.jsx)(e.strong,{children:"Net ID"}),"\u548c",(0,i.jsx)(e.strong,{children:"PLC Port"}),"\u4e0ePLC\u76f4\u63a5\u901a\u4fe1\uff08\u65e0\u9700\u6307\u5b9a\u8def\u7531\u5668\u5730\u5740\u3001\u8def\u7531\u5668TCP\u7aef\u53e3\u3001\u5ba2\u6237\u7aefAMS Net ID\u3001\u5ba2\u6237\u7aefADS\u7aef\u53e3\uff09\u3002"]}),"\n",(0,i.jsxs)(e.p,{children:["Net ID\u662f\u4e00\u4e2a\u7c7b\u4f3cIP\u5730\u5740\u52a0\u4e0a\u4e24\u4e2a\u989d\u5916\u6570\u5b57\u503c\u7684\u5730\u5740\u3002\u901a\u5e38\uff0cNet ID\u5bf9\u5e94\u4e8e\u7f51\u7edc\u4e2d\u7528\u6765\u8bbf\u95eePLC\u7684IP\u5730\u5740\uff0c\u5e76\u589e\u52a0\u4e24\u4e2a\u9644\u52a0\u6570\u5b57\uff0c\u4ee5\u533a\u5206\u53ef\u901a\u8fc7\u5355\u4e2aAMS\u8def\u7531\u5668\u8bbf\u95ee\u7684\u591a\u4e2aPLC\u3002\u4f8b\u5982\uff0c\u4e00\u4e2a\u793a\u4f8bNet ID\u53ef\u80fd\u770b\u8d77\u6765\u50cf\u662f",(0,i.jsx)(e.code,{children:"127.0.0.1.1.1"}),"\u3002"]}),"\n",(0,i.jsx)(e.p,{children:"\u7aef\u53e3\u6307\u5b9a\u4e86AMS\u8def\u7531\u5668\u4e2d\u7528\u4e8e\u4e0ePLC\u8fde\u63a5\u7684\u901a\u4fe1\u7ec8\u7aef\uff0c\u9ed8\u8ba4\u8bbe\u7f6e\u4e3a851\u3002"}),"\n",(0,i.jsx)(e.h3,{id:"\u4e0e\u8fdc\u7a0bams\u670d\u52a1\u5668",children:"\u4e0e\u8fdc\u7a0bAMS\u670d\u52a1\u5668"}),"\n",(0,i.jsxs)(e.p,{children:["\u8fde\u63a5\u5230\u8fdc\u7a0bAMS\u670d\u52a1\u5668\u65f6\uff0c\u60a8\u9700\u8981",(0,i.jsx)(e.strong,{children:"Net ID"}),"\u548c",(0,i.jsx)(e.strong,{children:"PLC Port"}),"\u4ee5\u53ca\u51e0\u4e2a\u9644\u52a0\u5b57\u6bb5\uff1a"]}),"\n",(0,i.jsxs)(e.ul,{children:["\n",(0,i.jsxs)(e.li,{children:[(0,i.jsx)(e.strong,{children:"\u8def\u7531\u5668\u5730\u5740"}),"\uff1a\u8fd9\u662fAMS\u8def\u7531\u5668\u7684IP\u5730\u5740\u6216\u57df\u540d\u3002"]}),"\n",(0,i.jsxs)(e.li,{children:[(0,i.jsx)(e.strong,{children:"\u8def\u7531\u5668TCP\u7aef\u53e3"}),"\uff1aAMS\u8def\u7531\u5668\u7528\u4e8e\u901a\u4fe1\u7684\u7aef\u53e3\u3002\u786e\u4fdd\u6b64\u7aef\u53e3\u5f97\u5230\u7f51\u7edc\u548c\u64cd\u4f5c\u7cfb\u7edf\u9632\u706b\u5899\u7684\u5141\u8bb8\u3002"]}),"\n",(0,i.jsxs)(e.li,{children:[(0,i.jsx)(e.strong,{children:"AMS Net ID"}),"\uff1a\u8fd9\u662f\u7528\u4e8e\u4e0eTwinCAT\u8fd0\u884c\u65f6\u5efa\u7acb\u8fde\u63a5\u7684\u5ba2\u6237\u7aef\u6807\u8bc6\u7b26\u3002"]}),"\n",(0,i.jsxs)(e.li,{children:[(0,i.jsx)(e.strong,{children:"ADS\u5ba2\u6237\u7aef\u7aef\u53e3"}),"\uff08\u53ef\u9009\uff09\uff1a\u60a8\u53ef\u4ee5\u6307\u5b9a\u5ba2\u6237\u7aef\u7528\u4e8e\u6570\u636e\u4ea4\u6362\u7684\u7aef\u53e3\u3002\u5982\u679c\u7559\u7a7a\uff0cAMS\u670d\u52a1\u5668\u5c06\u5206\u914d\u4e00\u4e2a\u968f\u673a\u7aef\u53e3\u3002\u5982\u679c\u60a8\u9009\u62e9\u6307\u5b9a\u7aef\u53e3\uff0c\u8bf7\u786e\u4fdd\u5b83\u4e0d\u662f\u5df2\u88ab\u5176\u4ed6\u5ba2\u6237\u7aef\u4f7f\u7528\u7684\u7aef\u53e3\u3002"]}),"\n"]}),"\n",(0,i.jsxs)(e.p,{children:["\u8981\u542f\u7528ADS\u8fde\u63a5\u5668\u4e0eTwinCAT\u8fd0\u884c\u65f6\u4e4b\u95f4\u7684\u901a\u4fe1\uff0c\u60a8\u5fc5\u987b\u4f7f\u7528_TwinCAT\u9759\u6001\u8def\u7531_\u5de5\u5177\u914d\u7f6e\u9759\u6001\u8def\u7531\u3002\u4ee5\u4e0b\u793a\u4f8b\u5c55\u793a\u4e86\u5982\u4f55\u4f7f\u7528",(0,i.jsx)(e.strong,{children:"AMS Net ID"}),"\u914d\u7f6e\u4e24\u6761\u8def\u7531\uff0c\u5b83\u5e94\u5728OIBus\u65b9\u4f7f\u7528\u3002\u5173\u952e\u7684\u662f\uff0c",(0,i.jsx)(e.strong,{children:"AMS Net ID"}),"\u5728\u4e0e\u9759\u6001\u8def\u7531\u4e2d\u6307\u5b9a\u7684IP\u5730\u5740\u4e00\u8d77\u4f7f\u7528\u65f6\u624d\u6709\u6548\u3002"]}),"\n",(0,i.jsx)(e.p,{children:(0,i.jsx)(e.img,{alt:"TwinCAT Static Routes tool",src:s(2278).A+"",width:"908",height:"492"})}),"\n",(0,i.jsx)(e.p,{children:(0,i.jsx)(e.img,{alt:"Add a TwinCAT Static Route",src:s(9701).A+"",width:"640",height:"485"})}),"\n",(0,i.jsxs)(e.p,{children:["\u6307\u5b9a\u7684AMSNetId\u5fc5\u987b\u586b\u5199\u5728OIBus\u914d\u7f6e\u7684",(0,i.jsx)(e.strong,{children:"AMS Net ID"}),"\u5b57\u6bb5\u4e2d\u3002"]}),"\n",(0,i.jsx)(e.admonition,{title:"\u591a\u4e2aADS\u8fde\u63a5\u5668",type:"danger",children:(0,i.jsx)(e.p,{children:"OIBus\u4e00\u6b21\u53ea\u652f\u6301\u4e00\u4e2a\u8fdc\u7a0bADS\u8fde\u63a5\u5668\u3002\u5982\u679c\u60a8\u9700\u8981\u540c\u65f6\u8fde\u63a5\u5230\u4e24\u4e2a\u4e0d\u540c\u7684PLC\uff0c\u5219\u53ef\u4ee5\u901a\u8fc7\u4f7f\u7528\u672c\u5730AMS\u670d\u52a1\u5668\u6765\u5b9e\u73b0\u3002"})}),"\n",(0,i.jsx)(e.h3,{id:"\u5176\u4ed6\u7279\u5b9a\u8bbe\u7f6e",children:"\u5176\u4ed6\u7279\u5b9a\u8bbe\u7f6e"}),"\n",(0,i.jsx)(e.p,{children:"\u8fd9\u91cc\u8fd8\u6709\u4e00\u4e9b\u989d\u5916\u7684\u914d\u7f6e\u9009\u9879\uff1a"}),"\n",(0,i.jsxs)(e.ul,{children:["\n",(0,i.jsxs)(e.li,{children:[(0,i.jsx)(e.strong,{children:"\u91cd\u8bd5\u95f4\u9694"}),"\uff1a\u5c1d\u8bd5\u91cd\u8fde\u524d\u7684\u7b49\u5f85\u65f6\u95f4\u3002"]}),"\n",(0,i.jsxs)(e.li,{children:[(0,i.jsx)(e.strong,{children:"PLC\u540d\u79f0"}),"\uff1a\u60a8\u53ef\u4ee5\u6307\u5b9a\u4e00\u4e2a\u6dfb\u52a0\u5230\u6bcf\u4e2a\u9879\u76ee\u540d\u79f0\u524d\u7684\u524d\u7f00\uff0c\u7136\u540e\u5b83\u4eec\u4f1a\u88ab\u53d1\u9001\u5230\u5317\u5411\u7f13\u5b58\u4e2d\u3002\u4f8b\u5982\uff0c\u4ee5PLC\u540d\u79f0\u4e3a",(0,i.jsx)(e.code,{children:"PLC001. "}),"\uff08\u5305\u62ec\u70b9\uff09\uff0c\u4e00\u4e2a\u9879\u76ee\u540d\u79f0\u4e3a",(0,i.jsx)(e.code,{children:"MyVariable.Value"}),"\uff0c\u4e00\u65e6\u68c0\u7d22\u5230\u503c\uff0c\u6700\u7ec8\u7684\u540d\u79f0\u5c06\u662f",(0,i.jsx)(e.code,{children:"PLC001.MyVariable.Value"}),"\u3002\u8fd9\u6709\u52a9\u4e8e\u533a\u5206\u6765\u81ea\u4e0d\u540cPLC\u7684\u6570\u636e\u3002\u53e6\u4e00\u4e2aPLC\u7684\u7ed3\u679c\u9879\u76ee\u540d\u79f0\u53ef\u80fd\u7c7b\u4f3c",(0,i.jsx)(e.code,{children:"PLC002.MyVariable.Value"}),"\u3002"]}),"\n",(0,i.jsxs)(e.li,{children:[(0,i.jsx)(e.strong,{children:"\u679a\u4e3e\u503c"}),"\uff1a\u60a8\u53ef\u4ee5\u9009\u62e9\u5c06\u679a\u4e3e\u5e8f\u5217\u5316\u4e3a\u6574\u6570\u8fd8\u662f\u6587\u672c\u3002"]}),"\n",(0,i.jsxs)(e.li,{children:[(0,i.jsx)(e.strong,{children:"\u5e03\u5c14\u503c"}),"\uff1a\u60a8\u53ef\u4ee5\u9009\u62e9\u5c06\u5e03\u5c14\u503c\u5e8f\u5217\u5316\u4e3a\u6574\u6570\u8fd8\u662f\u6587\u672c\u3002"]}),"\n",(0,i.jsxs)(e.li,{children:[(0,i.jsx)(e.strong,{children:"\u7ed3\u6784\u8fc7\u6ee4"}),"\uff1a\u6709\u5173\u7ed3\u6784\u8fc7\u6ee4\u7684\u8be6\u7ec6\u4fe1\u606f\uff0c\u8bf7\u53c2\u9605",(0,i.jsx)(e.a,{href:"#%E7%BB%93%E6%9E%84%E8%BF%87%E6%BB%A4",children:"\u7279\u5b9a\u6587\u6863"}),"\u3002"]}),"\n"]}),"\n",(0,i.jsxs)(e.admonition,{title:"\u4f55\u65f6\u4f7f\u7528PLC\u540d\u79f0\uff1f",type:"tip",children:[(0,i.jsx)(e.p,{children:"\u5728\u901a\u8fc7\u4e24\u4e2a\u4e0d\u540c\u7684ADS\u8fde\u63a5\u5668\u68c0\u7d22\u5177\u6709\u5171\u4eab\u70b9\u5730\u5740\u6a21\u5f0f\u7684\u7c7b\u4f3cPLC\u7684\u6570\u636e\u5e76\u5c06\u5176\u53d1\u9001\u5230\u540c\u4e00\u4e2a\u5317\u5411\u8fde\u63a5\u5668\u7684\u60c5\u51b5\u4e0b\uff0c\u5373\u4f7f\u6570\u636e\u6765\u81ea\u4e0d\u540c\u7684PLC\uff0c\u6700\u7ec8\u7684\u503c\u53ef\u80fd\u5177\u6709\u76f8\u540c\u7684\u70b9ID\u3002"}),(0,i.jsxs)(e.p,{children:["\u4e3a\u4e86\u6d88\u9664\u8fd9\u79cd\u6f5c\u5728\u7684\u6b67\u4e49\uff0c\u60a8\u53ef\u4ee5\u9009\u62e9\u5728\u6570\u636e\u68c0\u7d22\u540e\u5728\u6bcf\u4e2a\u70b9ID\u524d\u9644\u52a0",(0,i.jsx)(e.strong,{children:"PLC\u540d\u79f0"}),"\u3002\u8fd9\u79cd\u505a\u6cd5\u786e\u4fdd\u53d1\u9001\u5230\u5317\u5411\u8fde\u63a5\u5668\u7684\u70b9ID\u4fdd\u6301\u4e0d\u540c\uff0c\u5f53\u5bfc\u51fa\u8fd9\u4e9b\u9879\u76ee\u4ee5\u5bfc\u5165\u5230\u53e6\u4e00\u4e2aOIBus\u4e2d\u65f6\u7279\u522b\u6709\u7528\u3002"]}),(0,i.jsx)(e.p,{children:"\u901a\u8fc7\u7b80\u5355\u5730\u66f4\u6539PLC\u540d\u79f0\uff0c\u60a8\u53ef\u4ee5\u786e\u4fdd\u60a8\u7684\u6570\u636e\u5728\u5317\u5411\u76ee\u6807\u5e94\u7528\u7a0b\u5e8f\u4e2d\u4fdd\u6301\u552f\u4e00\u3002"})]}),"\n",(0,i.jsx)(e.h4,{id:"\u7ed3\u6784\u8fc7\u6ee4",children:"\u7ed3\u6784\u8fc7\u6ee4"}),"\n",(0,i.jsxs)(e.p,{children:["\u60a8\u8fd8\u53ef\u4ee5\u4f7f\u7528\u6b64\u65b9\u5f0f\u68c0\u7d22\u6574\u4e2a\u6570\u636e\u7ed3\u6784\u3002\u4f8b\u5982\uff0c\u5982\u679c\u6570\u636e_MyVariable_\u662f_MyStructure_\u7c7b\u578b\uff0c\u5e76\u5305\u542b\u8bf8\u5982_MyDate_\u3001",(0,i.jsx)(e.em,{children:"MyNumber"})," \u548c ",(0,i.jsx)(e.em,{children:"Value"})," \u7b49\u5b57\u6bb5\uff0c\u4f46\u60a8\u53ea\u9700\u8981_MyDate_\u548c_MyNumber_\uff0c\u60a8\u53ef\u4ee5\u5728_structure filtering_\u90e8\u5206\u521b\u5efa\u4e00\u4e2a\u65b0\u7684\u7ed3\u6784\uff0c\u5176",(0,i.jsx)(e.strong,{children:"\u7ed3\u6784\u540d\u79f0"}),"\u662f",(0,i.jsx)(e.code,{children:"MyStructure"}),"\u3002\n\u5728",(0,i.jsx)(e.strong,{children:"\u8981\u4fdd\u7559\u7684\u5b57\u6bb5"}),"\u90e8\u5206\uff0c\u60a8\u53ef\u4ee5\u6307\u5b9a\u53ea\u9700\u8981\u7684\u5b57\u6bb5\uff0c\u7528\u9017\u53f7\u5206\u9694\uff0c\u4f8b\u5982",(0,i.jsx)(e.code,{children:"MyDate, MyNumber"}),"\u3002"]}),"\n",(0,i.jsx)(e.p,{children:"\u5f53\u9762\u5bf9\u591a\u4e2a\u6570\u636e\u9879\u5168\u90e8\u4e3a_MyStructure_\u7c7b\u578b\u65f6\uff0c\u6b64\u529f\u80fd\u7279\u522b\u6709\u7528\uff0c\u4f46\u60a8\u53ea\u5bf9\u4ece\u7ed3\u6784\u4e2d\u68c0\u7d22\u7279\u5b9a\u5b57\u6bb5\uff0c\u8bf8\u5982_MyDate_\u548c_MyNumber_\u611f\u5174\u8da3\u3002\u7ed3\u6784\u542b\u6709\u7684\u5b57\u6bb5\u8d8a\u591a\uff0c\u6b64\u529f\u80fd\u7684\u4f18\u52bf\u8d8a\u5927\u3002"}),"\n",(0,i.jsx)(e.p,{children:"\u6700\u7ec8\uff0c\u6307\u5b9a\u7684\u6bcf\u4e2a\u5b57\u6bb5\u90fd\u4f1a\u4ea7\u751f\u4e00\u4e2a\u72ec\u7279\u7684\u70b9ID\u3002\u5728\u63d0\u4f9b\u7684\u793a\u4f8b\u4e2d\uff0c\u4f7f\u7528\u6b64\u65b9\u6cd5\u5bf9\u5355\u4e2a\u70b9_MyVariable_\u4f1a\u5bfc\u81f4\u4e24\u4e2a\u4e0d\u540c\u7684\u70b9\uff1a"}),"\n",(0,i.jsxs)(e.ul,{children:["\n",(0,i.jsx)(e.li,{children:"MyVariable.MyDate"}),"\n",(0,i.jsx)(e.li,{children:"MyVariable.MyNumber"}),"\n"]}),"\n",(0,i.jsx)(e.h2,{id:"\u9879\u76ee\u8bbe\u7f6e",children:"\u9879\u76ee\u8bbe\u7f6e"}),"\n",(0,i.jsxs)(e.ul,{children:["\n",(0,i.jsxs)(e.li,{children:[(0,i.jsx)(e.strong,{children:"\u5730\u5740"}),"\uff1aPLC\u4e2d\u8981\u67e5\u8be2\u7684\u6570\u636e\u7684\u5730\u5740\u3002"]}),"\n"]})]})}function a(n={}){const{wrapper:e}={...(0,r.R)(),...n.components};return e?(0,i.jsx)(e,{...n,children:(0,i.jsx)(h,{...n})}):h(n)}},2278:(n,e,s)=>{s.d(e,{A:()=>i});const i=s.p+"assets/images/installation-ads-distant-7d043b9c61a135e76dc689cfa7df7017.png"},9701:(n,e,s)=>{s.d(e,{A:()=>i});const i=s.p+"assets/images/routes-9e5abc66ee07da3d17541566a90470c4.png"},8453:(n,e,s)=>{s.d(e,{R:()=>c,x:()=>d});var i=s(6540);const r={},t=i.createContext(r);function c(n){const e=i.useContext(t);return i.useMemo((function(){return"function"==typeof n?n(e):{...e,...n}}),[e,n])}function d(n){let e;return e=n.disableParentContext?"function"==typeof n.components?n.components(r):n.components||r:c(n.components),i.createElement(t.Provider,{value:e},n.children)}}}]);