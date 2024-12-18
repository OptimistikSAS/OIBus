"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[2580],{7270:(e,s,n)=>{n.r(s),n.d(s,{assets:()=>l,contentTitle:()=>o,default:()=>a,frontMatter:()=>r,metadata:()=>d,toc:()=>c});var i=n(4848),t=n(8453);const r={sidebar_position:4},o="Modbus",d={id:"guide/south-connectors/modbus",title:"Modbus",description:"Modbus is a communication protocol utilized in PLC networks. Originally, it was developed for serial interfaces like",source:"@site/docs/guide/south-connectors/modbus.md",sourceDirName:"guide/south-connectors",slug:"/guide/south-connectors/modbus",permalink:"/docs/guide/south-connectors/modbus",draft:!1,unlisted:!1,tags:[],version:"current",sidebarPosition:4,frontMatter:{sidebar_position:4},sidebar:"guideSidebar",previous:{title:"Microsoft SQL Server (MSSQL)",permalink:"/docs/guide/south-connectors/mssql"},next:{title:"SQLite",permalink:"/docs/guide/south-connectors/sqlite"}},l={},c=[{value:"Specific settings",id:"specific-settings",level:2},{value:"Item settings",id:"item-settings",level:2},{value:"About the Modbus address",id:"about-the-modbus-address",level:3}];function h(e){const s={a:"a",code:"code",em:"em",h1:"h1",h2:"h2",h3:"h3",li:"li",p:"p",strong:"strong",ul:"ul",...(0,t.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(s.h1,{id:"modbus",children:"Modbus"}),"\n",(0,i.jsx)(s.p,{children:"Modbus is a communication protocol utilized in PLC networks. Originally, it was developed for serial interfaces like\nRS232, RS422, and RS485, and later expanded to include support for TCP mode."}),"\n",(0,i.jsxs)(s.p,{children:["OIBus uses the ",(0,i.jsx)(s.a,{href:"https://github.com/Cloud-Automation/node-modbus",children:"jsmodbus"})," library ",(0,i.jsx)(s.strong,{children:"in TCP mode only"}),"."]}),"\n",(0,i.jsx)(s.h2,{id:"specific-settings",children:"Specific settings"}),"\n",(0,i.jsx)(s.p,{children:"Here are the Modbus connector settings:"}),"\n",(0,i.jsxs)(s.ul,{children:["\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.strong,{children:"Host"}),": IP address or hostname of the Modbus server machine."]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.strong,{children:"Port"}),": The port to use for connection (502 by default)."]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.strong,{children:"Retry interval"}),": Time to wait between reconnections after a connection failure."]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.strong,{children:"Slave ID"}),": Identifies the Modbus source machine, default is 1."]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.strong,{children:"Address Offset"}),": For most PLCs, there is no offset (Modbus option). Some PLCs may start the address range at 1 instead of 0 (JBus option)."]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.strong,{children:"Endianness"}),": Specifies the type of bit encoding (Big Endian or Little Endian)."]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.strong,{children:"Swap Bytes"}),": Determines whether the bytes within a group of 16 bits (a word) should be inverted or not."]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.strong,{children:"Swap Words"}),": Indicates whether the words (16-bit groups) should be inverted or not within a 32-bit group."]}),"\n"]}),"\n",(0,i.jsx)(s.h2,{id:"item-settings",children:"Item settings"}),"\n",(0,i.jsxs)(s.ul,{children:["\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.strong,{children:"Address"}),": The hexadecimal address of the data within the device."]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.strong,{children:"Modbus type"}),": Specifies whether it's a ",(0,i.jsx)(s.em,{children:"coil"}),", ",(0,i.jsx)(s.em,{children:"discrete input"}),", ",(0,i.jsx)(s.em,{children:"input register"}),", or ",(0,i.jsx)(s.em,{children:"holding register"})," (default)."]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.strong,{children:"Data type"}),": Relevant for ",(0,i.jsx)(s.em,{children:"holding registers"})," or ",(0,i.jsx)(s.em,{children:"input registers"}),". It defines the type of data fetched from the\nregister, with options such as Bit, UInt16 (default), Int16, UInt32, Int32, UInt64, Int64, Float, or Double."]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.strong,{children:"Bit index"})," (Bit data type only): The index of the bit to retrieve from the read value."]}),"\n",(0,i.jsxs)(s.li,{children:[(0,i.jsx)(s.strong,{children:"Multiplier Coefficient"}),": Multiplies the retrieved value (default is 1)."]}),"\n"]}),"\n",(0,i.jsx)(s.h3,{id:"about-the-modbus-address",children:"About the Modbus address"}),"\n",(0,i.jsx)(s.p,{children:"The address should match the variable's address in the PLC, represented in hexadecimal without the data type digit. For\ninstance:"}),"\n",(0,i.jsxs)(s.ul,{children:["\n",(0,i.jsxs)(s.li,{children:["For ",(0,i.jsx)(s.em,{children:"holding register"})," data at 0x40001, input the address as ",(0,i.jsx)(s.strong,{children:"0x0001"})," (excluding the digit ",(0,i.jsx)(s.code,{children:"4"}),") and specify the\nModbus type as ",(0,i.jsx)(s.em,{children:"holdingRegister"}),"."]}),"\n",(0,i.jsxs)(s.li,{children:["For ",(0,i.jsx)(s.em,{children:"coil"})," data at 0x009C, use ",(0,i.jsx)(s.strong,{children:"0x009C"})," as the address and specify the Modbus type as ",(0,i.jsx)(s.em,{children:"coil"}),"."]}),"\n"]}),"\n",(0,i.jsxs)(s.p,{children:["Modbus data addresses are structured according to the ",(0,i.jsx)(s.a,{href:"https://www.modbus.org/docs/PI_MBUS_300.pdf",children:"Modicon Convention Notation (MCN)"}),":"]}),"\n",(0,i.jsxs)(s.ul,{children:["\n",(0,i.jsxs)(s.li,{children:["Coil: ",(0,i.jsx)(s.code,{children:"[0x00001 - 0x09999]"})," (1 to 39,321)"]}),"\n",(0,i.jsxs)(s.li,{children:["Discrete Input: ",(0,i.jsx)(s.code,{children:"[0x10001 - 0x19999]"})," (65,537 to 104,857)"]}),"\n",(0,i.jsxs)(s.li,{children:["Input Register: ",(0,i.jsx)(s.code,{children:"[0x30001 - 0x39999]"})," (196,609 to 235,929)"]}),"\n",(0,i.jsxs)(s.li,{children:["Holding Register: ",(0,i.jsx)(s.code,{children:"[0x40001 - 0x49999]"})," (262,145 to 301,465)"]}),"\n"]}),"\n",(0,i.jsx)(s.p,{children:"An extended version of MCN allows for larger address spaces:"}),"\n",(0,i.jsxs)(s.ul,{children:["\n",(0,i.jsxs)(s.li,{children:["Coil: ",(0,i.jsx)(s.code,{children:"[0x000001 - 0x065535]"})]}),"\n",(0,i.jsxs)(s.li,{children:["Discrete Input: ",(0,i.jsx)(s.code,{children:"[0x100001 - 0x165535]"})]}),"\n",(0,i.jsxs)(s.li,{children:["Input Register: ",(0,i.jsx)(s.code,{children:"[0x300001 - 0x365535]"})]}),"\n",(0,i.jsxs)(s.li,{children:["Holding Register: ",(0,i.jsx)(s.code,{children:"[0x400001 - 0x465535]"})]}),"\n"]})]})}function a(e={}){const{wrapper:s}={...(0,t.R)(),...e.components};return s?(0,i.jsx)(s,{...e,children:(0,i.jsx)(h,{...e})}):h(e)}},8453:(e,s,n)=>{n.d(s,{R:()=>o,x:()=>d});var i=n(6540);const t={},r=i.createContext(t);function o(e){const s=i.useContext(r);return i.useMemo((function(){return"function"==typeof e?e(s):{...s,...e}}),[s,e])}function d(e){let s;return s=e.disableParentContext?"function"==typeof e.components?e.components(t):e.components||t:o(e.components),i.createElement(r.Provider,{value:s},e.children)}}}]);