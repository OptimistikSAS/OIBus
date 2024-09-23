"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[1677],{6375:(e,n,i)=>{i.r(n),i.d(n,{assets:()=>c,contentTitle:()=>o,default:()=>h,frontMatter:()=>a,metadata:()=>r,toc:()=>d});var t=i(4848),s=i(8453);const a={sidebar_position:4},o="OPCHDA COM/DCOM setup",r={id:"guide/advanced/opchda-dcom",title:"OPCHDA COM/DCOM setup",description:"Background",source:"@site/versioned_docs/version-v2/guide/advanced/opchda-dcom.md",sourceDirName:"guide/advanced",slug:"/guide/advanced/opchda-dcom",permalink:"/docs/v2/guide/advanced/opchda-dcom",draft:!1,unlisted:!1,tags:[],version:"v2",sidebarPosition:4,frontMatter:{sidebar_position:4},sidebar:"guideSidebar",previous:{title:"Data rate estimation and cache sizing",permalink:"/docs/v2/guide/advanced/oibus-data-rate"},next:{title:"OPCHDA agent",permalink:"/docs/v2/guide/advanced/opchda-agent"}},c={},d=[{value:"Background",id:"background",level:2},{value:"COM",id:"com",level:3},{value:"DCOM",id:"dcom",level:3},{value:"Windows settings (client)",id:"windows-settings-client",level:2},{value:"Client machine settings",id:"client-machine-settings",level:3},{value:"Test communication",id:"test-communication",level:3},{value:"Authentication",id:"authentication",level:3},{value:"Firewall configuration",id:"firewall-configuration",level:3},{value:"OPCEnum tool",id:"opcenum-tool",level:3},{value:"RPC unavailable",id:"rpc-unavailable",level:4},{value:"Access denied",id:"access-denied",level:4},{value:"Server settings",id:"server-settings",level:2}];function l(e){const n={a:"a",admonition:"admonition",code:"code",em:"em",h1:"h1",h2:"h2",h3:"h3",h4:"h4",img:"img",li:"li",p:"p",ul:"ul",...(0,s.R)(),...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:"opchda-comdcom-setup",children:"OPCHDA COM/DCOM setup"}),"\n",(0,t.jsx)(n.h2,{id:"background",children:"Background"}),"\n",(0,t.jsx)(n.h3,{id:"com",children:"COM"}),"\n",(0,t.jsx)(n.p,{children:"COM is the standard protocol for communication between objects located on the same computer but which are part of\ndifferent programs. The server is the object providing services, such as making data available. The client is an\napplication that uses the services provided by the server."}),"\n",(0,t.jsx)(n.h3,{id:"dcom",children:"DCOM"}),"\n",(0,t.jsx)(n.p,{children:"DCOM represents an expansion of COM functionality to allow access to objects on remote computers. This protocol allows\nstandardized data exchange between applications from industry, administrative offices and manufacturing. Previously, the\napplications that accessed the process data were tied to the access protocols of the communication network. The OPC\nstandard software interface allows devices and applications from different manufacturers to be combined in a uniform way."}),"\n",(0,t.jsx)(n.p,{children:"The OPC client is an application that accesses process data, messages, and archives of an OPC server. Access is through\nthe OPC software interface. An OPC server is a program that provides standard software interface to read or write data.\nThe OPC server is the intermediate layer between the applications for handling process data, the various network\nprotocols and the interfaces for accessing these data. Only devices with operating systems based on Windows COM and\nDCOM technology can use the OPC software interface for data exchange."}),"\n",(0,t.jsx)(n.admonition,{title:"DCOM connectivity",type:"info",children:(0,t.jsx)(n.p,{children:"This page gives some hints on how to set up a communication with COM/DCOM to an OPCHDA server. However, in industrial\ncontext, it is often the responsibility of the IT team to correctly set the permissions, firewall and Windows\nconfiguration."})}),"\n",(0,t.jsx)(n.h2,{id:"windows-settings-client",children:"Windows settings (client)"}),"\n",(0,t.jsx)(n.h3,{id:"client-machine-settings",children:"Client machine settings"}),"\n",(0,t.jsxs)(n.p,{children:["Follow these steps to enable COM/DCOM communications from the client. First, open the Component services, and access the\n",(0,t.jsx)(n.em,{children:"Properties"})," of the computer."]}),"\n",(0,t.jsx)(n.p,{children:(0,t.jsx)(n.img,{alt:"Component Services",src:i(9605).A+"",width:"565",height:"391"})}),"\n",(0,t.jsxs)(n.p,{children:["Be sure to enable ",(0,t.jsx)(n.em,{children:"Distributed COM"})," on this computer."]}),"\n",(0,t.jsx)(n.p,{children:(0,t.jsx)(n.img,{alt:"Computer Properties",src:i(8184).A+"",width:"400",height:"558"})}),"\n",(0,t.jsx)(n.p,{children:"On the COM Security tab, edit default access permissions."}),"\n",(0,t.jsx)(n.p,{children:(0,t.jsx)(n.img,{alt:"COM Security",src:i(1369).A+"",width:"400",height:"558"})}),"\n",(0,t.jsx)(n.p,{children:"On the Access permissions window, allow the following permissions:"}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsx)(n.li,{children:"Local Launch"}),"\n",(0,t.jsx)(n.li,{children:"Remote Launch"}),"\n",(0,t.jsx)(n.li,{children:"Local Activation"}),"\n",(0,t.jsx)(n.li,{children:"Remote Activation"}),"\n"]}),"\n",(0,t.jsx)(n.p,{children:(0,t.jsx)(n.img,{alt:"Access Permissions",src:i(6698).A+"",width:"363",height:"450"})}),"\n",(0,t.jsx)(n.h3,{id:"test-communication",children:"Test communication"}),"\n",(0,t.jsx)(n.p,{children:"DCOM uses port 135 of the HDA server to exchange with the client. To do so, it is interesting to use the tnc command of\nthe Windows Powershell installed as standard. Below, a test that fails (because of the firewall) then a test that\nsucceeds:"}),"\n",(0,t.jsx)(n.p,{children:(0,t.jsx)(n.code,{children:"tnc 35.180.44.30 -port 135"})}),"\n",(0,t.jsx)(n.p,{children:(0,t.jsx)(n.img,{alt:"Test DCOM communication",src:i(7372).A+"",width:"503",height:"299"})}),"\n",(0,t.jsxs)(n.p,{children:["If you have a communication problem, see the ",(0,t.jsx)(n.a,{href:"#firewall-configuration",children:"firewall configuration section"})," which is probably the source of the problem."]}),"\n",(0,t.jsx)(n.h3,{id:"authentication",children:"Authentication"}),"\n",(0,t.jsx)(n.p,{children:"An OPCDA client program will communicate with the DA/HDA server with the IP address or hostname of the server followed\nby the \u201cprogId\u201d of the server. It will then have to be identified at the Windows level with a name and a password which\nare (by default) those of the user who launches the client program. This user must therefore be known on the HDA\nserver as well. You must therefore either:"}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsx)(n.li,{children:"Create a user with the same password on the HDA server (assuming it is accessible)"}),"\n",(0,t.jsx)(n.li,{children:"Be part of the same domain (so the user is accessible from all computers in the domain)"}),"\n"]}),"\n",(0,t.jsx)(n.admonition,{title:"Important",type:"info",children:(0,t.jsxs)(n.p,{children:["The user must be a member of the ",(0,t.jsx)(n.em,{children:"Distributed COM Users"})," group"]})}),"\n",(0,t.jsx)(n.admonition,{title:"Service",type:"tip",children:(0,t.jsxs)(n.p,{children:["If the program runs through a service (such as OIBus), go to the Service manager window, and right-click on the service.\nThen click on ",(0,t.jsx)(n.em,{children:"Launch as user"}),"."]})}),"\n",(0,t.jsx)(n.h3,{id:"firewall-configuration",children:"Firewall configuration"}),"\n",(0,t.jsx)(n.p,{children:"In case of communication issue, the most likely cause is the configuration of a firewall between the two computers\nand/or at the hosting company in the case of machines on the cloud. On a Windows server, it is possible to configure\nthe firewall by adding a rule on port 135."}),"\n",(0,t.jsx)(n.p,{children:(0,t.jsx)(n.img,{alt:"Windows Firewall Configuration",src:i(6931).A+"",width:"797",height:"728"})}),"\n",(0,t.jsx)(n.p,{children:"In the case of a server hosted by Lightsail, there is an additional firewall in which a custom rule must be configured\nfor port 135."}),"\n",(0,t.jsx)(n.p,{children:(0,t.jsx)(n.img,{alt:"Lightsail Firewall Configuration",src:i(4671).A+"",width:"908",height:"442"})}),"\n",(0,t.jsx)(n.h3,{id:"opcenum-tool",children:"OPCEnum tool"}),"\n",(0,t.jsxs)(n.p,{children:["The OPC Foundation has provided a tool to allow OPCHDA clients to locate servers on remote nodes, without having\ninformation about those servers in the local registry. This tool is called OPCEnum and is freely distributed by the OPC\nFoundation. The PI OPCHDA interface installation installs OPCEnum as well. The primary function of OPCEnum is to inform\nor request information from other instances of OPCEnum about existing OPCHDA Servers on the local system. When OPCEnum\nis installed, it grants Launch and Access DCOM permission to ",(0,t.jsx)(n.em,{children:"Everyone"})," and sets the ",(0,t.jsx)(n.em,{children:"Authentication level"})," to NONE.\nThis allows access to any user who can log on to the system. The permissions can be changed using ",(0,t.jsx)(n.code,{children:"dcomcnfg.exe"}),"."]}),"\n",(0,t.jsx)(n.h4,{id:"rpc-unavailable",children:"RPC unavailable"}),"\n",(0,t.jsxs)(n.p,{children:["If the RPC server is unavailable, try again testing COM/DCOM communication\n",(0,t.jsx)(n.a,{href:"#test-communication",children:"testing COM/DCOM communication"})," and check your firewall."]}),"\n",(0,t.jsx)(n.p,{children:(0,t.jsx)(n.img,{alt:"RPC Unavailable",src:i(6415).A+"",width:"908",height:"214"})}),"\n",(0,t.jsx)(n.h4,{id:"access-denied",children:"Access denied"}),"\n",(0,t.jsxs)(n.p,{children:["Access rights can be diagnosed using the server security log. If the following error happens, check the user and its\npassword created on the HDA server and that the user is in the ",(0,t.jsx)(n.em,{children:"Distributed COM Users"})," group on the HDA server."]}),"\n",(0,t.jsx)(n.p,{children:(0,t.jsx)(n.img,{alt:"Access denied",src:i(7745).A+"",width:"1370",height:"732"})}),"\n",(0,t.jsx)(n.h2,{id:"server-settings",children:"Server settings"}),"\n",(0,t.jsxs)(n.p,{children:["Check on the server machine if DCOM is enabled for the OPC Server application by opening the ",(0,t.jsx)(n.em,{children:"Component Service"})," window."]}),"\n",(0,t.jsx)(n.p,{children:(0,t.jsx)(n.img,{alt:"Server Machine DCOM Configuration",src:i(8035).A+"",width:"692",height:"596"})})]})}function h(e={}){const{wrapper:n}={...(0,s.R)(),...e.components};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(l,{...e})}):l(e)}},1369:(e,n,i)=>{i.d(n,{A:()=>t});const t=i.p+"assets/images/OPCHDA-COM-security-af8091873cb844f8b4170dee7d91a413.png"},7745:(e,n,i)=>{i.d(n,{A:()=>t});const t=i.p+"assets/images/OPCHDA-access-denied-8203f722add5f399a9753da6145f9888.png"},6698:(e,n,i)=>{i.d(n,{A:()=>t});const t=i.p+"assets/images/OPCHDA-access-permissions-e19cde2010f16b0d45ab628cc9e55dcf.png"},9605:(e,n,i)=>{i.d(n,{A:()=>t});const t=i.p+"assets/images/OPCHDA-component-services-05e25952ca374b3aeef941bda4ef3da6.png"},8184:(e,n,i)=>{i.d(n,{A:()=>t});const t=i.p+"assets/images/OPCHDA-computer-properties-5bc31d8ef3b156f9b1cc1454724b7fbe.png"},4671:(e,n,i)=>{i.d(n,{A:()=>t});const t=i.p+"assets/images/OPCHDA-lightsail-firewall-56e27e7a446d930e611762f6acc024e2.png"},6415:(e,n,i)=>{i.d(n,{A:()=>t});const t=i.p+"assets/images/OPCHDA-rpc-unavailable-39f6b46627fd092a7d0199d5eb0578b3.png"},8035:(e,n,i)=>{i.d(n,{A:()=>t});const t=i.p+"assets/images/OPCHDA-server-DCOM-configuration-c41e23873a51d4c0b0841855e0ebd108.png"},7372:(e,n,i)=>{i.d(n,{A:()=>t});const t=i.p+"assets/images/OPCHDA-test-communication-0b33e3bc28c02660c109d333216d5dd9.png"},6931:(e,n,i)=>{i.d(n,{A:()=>t});const t=i.p+"assets/images/OPCHDA-windows-firewall-1cd04eaa34533956a9f02968f616378c.png"},8453:(e,n,i)=>{i.d(n,{R:()=>o,x:()=>r});var t=i(6540);const s={},a=t.createContext(s);function o(e){const n=t.useContext(a);return t.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function r(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:o(e.components),t.createElement(a.Provider,{value:n},e.children)}}}]);