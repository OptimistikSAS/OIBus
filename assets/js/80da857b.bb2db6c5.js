"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[7836],{4896:(e,n,s)=>{s.r(n),s.d(n,{assets:()=>l,contentTitle:()=>o,default:()=>u,frontMatter:()=>t,metadata:()=>c,toc:()=>a});var i=s(4848),r=s(8453);const t={displayed_sidebar:"developerSidebar",sidebar_position:2},o="Certificates",c={id:"developer/certificates",title:"Certificates",description:"Some protocols and tools use certificates for authentication or signing purposes. If you need to create self-signed",source:"@site/versioned_docs/version-v2/developer/certificates.md",sourceDirName:"developer",slug:"/developer/certificates",permalink:"/docs/v2/developer/certificates",draft:!1,unlisted:!1,tags:[],version:"v2",sidebarPosition:2,frontMatter:{displayed_sidebar:"developerSidebar",sidebar_position:2},sidebar:"developerSidebar",previous:{title:"OIBus developer handbook",permalink:"/docs/v2/developer/"}},l={},a=[{value:"Using certificates with ProSys OPC UA Simulation Server",id:"using-certificates-with-prosys-opc-ua-simulation-server",level:2},{value:"Signing OIBus Windows Installer",id:"signing-oibus-windows-installer",level:2}];function d(e){const n={code:"code",em:"em",h1:"h1",h2:"h2",header:"header",li:"li",ol:"ol",p:"p",pre:"pre",strong:"strong",...(0,r.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(n.header,{children:(0,i.jsx)(n.h1,{id:"certificates",children:"Certificates"})}),"\n",(0,i.jsx)(n.p,{children:"Some protocols and tools use certificates for authentication or signing purposes. If you need to create self-signed\ncertificates to test OIBus, you can follow this guide.\nA configuration file cert.conf should be created to insert some settigns for the certificate creation. Here is an example\nthat will be used for this guide:"}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:'[ req ]\ndefault_bits = 2048\ndefault_md = sha256\ndistinguished_name = subject\nreq_extensions = req_ext\nx509_extensions = req_ext\nstring_mask = utf8only\nprompt = no\n\n[ req_ext ]\nbasicConstraints = CA:FALSE\nnsCertType = client, server\nkeyUsage = nonRepudiation, digitalSignature, keyEncipherment, dataEncipherment, keyCertSign\nextendedKeyUsage= serverAuth, clientAuth\nnsComment = "OIBus User Cert"\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid,issuer\nsubjectAltName = URI:urn:opcua:user:oibus,IP: 127.0.0.1\n\n[ subject ]\ncountryName = FR\nstateOrProvinceName = FR\nlocalityName = Chamb\xe9ry\norganizationName = OI\ncommonName = oibus\n'})}),"\n",(0,i.jsx)(n.h2,{id:"using-certificates-with-prosys-opc-ua-simulation-server",children:"Using certificates with ProSys OPC UA Simulation Server"}),"\n",(0,i.jsxs)(n.ol,{children:["\n",(0,i.jsxs)(n.li,{children:["Create a private key and certificate using the ",(0,i.jsx)(n.code,{children:"cert.conf"}),":"]}),"\n"]}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:"openssl req -new -x509 -keyout oibus.key -out oibus.pem -config cert.conf\n"})}),"\n",(0,i.jsxs)(n.ol,{start:"2",children:["\n",(0,i.jsx)(n.li,{children:"Remove private key passphrase:"}),"\n"]}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:"openssl rsa -in oibus.key -out oibus.key\n"})}),"\n",(0,i.jsxs)(n.ol,{start:"3",children:["\n",(0,i.jsx)(n.li,{children:"Create DER cert for ProSys:"}),"\n"]}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:"openssl x509 -inform PEM -outform DER -in oibus.pem -out oibus.der\n"})}),"\n",(0,i.jsxs)(n.ol,{start:"4",children:["\n",(0,i.jsxs)(n.li,{children:["Copy the DER cert in ProSys USERS_PKI certificate folder: ",(0,i.jsx)(n.code,{children:"prosys-opc-ua-simulation-server\\USERS_PKI\\CA\\certs"})]}),"\n"]}),"\n",(0,i.jsx)(n.h2,{id:"signing-oibus-windows-installer",children:"Signing OIBus Windows Installer"}),"\n",(0,i.jsxs)(n.p,{children:["These commands can be used with ",(0,i.jsx)(n.strong,{children:"Powershell"}),", on a Windows system."]}),"\n",(0,i.jsxs)(n.ol,{children:["\n",(0,i.jsxs)(n.li,{children:["Generate CSR (Certificate Signing Request) from ",(0,i.jsx)(n.code,{children:"cert.conf"})," file, and keep secret the private.key:"]}),"\n"]}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:"openssl req -new -newkey rsa:4096 -keyout private.key -sha256 -nodes -out oibus.csr -config cert.conf\n"})}),"\n",(0,i.jsxs)(n.ol,{start:"2",children:["\n",(0,i.jsx)(n.li,{children:"Create a local self-signed certificate"}),"\n"]}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:"openssl x509 -req -in oibus.csr -signkey private.key -out oibus.crt\n"})}),"\n",(0,i.jsxs)(n.ol,{start:"3",children:["\n",(0,i.jsx)(n.li,{children:"Convert the cert file to PFX file"}),"\n"]}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:"openssl pkcs12 -export -in oibus.crt -inkey private.key -out oibus.pfx -passout pass:password -name OIBus\n"})}),"\n",(0,i.jsxs)(n.ol,{start:"4",children:["\n",(0,i.jsxs)(n.li,{children:["Convert PFX certificate file to ",(0,i.jsx)(n.em,{children:"base64"})]}),"\n"]}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:"base64 oibus.pfx >  oibus64.pfx\n"})}),"\n",(0,i.jsxs)(n.ol,{start:"5",children:["\n",(0,i.jsx)(n.li,{children:"Run sign tool"}),"\n"]}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:'$env:PFX_PASSWORD = "password" ; $env:PFX_PATH = "path" ; npm run build:win-setup\n'})})]})}function u(e={}){const{wrapper:n}={...(0,r.R)(),...e.components};return n?(0,i.jsx)(n,{...e,children:(0,i.jsx)(d,{...e})}):d(e)}},8453:(e,n,s)=>{s.d(n,{R:()=>o,x:()=>c});var i=s(6540);const r={},t=i.createContext(r);function o(e){const n=i.useContext(t);return i.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function c(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:o(e.components),i.createElement(t.Provider,{value:n},e.children)}}}]);