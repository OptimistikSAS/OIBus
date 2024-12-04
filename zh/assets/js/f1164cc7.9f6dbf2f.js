"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[7840],{2163:(e,n,i)=>{i.r(n),i.d(n,{assets:()=>d,contentTitle:()=>o,default:()=>u,frontMatter:()=>l,metadata:()=>s,toc:()=>c});const s=JSON.parse('{"id":"developer/building","title":"Building OIBus","description":"OIBus uses pkg as its building tool.","source":"@site/i18n/zh/docusaurus-plugin-content-docs/current/developer/building.md","sourceDirName":"developer","slug":"/developer/building","permalink":"/zh/docs/developer/building","draft":false,"unlisted":false,"tags":[],"version":"current","sidebarPosition":2,"frontMatter":{"displayed_sidebar":"developerSidebar","sidebar_position":2},"sidebar":"developerSidebar","previous":{"title":"OIBus developer handbook","permalink":"/zh/docs/developer/"},"next":{"title":"Create a connector","permalink":"/zh/docs/category/create-a-connector"}}');var r=i(4848),t=i(8453);const l={displayed_sidebar:"developerSidebar",sidebar_position:2},o="Building OIBus",d={},c=[{value:"Building binaries",id:"building-binaries",level:2},{value:"Starting the binary",id:"starting-the-binary",level:2},{value:"Windows Installer (Windows only)",id:"windows-installer-windows-only",level:2},{value:"Signing OIBus Windows Installer",id:"signing-oibus-windows-installer",level:3}];function a(e){const n={a:"a",code:"code",em:"em",h1:"h1",h2:"h2",h3:"h3",header:"header",li:"li",ol:"ol",p:"p",pre:"pre",strong:"strong",ul:"ul",...(0,t.R)(),...e.components};return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(n.header,{children:(0,r.jsx)(n.h1,{id:"building-oibus",children:"Building OIBus"})}),"\n",(0,r.jsxs)(n.p,{children:["OIBus uses ",(0,r.jsx)(n.a,{href:"https://github.com/vercel/pkg",children:"pkg"})," as its building tool."]}),"\n",(0,r.jsx)(n.h2,{id:"building-binaries",children:"Building binaries"}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"npm run build:win"}),": Build OIBus for Windows x64 architecture"]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"npm run build:linux"}),": Build OIBus for x64 linux based architectures"]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"npm run build:linux-arm64"}),": Build OIBus for ARM64 linux based platform (like Raspberry 3 B+)"]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"npm run build:macos"}),": Build OIBus for macOS Intel chips"]}),"\n",(0,r.jsxs)(n.li,{children:[(0,r.jsx)(n.code,{children:"npm run build:macos-arm64"}),":  Build OIBus for macOS Apple chips"]}),"\n"]}),"\n",(0,r.jsx)(n.h2,{id:"starting-the-binary",children:"Starting the binary"}),"\n",(0,r.jsx)(n.p,{children:"The following commands start the appropriate binary with data-folder as the directory where to store the caches, configuration, logs..."}),"\n",(0,r.jsxs)(n.ul,{children:["\n",(0,r.jsx)(n.li,{children:(0,r.jsx)(n.code,{children:"npm run start:win"})}),"\n",(0,r.jsx)(n.li,{children:(0,r.jsx)(n.code,{children:"npm run start:linux"})}),"\n",(0,r.jsx)(n.li,{children:(0,r.jsx)(n.code,{children:"npm run start:linux-arm64"})}),"\n",(0,r.jsx)(n.li,{children:(0,r.jsx)(n.code,{children:"npm run start:macos"})}),"\n",(0,r.jsx)(n.li,{children:(0,r.jsx)(n.code,{children:"npm run start:macos-arm64"})}),"\n"]}),"\n",(0,r.jsx)(n.h2,{id:"windows-installer-windows-only",children:"Windows Installer (Windows only)"}),"\n",(0,r.jsxs)(n.p,{children:["The Windows Installer can be built with ",(0,r.jsx)(n.a,{href:"https://jrsoftware.org/isinfo.php",children:"Inno Setup"}),", only on Windows platform."]}),"\n",(0,r.jsxs)(n.p,{children:["However, because of some environment variables, the build action cannot be executed from Inno Setup directly. OIBus backend\npackage.json file provide a npm command: ",(0,r.jsx)(n.code,{children:"build:win-setup"}),". Before running it, you may need to set a few things up in order\nto manage the signing of the installer."]}),"\n",(0,r.jsx)(n.h3,{id:"signing-oibus-windows-installer",children:"Signing OIBus Windows Installer"}),"\n",(0,r.jsxs)(n.p,{children:["These commands can be used with ",(0,r.jsx)(n.strong,{children:"Powershell"}),", on a Windows system."]}),"\n",(0,r.jsxs)(n.ol,{children:["\n",(0,r.jsxs)(n.li,{children:["Create a ",(0,r.jsx)(n.code,{children:"cert.conf"})," file:"]}),"\n"]}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{children:'[ req ]\ndefault_bits = 2048\ndefault_md = sha256\ndistinguished_name = subject\nreq_extensions = req_ext\nx509_extensions = req_ext\nstring_mask = utf8only\nprompt = no\n\n[ req_ext ]\nbasicConstraints = CA:FALSE\nnsCertType = client, server\nkeyUsage = nonRepudiation, digitalSignature, keyEncipherment, dataEncipherment, keyCertSign\nextendedKeyUsage= serverAuth, clientAuth\nnsComment = "OIBus Cert"\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid,issuer\nsubjectAltName = URI:urn:oibus,IP:127.0.0.1\n\n[ subject ]\ncountryName = FR\nstateOrProvinceName = FR\nlocalityName = Chamb\xe9ry\norganizationName = OI\ncommonName = oibus\n'})}),"\n",(0,r.jsxs)(n.ol,{start:"2",children:["\n",(0,r.jsxs)(n.li,{children:["Generate CSR (Certificate Signing Request) from ",(0,r.jsx)(n.code,{children:"cert.conf"})," file, and keep secret the private.key:"]}),"\n"]}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{children:"openssl req -new -newkey rsa:4096 -keyout private.key -sha256 -nodes -out oibus.csr -config cert.conf\n"})}),"\n",(0,r.jsxs)(n.ol,{start:"3",children:["\n",(0,r.jsx)(n.li,{children:"Create a local self-signed certificate"}),"\n"]}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{children:"openssl x509 -req -in oibus.csr -signkey private.key -out oibus.crt\n"})}),"\n",(0,r.jsxs)(n.ol,{start:"4",children:["\n",(0,r.jsx)(n.li,{children:"Convert the cert file to PFX file"}),"\n"]}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{children:"openssl pkcs12 -export -in oibus.crt -inkey private.key -out oibus.pfx -passout pass:password -name OIBus\n"})}),"\n",(0,r.jsxs)(n.ol,{start:"5",children:["\n",(0,r.jsxs)(n.li,{children:["Convert PFX certificate file to ",(0,r.jsx)(n.em,{children:"base64"})]}),"\n"]}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{children:"base64 oibus.pfx > oibus64.pfx\n"})}),"\n",(0,r.jsxs)(n.ol,{start:"6",children:["\n",(0,r.jsx)(n.li,{children:"Create the installer"}),"\n"]}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{children:'$env:PFX_PASSWORD = "password" ; $env:PFX_PATH = "path" ; npm run build:win-setup\n'})})]})}function u(e={}){const{wrapper:n}={...(0,t.R)(),...e.components};return n?(0,r.jsx)(n,{...e,children:(0,r.jsx)(a,{...e})}):a(e)}},8453:(e,n,i)=>{i.d(n,{R:()=>l,x:()=>o});var s=i(6540);const r={},t=s.createContext(r);function l(e){const n=s.useContext(t);return s.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function o(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:l(e.components),s.createElement(t.Provider,{value:n},e.children)}}}]);