"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[2408],{3928:(e,s,t)=>{t.r(s),t.d(s,{assets:()=>c,contentTitle:()=>r,default:()=>l,frontMatter:()=>o,metadata:()=>a,toc:()=>d});var i=t(4848),n=t(8453);const o={sidebar_position:1},r="OIBus security",a={id:"guide/advanced/oibus-security",title:"OIBus security",description:"OIBus is usually installed on a dedicated machine (which can be a virtual machine) located at the customer site. The",source:"@site/versioned_docs/version-v2/guide/advanced/oibus-security.md",sourceDirName:"guide/advanced",slug:"/guide/advanced/oibus-security",permalink:"/zh/docs/v2/guide/advanced/oibus-security",draft:!1,unlisted:!1,tags:[],version:"v2",sidebarPosition:1,frontMatter:{sidebar_position:1},sidebar:"guideSidebar",previous:{title:"Advanced",permalink:"/zh/docs/v2/category/advanced"},next:{title:"OIBus to OIBus communication",permalink:"/zh/docs/v2/guide/advanced/oibus-to-oibus"}},c={},d=[{value:"Access to the OIBus machine",id:"access-to-the-oibus-machine",level:2},{value:"Access to the OIBus administration interface",id:"access-to-the-oibus-administration-interface",level:2},{value:"Forgotten password",id:"forgotten-password",level:2},{value:"HTTP protocol and Basic Auth",id:"http-protocol-and-basic-auth",level:2},{value:"Protection of passwords and secrets in the configuration file",id:"protection-of-passwords-and-secrets-in-the-configuration-file",level:2}];function h(e){const s={a:"a",code:"code",em:"em",h1:"h1",h2:"h2",header:"header",li:"li",p:"p",strong:"strong",ul:"ul",...(0,n.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(s.header,{children:(0,i.jsx)(s.h1,{id:"oibus-security",children:"OIBus security"})}),"\n",(0,i.jsx)(s.p,{children:"OIBus is usually installed on a dedicated machine (which can be a virtual machine) located at the customer site. The\nOIBus behavior is fully managed by the OIBus configuration file (oibus.json). It is important to consider several\naspects to protect OIBus:"}),"\n",(0,i.jsxs)(s.ul,{children:["\n",(0,i.jsx)(s.li,{children:"Access to the machine"}),"\n",(0,i.jsx)(s.li,{children:"Access to the OIBus administration interface"}),"\n",(0,i.jsx)(s.li,{children:"Protection of passwords, secret keys, etc\u2026"}),"\n"]}),"\n",(0,i.jsx)(s.h2,{id:"access-to-the-oibus-machine",children:"Access to the OIBus machine"}),"\n",(0,i.jsx)(s.p,{children:"Of course, local or remote access (using RDP - Remote Desktop Protocol - or disk sharing for example) to the machine\nwhere OIBus is installed is a risk to consider. Indeed, a local user could delete OIBus files or directly modify the\nconfiguration file."}),"\n",(0,i.jsx)(s.p,{children:"It is important to limit access to the OIBus machine so that no one can access it except the OIBus administrator."}),"\n",(0,i.jsx)(s.h2,{id:"access-to-the-oibus-administration-interface",children:"Access to the OIBus administration interface"}),"\n",(0,i.jsxs)(s.p,{children:["The OIBus administration interface is web-based and can be launched locally or from any remote PC with a\nweb browser. We recommend to use the interface using the local URL ",(0,i.jsx)(s.code,{children:"http://localhost:2223"}),"."]}),"\n",(0,i.jsxs)(s.p,{children:["To use it from a remote PC, you must configure the ",(0,i.jsx)(s.a,{href:"/zh/docs/v2/guide/engine/access#ip-filters",children:"IP Filters"})," section of the OIBus\nEngine."]}),"\n",(0,i.jsxs)(s.p,{children:["Access to the administration interface requires a user/password. The default username is ",(0,i.jsx)(s.strong,{children:"admin"}),". The default\npassword is ",(0,i.jsx)(s.strong,{children:"pass"}),"."]}),"\n",(0,i.jsx)(s.p,{children:"Changing the default password is strongly recommended."}),"\n",(0,i.jsx)(s.h2,{id:"forgotten-password",children:"Forgotten password"}),"\n",(0,i.jsxs)(s.p,{children:["The administrator with access to the OIBus configuration file (",(0,i.jsx)(s.code,{children:"oibus.json"}),")can use a text editor to delete the\n",(0,i.jsx)(s.em,{children:"password"})," value in the ",(0,i.jsx)(s.em,{children:"Engine"})," section of the OIBus configuration file. The password will then be restored to its\ndefault value ",(0,i.jsx)(s.strong,{children:"pass"}),"."]}),"\n",(0,i.jsx)(s.h2,{id:"http-protocol-and-basic-auth",children:"HTTP protocol and Basic Auth"}),"\n",(0,i.jsxs)(s.p,{children:["OIBus uses the Basic Auth method in addition to the HTTP protocol supported by most web browsers. This method\n",(0,i.jsx)(s.strong,{children:"does not provide any privacy protection"})," for the transmitted credentials sent in the header at each HTTP request."]}),"\n",(0,i.jsxs)(s.p,{children:["The ",(0,i.jsx)(s.strong,{children:"filters"})," in the OIBus Engine can mitigate this risk by limiting the IP addresses allowed, but this is not a 100%\nguaranteed protection as impersonating another computer system with a fake IP address is not difficult for hackers.\nIn addition, the privacy of the network over which the HTTP request is passing through must be respected to be sure\nthat the credentials will not leak."]}),"\n",(0,i.jsx)(s.p,{children:"Therefore, remote access to the OIBus administration interface should be limited to within the customer\u2019s LAN and\nshould not be accessible over the Internet. The use of a VPN is strongly advised."}),"\n",(0,i.jsx)(s.h2,{id:"protection-of-passwords-and-secrets-in-the-configuration-file",children:"Protection of passwords and secrets in the configuration file"}),"\n",(0,i.jsx)(s.p,{children:"OIBus needs to access multiple sources of information (Histories, DCS, LIMS, MES, Databases, etc.). Many of these\nsources require a username/password pair or a secret key to grant access."}),"\n",(0,i.jsxs)(s.p,{children:["This information is also stored in the OIBus configuration file (",(0,i.jsx)(s.code,{children:"oibus.json"}),"), but it is all encrypted. This adds a\nlevel of protection that prevents anyone from reading this information unencrypted."]}),"\n",(0,i.jsx)(s.p,{children:"This encryption uses public/private keys stored in the OIBus cache folder. These keys are created automatically at each\nstartup if they do not already exist."}),"\n",(0,i.jsxs)(s.p,{children:["If these keys are deleted, it will be impossible for OIBus to decrypt the passwords or secret keys. A new key pair will\nbe generated when OIBus is restarted. In this case it will be necessary to use the administration interface and\nre-enter all passwords, including the admin password. If the administration interface is not accessible anymore because\nthe keys have changed, use the ",(0,i.jsx)(s.a,{href:"#forgotten-password",children:"forgotten password procedure"})," to access it again and change every\npassword and secrets."]})]})}function l(e={}){const{wrapper:s}={...(0,n.R)(),...e.components};return s?(0,i.jsx)(s,{...e,children:(0,i.jsx)(h,{...e})}):h(e)}},8453:(e,s,t)=>{t.d(s,{R:()=>r,x:()=>a});var i=t(6540);const n={},o=i.createContext(n);function r(e){const s=i.useContext(o);return i.useMemo((function(){return"function"==typeof e?e(s):{...s,...e}}),[s,e])}function a(e){let s;return s=e.disableParentContext?"function"==typeof e.components?e.components(n):e.components||n:r(e.components),i.createElement(o.Provider,{value:s},e.children)}}}]);