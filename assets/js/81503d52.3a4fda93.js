"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[2245],{8123:(e,s,n)=>{n.r(s),n.d(s,{assets:()=>c,contentTitle:()=>r,default:()=>a,frontMatter:()=>o,metadata:()=>d,toc:()=>l});var i=n(4848),t=n(8453);const o={sidebar_position:6},r="Modbus",d={id:"guide/south-connectors/modbus",title:"Modbus",description:"Modbus is a communication protocol used for PLC networks. Historically, it was designed for communication on a serial",source:"@site/versioned_docs/version-v2/guide/south-connectors/modbus.md",sourceDirName:"guide/south-connectors",slug:"/guide/south-connectors/modbus",permalink:"/docs/v2/guide/south-connectors/modbus",draft:!1,unlisted:!1,tags:[],version:"v2",sidebarPosition:6,frontMatter:{sidebar_position:6},sidebar:"guideSidebar",previous:{title:"OPCHDA (Windows only)",permalink:"/docs/v2/guide/south-connectors/opchda"},next:{title:"ADS - TwinCAT",permalink:"/docs/v2/guide/south-connectors/ads"}},c={},l=[{value:"Connection settings",id:"connection-settings",level:2},{value:"PLC settings",id:"plc-settings",level:2},{value:"Points and Modbus addresses",id:"points-and-modbus-addresses",level:2}];function h(e){const s={a:"a",code:"code",em:"em",h1:"h1",h2:"h2",header:"header",li:"li",p:"p",strong:"strong",ul:"ul",...(0,t.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(s.header,{children:(0,i.jsx)(s.h1,{id:"modbus",children:"Modbus"})}),"\n",(0,i.jsx)(s.p,{children:"Modbus is a communication protocol used for PLC networks. Historically, it was designed for communication on a serial\ninterface (RS232, RS422,RS485) and was extended to support the TCP mode."}),"\n",(0,i.jsxs)(s.p,{children:["OIBus uses the ",(0,i.jsx)(s.a,{href:"https://github.com/Cloud-Automation/node-modbus",children:"jsmodbus"})," library ",(0,i.jsx)(s.strong,{children:"in TCP mode only"}),"."]}),"\n",(0,i.jsx)(s.h2,{id:"connection-settings",children:"Connection settings"}),"\n",(0,i.jsx)(s.p,{children:"In this TCP mode, Modbus sets up a client-server connection: the server provides data referenced by addresses but\nremains passive. It is the Modbus client that fetches the data values. The Modbus connector is a Modbus client. It is\ntherefore necessary to indicate to the connector:"}),"\n",(0,i.jsxs)(s.ul,{children:["\n",(0,i.jsxs)(s.li,{children:["The ",(0,i.jsx)(s.strong,{children:"host"})," (IP address or hostname of the Modbus server machine)"]}),"\n",(0,i.jsxs)(s.li,{children:["The ",(0,i.jsx)(s.strong,{children:"port"})," (502 by default)"]}),"\n",(0,i.jsxs)(s.li,{children:["The ",(0,i.jsx)(s.strong,{children:"slave ID"})," to identify the Modbus source machine if necessary (1 by default)."]}),"\n"]}),"\n",(0,i.jsx)(s.h2,{id:"plc-settings",children:"PLC settings"}),"\n",(0,i.jsx)(s.p,{children:"Depending on the PLC, several settings are possible on how to access the data. These settings are common to the whole\nPLC. Here are the following parameters:"}),"\n",(0,i.jsxs)(s.ul,{children:["\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.strong,{children:"Address offset"}),": For most of the PLCs, there is no offset (",(0,i.jsx)(s.em,{children:"Modbus"})," option). Some PLCs start the address range at 1\ninstead of 0 (",(0,i.jsx)(s.em,{children:"JBus"})," option)."]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.strong,{children:"Endianness"}),": Indicates the type of bit encoding (Big Endian or LittleEndian)"]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.strong,{children:"Swap Bytes"}),": Indicates whether the bytes within a group of 16 bits (a word) should be inverted or not"]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.strong,{children:"Swap Words"}),": Indicates whether the words (16-bit group) should be inverted or not within a 32-bit group."]}),"\n"]}),"\n",(0,i.jsx)(s.h2,{id:"points-and-modbus-addresses",children:"Points and Modbus addresses"}),"\n",(0,i.jsx)(s.p,{children:"The Modbus connector retrieves values from specific addresses. These can be added in the Points section (in the upper right\ncorner)."}),"\n",(0,i.jsx)(s.p,{children:"In this list, points can be added with:"}),"\n",(0,i.jsxs)(s.ul,{children:["\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.strong,{children:"Point ID"}),": the name of the data in the result (example: ",(0,i.jsx)(s.code,{children:"My point variable"}),")"]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.strong,{children:"Address"}),": the address of the data in the machine"]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.strong,{children:"Modbus type"}),": ",(0,i.jsx)(s.em,{children:"coil"}),", ",(0,i.jsx)(s.em,{children:"discrete input"}),", ",(0,i.jsx)(s.em,{children:"input register"})," or ",(0,i.jsx)(s.em,{children:"holding register"})," (default)"]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.strong,{children:"Data type"}),": Used in case of ",(0,i.jsx)(s.em,{children:"holding registers"})," or ",(0,i.jsx)(s.em,{children:"input registers"})," (ignored otherwise). This parameter indicates\nthe type of data retrieved from the register: UInt16 (default), Int16, UInt32, Int32, UInt64, Int64, Float or Double."]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.strong,{children:"Multiplier Coefficient"})," (default 1)"]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.strong,{children:"Scan mode"}),": the request frequency. To define more scan modes, see ",(0,i.jsx)(s.a,{href:"/docs/v2/guide/engine/scan-modes",children:"Engine settings"}),"."]}),"\n"]}),"\n",(0,i.jsxs)(s.p,{children:["The address corresponds to the address of the variable in the PLC, ",(0,i.jsx)(s.strong,{children:"in hexadecimal without the data type digit"}),". For\nexample:"]}),"\n",(0,i.jsxs)(s.ul,{children:["\n",(0,i.jsxs)(s.li,{children:["For the ",(0,i.jsx)(s.em,{children:"holding register"})," data 0x40001, enter the address 0x0001 (omit the digit ",(0,i.jsx)(s.code,{children:"4"}),") and specify the Modbus type\n",(0,i.jsx)(s.em,{children:"holdingRegister"}),"."]}),"\n",(0,i.jsxs)(s.li,{children:["For the ",(0,i.jsx)(s.em,{children:"coil"})," data 0x009C, enter 0x009C and specify the Modbus type ",(0,i.jsx)(s.em,{children:"coil"}),"."]}),"\n"]}),"\n",(0,i.jsxs)(s.p,{children:["Modbus data addresses follow the ",(0,i.jsxs)(s.a,{href:"https://www.modbus.org/docs/PI_MBUS_300.pdf",children:[(0,i.jsx)(s.strong,{children:"Modicon Convention Notation"})," (MCN)"]}),":"]}),"\n",(0,i.jsxs)(s.ul,{children:["\n",(0,i.jsxs)(s.li,{children:["Coil: ",(0,i.jsx)(s.code,{children:"[0x00001 - 0x09999]"})," ; from 1 to 39,321"]}),"\n",(0,i.jsxs)(s.li,{children:["Discrete Input: ",(0,i.jsx)(s.code,{children:"[0x10001 - 0x19999]"})," ; from 65,537 to 104,857"]}),"\n",(0,i.jsxs)(s.li,{children:["Input Register: ",(0,i.jsx)(s.code,{children:"[0x30001 - 0x39999]"})," ; from 196,609 to 235,929"]}),"\n",(0,i.jsxs)(s.li,{children:["Holding Register: ",(0,i.jsx)(s.code,{children:"[0x40001 - 0x49999]"})," ; from 262,145 to 301,465"]}),"\n"]}),"\n",(0,i.jsx)(s.p,{children:"An extended version of MCN allows the user to specify larger address spaces:"}),"\n",(0,i.jsxs)(s.ul,{children:["\n",(0,i.jsxs)(s.li,{children:["Coil: ",(0,i.jsx)(s.code,{children:"[0x000001 - 0x065535]"})]}),"\n",(0,i.jsxs)(s.li,{children:["Discrete Input: ",(0,i.jsx)(s.code,{children:"[0x100001 - 0x165535]"})]}),"\n",(0,i.jsxs)(s.li,{children:["Input Register: ",(0,i.jsx)(s.code,{children:"[0x300001 - 0x365535]"})]}),"\n",(0,i.jsxs)(s.li,{children:["Holding Register: ",(0,i.jsx)(s.code,{children:"[0x400001 - 0x465535]"})]}),"\n"]})]})}function a(e={}){const{wrapper:s}={...(0,t.R)(),...e.components};return s?(0,i.jsx)(s,{...e,children:(0,i.jsx)(h,{...e})}):h(e)}},8453:(e,s,n)=>{n.d(s,{R:()=>r,x:()=>d});var i=n(6540);const t={},o=i.createContext(t);function r(e){const s=i.useContext(o);return i.useMemo((function(){return"function"==typeof e?e(s):{...s,...e}}),[s,e])}function d(e){let s;return s=e.disableParentContext?"function"==typeof e.components?e.components(t):e.components||t:r(e.components),i.createElement(o.Provider,{value:s},e.children)}}}]);