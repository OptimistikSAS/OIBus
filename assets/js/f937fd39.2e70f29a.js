"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[704],{1642:(e,i,n)=>{n.r(i),n.d(i,{assets:()=>h,contentTitle:()=>c,default:()=>x,frontMatter:()=>a,metadata:()=>l,toc:()=>u});var s=n(4848),t=n(8453),o=n(1432),r=n(3566),d=n(8330);const a={sidebar_position:4},c="macOS",l={id:"guide/installation/macos",title:"macOS",description:"Download",source:"@site/docs/guide/installation/macos.mdx",sourceDirName:"guide/installation",slug:"/guide/installation/macos",permalink:"/docs/guide/installation/macos",draft:!1,unlisted:!1,tags:[],version:"current",sidebarPosition:4,frontMatter:{sidebar_position:4},sidebar:"guideSidebar",previous:{title:"Linux",permalink:"/docs/guide/installation/linux"},next:{title:"First access",permalink:"/docs/guide/installation/first-access"}},h={},u=[{value:"Download",id:"download",level:2}];function p(e){const i={a:"a",admonition:"admonition",code:"code",h1:"h1",h2:"h2",header:"header",img:"img",li:"li",p:"p",ul:"ul",...(0,t.R)(),...e.components};return(0,s.jsxs)(s.Fragment,{children:[(0,s.jsx)(i.header,{children:(0,s.jsx)(i.h1,{id:"macos",children:"macOS"})}),"\n",(0,s.jsx)(i.h2,{id:"download",children:"Download"}),"\n",(0,s.jsxs)("div",{style:{display:"flex",justifyContent:"space-around"},children:[(0,s.jsx)(r.A,{link:`https://github.com/OptimistikSAS/OIBus/releases/download/v${d.rE}/oibus-macos_x64-v${d.rE}.zip`,children:(0,s.jsxs)("div",{children:[(0,s.jsx)("div",{children:`OIBus v${d.rE}`}),(0,s.jsx)("div",{children:"MacOS (Intel chip)"})]})}),(0,s.jsx)(r.A,{link:`https://github.com/OptimistikSAS/OIBus/releases/download/v${d.rE}/oibus-macos_arm64-v${d.rE}.zip`,children:(0,s.jsxs)("div",{children:[(0,s.jsx)("div",{children:`OIBus v${d.rE} (zip)`}),(0,s.jsx)("div",{children:"MacOS (ARM 64)"})]})})]}),"\n",(0,s.jsx)(i.p,{children:"macOS OIBus binary can be run through its executable. Once unzipped, start a Terminal and enter the following command:"}),"\n",(0,s.jsx)(o.A,{children:"./oibus-launcher --config ./data-folder"}),"\n",(0,s.jsxs)(i.p,{children:["The ",(0,s.jsx)(i.code,{children:"./data-folder"})," path must be adapted according to the place where the OIBus cache and config will be stored and the binary\nmust be run from its own folder."]}),"\n",(0,s.jsxs)(i.p,{children:["For example, if the binary is stored in ",(0,s.jsx)(i.code,{children:"/bin/"})," and the cache and configuration files are stored in\n",(0,s.jsx)(i.code,{children:"~/test/oibus-data"}),", the command will be:"]}),"\n",(0,s.jsx)(o.A,{children:"cd /bin && ./oibus-launcher --config ~/test/oibus-data"}),"\n",(0,s.jsx)(i.admonition,{type:"caution",children:(0,s.jsx)(i.p,{children:"Be sure to have admin permissions to run the binary"})}),"\n",(0,s.jsxs)(i.admonition,{title:"Allow the app to be executed",type:"caution",children:[(0,s.jsxs)(i.p,{children:["On macOS, you may need to allow the execution of the binary. When first run, go to the System Settings, on the Privacy &\nSecurity menu, and allow the oibus-launcher in the Security section by clicking on ",(0,s.jsx)(i.code,{children:"Allow Anyway"}),"."]}),(0,s.jsx)("div",{style:{textAlign:"center"},children:(0,s.jsx)(i.p,{children:(0,s.jsx)(i.img,{alt:"MacOS security",src:n(4444).A+"",width:"827",height:"609"})})}),(0,s.jsx)(i.p,{children:"This operation must be done twice:"}),(0,s.jsxs)(i.ul,{children:["\n",(0,s.jsxs)(i.li,{children:["One for ",(0,s.jsx)(i.code,{children:"oibus-launcher"})]}),"\n",(0,s.jsxs)(i.li,{children:["One for ",(0,s.jsx)(i.code,{children:"oibus"})," (run by ",(0,s.jsx)(i.code,{children:"oibus-launcher"}),")"]}),"\n"]})]}),"\n",(0,s.jsxs)(i.p,{children:["Get familiar with the OIBus interface on the ",(0,s.jsx)(i.a,{href:"/docs/guide/installation/first-access",children:"first access page"}),"."]})]})}function x(e={}){const{wrapper:i}={...(0,t.R)(),...e.components};return i?(0,s.jsx)(i,{...e,children:(0,s.jsx)(p,{...e})}):p(e)}},3566:(e,i,n)=>{n.d(i,{A:()=>d});n(6540);var s=n(5556),t=n.n(s),o=n(4848);const r=e=>{let{children:i,link:n,color:s}=e;return(0,o.jsx)("div",{style:{marginBottom:"20px",marginTop:"10px",textAlign:"center"},children:(0,o.jsx)("a",{rel:"nofollow",href:n,style:{backgroundColor:s,borderRadius:"10px",color:"#f5f5f5",padding:"10px",cursor:"pointer",minWidth:"10rem",textAlign:"center",display:"flex",justifyContent:"space-around"},children:i})})};r.propTypes={link:t().string.isRequired,color:t().string,children:t().object.isRequired},r.defaultProps={color:"#009ee0"};const d=r},4444:(e,i,n)=>{n.d(i,{A:()=>s});const s=n.p+"assets/images/macos-security-d53458c69a728904b954357db7498509.png"},8330:e=>{e.exports={rE:"3.4.3"}}}]);