"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[7705],{4112:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>c,contentTitle:()=>o,default:()=>d,frontMatter:()=>r,metadata:()=>a,toc:()=>l});var i=n(4848),s=n(8453);const r={sidebar_position:9},o="ADS - TwinCAT",a={id:"guide/south-connectors/ads",title:"ADS - TwinCAT",description:"The Automation Device Specification (ADS) protocol serves as a transport layer integrated into TwinCAT systems, designed",source:"@site/docs/guide/south-connectors/ads.md",sourceDirName:"guide/south-connectors",slug:"/guide/south-connectors/ads",permalink:"/docs/guide/south-connectors/ads",draft:!1,unlisted:!1,tags:[],version:"current",sidebarPosition:9,frontMatter:{sidebar_position:9},sidebar:"guideSidebar",previous:{title:"PostgreSQL",permalink:"/docs/guide/south-connectors/postgresql"},next:{title:"MySQL / MariaDB",permalink:"/docs/guide/south-connectors/mysql"}},c={},l=[{value:"Specific settings",id:"specific-settings",level:2},{value:"With local AMS server (TwinCAT runtime)",id:"with-local-ams-server-twincat-runtime",level:3},{value:"With remote AMS server",id:"with-remote-ams-server",level:3},{value:"Other specific settings",id:"other-specific-settings",level:3},{value:"Structure filtering",id:"structure-filtering",level:4},{value:"Item settings",id:"item-settings",level:2}];function h(e){const t={a:"a",admonition:"admonition",code:"code",em:"em",h1:"h1",h2:"h2",h3:"h3",h4:"h4",img:"img",li:"li",p:"p",strong:"strong",ul:"ul",...(0,s.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(t.h1,{id:"ads---twincat",children:"ADS - TwinCAT"}),"\n",(0,i.jsx)(t.p,{children:"The Automation Device Specification (ADS) protocol serves as a transport layer integrated into TwinCAT systems, designed\nand developed by Beckhoff."}),"\n",(0,i.jsx)(t.p,{children:"Every data item is identified by a distinct address within the controller, which can be conveniently accessed through\nthe ADS connector on the OIBus."}),"\n",(0,i.jsxs)(t.p,{children:["The OIBus utilizes the ",(0,i.jsx)(t.a,{href:"https://github.com/jisotalo/ads-client",children:"ads-client"})," library for this purpose."]}),"\n",(0,i.jsx)(t.h2,{id:"specific-settings",children:"Specific settings"}),"\n",(0,i.jsx)(t.p,{children:"OIBus uses the ADS protocol to connect to an AMS Router. The AMS Router serves as the intermediary that connects ADS clients,\nsuch as OIBus, to PLCs and the TwinCAT runtime. This connectivity enables OIBus to access data from PLCs."}),"\n",(0,i.jsx)(t.p,{children:"The specific configuration possibilities depend on the placement and location of the AMS Router."}),"\n",(0,i.jsx)(t.h3,{id:"with-local-ams-server-twincat-runtime",children:"With local AMS server (TwinCAT runtime)"}),"\n",(0,i.jsxs)(t.p,{children:["When TwinCAT is installed on the same machine and network as OIBus, the ADS connector has the capability to utilize the\nTwinCAT runtime, enabling direct communication with the PLC using its ",(0,i.jsx)(t.strong,{children:"Net ID"})," and ",(0,i.jsx)(t.strong,{children:"PLC Port"})," (no need to specify Router\naddress, Router TCP port, Client AMS Net ID, Client ADS port)."]}),"\n",(0,i.jsxs)(t.p,{children:["The Net ID is an address resembling an IP address with two extra numeric values. Typically, the Net ID corresponds to\nthe IP address used to access the PLC from the network, with two additional numbers for distinguishing between multiple\nPLCs that can be accessed through a single AMS Router. For instance, an example Net ID might look like ",(0,i.jsx)(t.code,{children:"127.0.0.1.1.1"}),"."]}),"\n",(0,i.jsx)(t.p,{children:"The port specifies the communication endpoint for connecting with the PLC from the AMS Router, typically set to the default\nvalue of 851."}),"\n",(0,i.jsx)(t.h3,{id:"with-remote-ams-server",children:"With remote AMS server"}),"\n",(0,i.jsxs)(t.p,{children:["When connecting to a remote AMS server, you will need the ",(0,i.jsx)(t.strong,{children:"Net ID"})," and ",(0,i.jsx)(t.strong,{children:"PLC Port"})," as well as several additional fields:"]}),"\n",(0,i.jsxs)(t.ul,{children:["\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Router address"}),": This is the IP address or domain name of the AMS router."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Router TCP port"}),": The port used by the AMS router for communication. Ensure that this port is allowed by both the\nnetwork and operating system firewalls."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"AMS Net ID"}),": This is a client identifier used to establish a connection with the TwinCAT runtime."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"ADS Client port"})," (optional): You can specify the port used by the client for data exchange. If left empty, the AMS\nserver will assign a random port. If you choose to specify a port, ensure that it is not already in use by another client."]}),"\n"]}),"\n",(0,i.jsxs)(t.p,{children:["To enable communication between the ADS connector and the TwinCAT runtime, you must configure Static Routes using the\n",(0,i.jsx)(t.em,{children:"TwinCAT Static Routes"})," tool. The following example illustrates how to configure two routes using the ",(0,i.jsx)(t.strong,{children:"AMS Net ID"}),", which\nshould be utilized on the OIBus side. It is crucial that the ",(0,i.jsx)(t.strong,{children:"AMS Net ID"})," is used in conjunction with the IP address\nspecified in the Static Routes."]}),"\n",(0,i.jsx)(t.p,{children:(0,i.jsx)(t.img,{alt:"TwinCAT Static Routes tool",src:n(6763).A+"",width:"908",height:"492"})}),"\n",(0,i.jsx)(t.p,{children:(0,i.jsx)(t.img,{alt:"Add a TwinCAT Static Route",src:n(4612).A+"",width:"640",height:"485"})}),"\n",(0,i.jsxs)(t.p,{children:["The AMSNetId specified must be filled in the ",(0,i.jsx)(t.strong,{children:"AMS Net ID"})," field of the OIBus configuration."]}),"\n",(0,i.jsx)(t.admonition,{title:"Multiple ADS connectors",type:"danger",children:(0,i.jsx)(t.p,{children:"OIBus supports only a single remote ADS connector at a time. If you need to connect to two different PLCs simultaneously,\nyou can achieve this by using a local AMS server."})}),"\n",(0,i.jsx)(t.h3,{id:"other-specific-settings",children:"Other specific settings"}),"\n",(0,i.jsx)(t.p,{children:"Here are some additional configuration options:"}),"\n",(0,i.jsxs)(t.ul,{children:["\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Retry Interval"}),": This is the amount of time to wait before attempting to retry the connection."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"PLC Name"}),": You can specify a prefix added to each item name before they are sent into North caches. For example,\nwith a PLC name of ",(0,i.jsx)(t.code,{children:"PLC001."})," (including the dot), and an item name of ",(0,i.jsx)(t.code,{children:"MyVariable.Value"}),", the resulting name, once the\nvalues are retrieved, will be ",(0,i.jsx)(t.code,{children:"PLC001.MyVariable.Value"}),". This helps differentiate data from different PLCs. Another PLC\nmight have a resulting item name like ",(0,i.jsx)(t.code,{children:"PLC002.MyVariable.Value"}),"."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Enumeration value"}),": You can choose whether to serialize enumerations as integers or as text."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Boolean value"}),": You can choose whether to serialize booleans as integers or as text."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Structure filtering"}),": For details on structure filtering, please refer to the ",(0,i.jsx)(t.a,{href:"#structure-filtering",children:"specific documentation"}),"."]}),"\n"]}),"\n",(0,i.jsxs)(t.admonition,{title:"When to use PLC name?",type:"tip",children:[(0,i.jsx)(t.p,{children:"In scenarios where data from similar PLCs with shared point addresses schema is retrieved via two different ADS connectors\nand sent to the same North connector, the resulting values may possess identical point IDs despite originating from distinct\nPLCs."}),(0,i.jsxs)(t.p,{children:["To mitigate this potential ambiguity, you can opt to append the ",(0,i.jsx)(t.strong,{children:"PLC name"})," in front of each point ID once the data is\nretrieved. This practice ensures that the point IDs sent to the North connector remain distinct, which proves particularly\nuseful when exporting these items for import into another OIBus."]}),(0,i.jsx)(t.p,{children:"By simply altering the PLC name, you can ensure that your data remains unique in the North-targeted application."})]}),"\n",(0,i.jsx)(t.h4,{id:"structure-filtering",children:"Structure filtering"}),"\n",(0,i.jsxs)(t.p,{children:["You can also retrieve an entire data structure using this method. For instance, if the data ",(0,i.jsx)(t.em,{children:"MyVariable"})," is of the\n",(0,i.jsx)(t.em,{children:"MyStructure"})," type and includes fields like ",(0,i.jsx)(t.em,{children:"MyDate"}),", ",(0,i.jsx)(t.em,{children:"MyNumber"}),", and ",(0,i.jsx)(t.em,{children:"Value"}),", but you only need ",(0,i.jsx)(t.em,{children:"MyDate"})," and\n",(0,i.jsx)(t.em,{children:"MyNumber"}),", you can create a new structure within the ",(0,i.jsx)(t.em,{children:"structure filtering"})," section with the ",(0,i.jsx)(t.strong,{children:"Structure name"}),"\n",(0,i.jsx)(t.code,{children:"MyStructure"}),".\nIn the ",(0,i.jsx)(t.strong,{children:"Fields to keep"})," section, you can specify only the required fields, separated by commas, such as ",(0,i.jsx)(t.code,{children:"MyDate, MyNumber"}),"."]}),"\n",(0,i.jsxs)(t.p,{children:["This feature is particularly beneficial when dealing with multiple data items, all of which are of the ",(0,i.jsx)(t.em,{children:"MyStructure"})," type,\nbut you are interested in retrieving only specific fields from the structure, such as ",(0,i.jsx)(t.em,{children:"MyDate"})," and ",(0,i.jsx)(t.em,{children:"MyNumber"}),". The more\nfields the structure has, the more advantageous this feature becomes."]}),"\n",(0,i.jsxs)(t.p,{children:["Ultimately, each field specified will result in a unique point ID. In the example provided, using this method for the\nsingle point ",(0,i.jsx)(t.em,{children:"MyVariable"})," will result in two distinct points:"]}),"\n",(0,i.jsxs)(t.ul,{children:["\n",(0,i.jsx)(t.li,{children:"MyVariable.MyDate"}),"\n",(0,i.jsx)(t.li,{children:"MyVariable.MyNumber"}),"\n"]}),"\n",(0,i.jsx)(t.h2,{id:"item-settings",children:"Item settings"}),"\n",(0,i.jsxs)(t.ul,{children:["\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Address"}),": The address of the data to query in the PLC."]}),"\n"]})]})}function d(e={}){const{wrapper:t}={...(0,s.R)(),...e.components};return t?(0,i.jsx)(t,{...e,children:(0,i.jsx)(h,{...e})}):h(e)}},6763:(e,t,n)=>{n.d(t,{A:()=>i});const i=n.p+"assets/images/installation-ads-distant-7d043b9c61a135e76dc689cfa7df7017.png"},4612:(e,t,n)=>{n.d(t,{A:()=>i});const i=n.p+"assets/images/routes-9e5abc66ee07da3d17541566a90470c4.png"},8453:(e,t,n)=>{n.d(t,{R:()=>o,x:()=>a});var i=n(6540);const s={},r=i.createContext(s);function o(e){const t=i.useContext(r);return i.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function a(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:o(e.components),i.createElement(r.Provider,{value:t},e.children)}}}]);