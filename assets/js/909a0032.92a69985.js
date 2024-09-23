"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[9153],{6280:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>a,contentTitle:()=>o,default:()=>h,frontMatter:()=>r,metadata:()=>c,toc:()=>d});var i=t(4848),s=t(8453);const r={sidebar_position:2},o="OPCUA",c={id:"guide/south-connectors/opcua",title:"OPCUA",description:"OPCUA, which stands for OPC Unified Architecture, is a protocol designed for accessing data in both read and write modes.",source:"@site/docs/guide/south-connectors/opcua.md",sourceDirName:"guide/south-connectors",slug:"/guide/south-connectors/opcua",permalink:"/docs/guide/south-connectors/opcua",draft:!1,unlisted:!1,tags:[],version:"current",sidebarPosition:2,frontMatter:{sidebar_position:2},sidebar:"guideSidebar",previous:{title:"Folder Scanner",permalink:"/docs/guide/south-connectors/folder-scanner"},next:{title:"Microsoft SQL Server (MSSQL)",permalink:"/docs/guide/south-connectors/mssql"}},a={},d=[{value:"Specific settings",id:"specific-settings",level:2},{value:"Item settings",id:"item-settings",level:2},{value:"Security settings",id:"security-settings",level:2},{value:"Communication",id:"communication",level:3},{value:"Authentication",id:"authentication",level:3},{value:"Use the same certificate for user authentication and secure communications",id:"use-the-same-certificate-for-user-authentication-and-secure-communications",level:3},{value:"Using certificates with ProSys OPC UA Simulation Server",id:"using-certificates-with-prosys-opc-ua-simulation-server",level:2}];function l(e){const n={a:"a",admonition:"admonition",code:"code",em:"em",h1:"h1",h2:"h2",h3:"h3",img:"img",li:"li",ol:"ol",p:"p",pre:"pre",strong:"strong",ul:"ul",...(0,s.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(n.h1,{id:"opcua",children:"OPCUA"}),"\n",(0,i.jsxs)(n.p,{children:["OPCUA, which stands for OPC Unified Architecture, is a protocol designed for accessing data in both read and write modes.\nThe data is organized within a tree-like address space and is referenced using unique identifiers known as node IDs.\nOPCUA is a modern standard that is based on TCP/IP and has replaced older OPC HDA/DA technologies (refer to the\n",(0,i.jsx)(n.a,{href:"/docs/guide/south-connectors/opc-hda",children:"OPCHDA connector"}),"). It is often natively embedded in industrial controllers."]}),"\n",(0,i.jsx)(n.p,{children:"OPCUA incorporates two variants of the protocol: HA (Historical Access) and DA (Data Access). In HA mode, you can access\na history of values over a specified time interval for the requested data points, whereas in DA mode, you can access the\nvalues at each request or listen to changes in the values."}),"\n",(0,i.jsxs)(n.p,{children:["OIBus integrates both OPCUA modes (HA and DA) in read-only mode, using the ",(0,i.jsx)(n.a,{href:"https://github.com/node-opcua/node-opcua",children:"node-opcua library"}),"."]}),"\n",(0,i.jsx)(n.h2,{id:"specific-settings",children:"Specific settings"}),"\n",(0,i.jsx)(n.p,{children:"To establish a connection to an OPCUA server, OIBus requires several settings:"}),"\n",(0,i.jsxs)(n.ul,{children:["\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"URL"}),": This is the string used to connect to the server, and it follows the format ",(0,i.jsx)(n.code,{children:"opc.tcp://<host>:<port>/<server-name>"}),"."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Retry interval"})," : The time to wait between reconnection attempts in the event of a connection failure."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Security Mode"})," : Communication can be secured using the security mode and security policy fields. Available security\nmodes include: ",(0,i.jsx)(n.em,{children:"None"}),", ",(0,i.jsx)(n.em,{children:"Sign"}),", ",(0,i.jsx)(n.em,{children:"SignAndEncrypt"}),"."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Security Policy"})," (Applicable when Security mode is not None): Security policies define the level of security for communication.\nAvailable security policies include: None, Basic128, Basic192, Basic256, Basic128Rsa15, Basic192Rsa15, Basic256Rsa15,\nBasic256Sha256, Aes128_Sha256_RsaOaep, PubSub_Aes128_CTR, PubSub_Aes256_CTR."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Authentication"}),": Authentication options include None, Basic, and Certificate. Refer to the ",(0,i.jsx)(n.a,{href:"#authentication",children:"security settings"}),"\nfor more details."]}),"\n"]}),"\n",(0,i.jsx)(n.admonition,{title:"Compatibility with the OPCUA server",type:"caution",children:(0,i.jsx)(n.p,{children:"It's essential to choose a security mode and security policy that are supported by the OPCUA server you are connecting to.\nEnsuring compatibility is crucial for a successful connection."})}),"\n",(0,i.jsx)(n.h2,{id:"item-settings",children:"Item settings"}),"\n",(0,i.jsx)(n.p,{children:"When configuring each item to retrieve data in JSON payload, you'll need to specify the following specific settings:"}),"\n",(0,i.jsxs)(n.ul,{children:["\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Node ID"}),": The Node ID corresponds to the path of the data within the appropriate namespace on the OPCUA server.\nIt's essential to consider the supported node format of the server, which may use either numbers or strings. For example,\non Prosys, ",(0,i.jsx)(n.code,{children:"ns=3;i=1001"})," matches ",(0,i.jsx)(n.code,{children:"ns=3;s=Counter"}),"."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Mode"}),": You can select either HA (Historical Access) or DA (Data Access) mode, depending on your requirements."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Aggregate"})," (HA mode only): In HA mode, there is an option to aggregate the retrieved values over the requested interval."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Resampling"})," (HA mode only): Similarly, in HA mode, you can choose to resample the retrieved values at the requested\ninterval."]}),"\n"]}),"\n",(0,i.jsx)(n.admonition,{title:"Compatibility with the OPCUA server",type:"caution",children:(0,i.jsxs)(n.p,{children:["It's important to note that not all aggregation and resampling options are supported by OPCUA servers. To avoid\ncompatibility issues, it's recommended to use ",(0,i.jsx)(n.code,{children:"Raw"})," aggregation and ",(0,i.jsx)(n.code,{children:"None"})," resampling whenever possible. Additionally,\nensure that the selected mode (HA or DA) is supported by the server you are connecting to."]})}),"\n",(0,i.jsxs)(n.p,{children:["The name of the item will serve as a reference in JSON payloads, specifically in the ",(0,i.jsx)(n.code,{children:"pointID"})," field for the North application."]}),"\n",(0,i.jsx)(n.h2,{id:"security-settings",children:"Security settings"}),"\n",(0,i.jsx)(n.h3,{id:"communication",children:"Communication"}),"\n",(0,i.jsxs)(n.p,{children:["When using a security mode other than ",(0,i.jsx)(n.em,{children:"None"}),", a certificate is required to sign and potentially encrypt the communications.\nOIBus generates a self-signed certificate for securing communication with the OPCUA server during startup. You can locate\nthe certificate used by OPCUA in the ",(0,i.jsx)(n.code,{children:"opcua"})," folder of the South cache. This certificate must be trusted by the OPCUA\nserver to enable secure communication."]}),"\n",(0,i.jsx)(n.admonition,{title:"Example on Prosys OPCUA Simulation Server",type:"info",children:(0,i.jsxs)(n.p,{children:[(0,i.jsx)(n.img,{alt:"Prosys OPCUA Simulation Server Certificates",src:t(7284).A+"",width:"995",height:"627"}),"\nIf the certificate is not trusted by the OPCUA server, you may encounter an error with the message: ",(0,i.jsx)(n.code,{children:"Error: The connection  may have been rejected by the server"}),"."]})}),"\n",(0,i.jsx)(n.h3,{id:"authentication",children:"Authentication"}),"\n",(0,i.jsxs)(n.p,{children:["The certificate used for client authentication must be added to the trusted user certificates list on the OPCUA server.\nIt is managed separately from the self-signed certificate mentioned earlier, which is used for\n",(0,i.jsx)(n.a,{href:"#communication",children:"securing communication"}),"."]}),"\n",(0,i.jsxs)(n.admonition,{title:"Example on Prosys OPCUA Simulation Server",type:"info",children:[(0,i.jsxs)(n.p,{children:["For Prosys OPC UA servers, the certificate used to authenticate OIBus must be placed in the\n",(0,i.jsx)(n.code,{children:".prosysopc\\prosys-opc-ua-simulation-server\\USERS_PKI\\CA\\certs"})," folder. Failure to do so may result in an error with the\nmessage: ",(0,i.jsx)(n.code,{children:"Error: serviceResult = BadIdentityTokenRejected (0x80210000)"}),"."]}),(0,i.jsxs)(n.p,{children:["If a connection has previously been attempted and rejected, you should remove the certificate from the ",(0,i.jsx)(n.strong,{children:"rejected certificates"}),"\nfolder (",(0,i.jsx)(n.code,{children:".prosysopc\\prosys-opc-ua-simulation-server\\USERS_PKI\\CA\\rejected"}),") and move it to the ",(0,i.jsx)(n.strong,{children:"trusted"})," folder\n(",(0,i.jsx)(n.code,{children:".prosysopc\\prosys-opc-ua-simulation-server\\USERS_PKI\\CA\\certs"}),")."]})]}),"\n",(0,i.jsx)(n.h3,{id:"use-the-same-certificate-for-user-authentication-and-secure-communications",children:"Use the same certificate for user authentication and secure communications"}),"\n",(0,i.jsxs)(n.p,{children:["The same certificate can be used for both sign and encrypt operations and for authentication. To do that, the ",(0,i.jsx)(n.code,{children:"cert.pem"}),"\nand ",(0,i.jsx)(n.code,{children:"private.pem"})," file paths must be specified. They are located in the south cache data stream folder (inside the opcua\ndirectory)."]}),"\n",(0,i.jsxs)(n.p,{children:["On the OPCUA server side, the self-signed certificate (",(0,i.jsx)(n.code,{children:"cert.pem"}),") must be copied in the user certificates' folder."]}),"\n",(0,i.jsxs)(n.p,{children:["For example, with Prosys OPCUA Simulation Server: ",(0,i.jsx)(n.code,{children:".prosysopc\\prosys-opc-ua-simulation-server\\USERS_PKI\\CA\\certs"}),"."]}),"\n",(0,i.jsx)(n.h2,{id:"using-certificates-with-prosys-opc-ua-simulation-server",children:"Using certificates with ProSys OPC UA Simulation Server"}),"\n",(0,i.jsxs)(n.p,{children:["You can create your self-signed certificate to authenticate OIBus with the ",(0,i.jsx)(n.strong,{children:"Cert"})," method."]}),"\n",(0,i.jsxs)(n.ol,{children:["\n",(0,i.jsx)(n.li,{children:"Create a cert.conf file:"}),"\n"]}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:'[ req ]\ndefault_bits = 2048\ndefault_md = sha256\ndistinguished_name = subject\nreq_extensions = req_ext\nx509_extensions = req_ext\nstring_mask = utf8only\nprompt = no\n\n[ req_ext ]\nbasicConstraints = CA:FALSE\nnsCertType = client, server\nkeyUsage = nonRepudiation, digitalSignature, keyEncipherment, dataEncipherment, keyCertSign\nextendedKeyUsage= serverAuth, clientAuth\nnsComment = "OIBus User Cert"\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid,issuer\nsubjectAltName = URI:urn:opcua:user:oibus,IP: 127.0.0.1\n\n[ subject ]\ncountryName = FR\nstateOrProvinceName = FR\nlocalityName = Chamb\xe9ry\norganizationName = OI\ncommonName = oibus\n'})}),"\n",(0,i.jsxs)(n.ol,{start:"2",children:["\n",(0,i.jsxs)(n.li,{children:["Create a private key and certificate using the ",(0,i.jsx)(n.code,{children:"cert.conf"}),":"]}),"\n"]}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:"openssl req -new -x509 -keyout oibus.key -out oibus.pem -config cert.conf\n"})}),"\n",(0,i.jsxs)(n.ol,{start:"2",children:["\n",(0,i.jsx)(n.li,{children:"Remove private key passphrase:"}),"\n"]}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:"openssl rsa -in oibus.key -out oibus.key\n"})}),"\n",(0,i.jsxs)(n.ol,{start:"3",children:["\n",(0,i.jsx)(n.li,{children:"Create DER cert for ProSys:"}),"\n"]}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:"openssl x509 -inform PEM -outform DER -in oibus.pem -out oibus.der\n"})}),"\n",(0,i.jsxs)(n.ol,{start:"4",children:["\n",(0,i.jsxs)(n.li,{children:["Copy the DER cert in ProSys USERS_PKI certificate folder: ",(0,i.jsx)(n.code,{children:"prosys-opc-ua-simulation-server\\USERS_PKI\\CA\\certs"})]}),"\n"]})]})}function h(e={}){const{wrapper:n}={...(0,s.R)(),...e.components};return n?(0,i.jsx)(n,{...e,children:(0,i.jsx)(l,{...e})}):l(e)}},7284:(e,n,t)=>{t.d(n,{A:()=>i});const i=t.p+"assets/images/prosys-opcua-simulation-server-certificates-3aa9f72ae5a03d39b377b01e927c54ba.png"},8453:(e,n,t)=>{t.d(n,{R:()=>o,x:()=>c});var i=t(6540);const s={},r=i.createContext(s);function o(e){const n=i.useContext(r);return i.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function c(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:o(e.components),i.createElement(r.Provider,{value:n},e.children)}}}]);