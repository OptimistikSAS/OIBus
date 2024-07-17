"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[7870],{37:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>c,contentTitle:()=>d,default:()=>h,frontMatter:()=>r,metadata:()=>A,toc:()=>o});var i=t(4848),l=t(8453),s=t(3566),a=t(8330);const r={sidebar_position:2},d="Windows",A={id:"guide/installation/windows",title:"Windows",description:"Download",source:"@site/docs/guide/installation/windows.mdx",sourceDirName:"guide/installation",slug:"/guide/installation/windows",permalink:"/docs/guide/installation/windows",draft:!1,unlisted:!1,tags:[],version:"current",sidebarPosition:2,frontMatter:{sidebar_position:2},sidebar:"guideSidebar",previous:{title:"Installation Requirements",permalink:"/docs/guide/installation/"},next:{title:"Linux",permalink:"/docs/guide/installation/linux"}},c={},o=[{value:"Download",id:"download",level:2},{value:"Installation",id:"installation",level:2},{value:"With the Windows Installer",id:"with-the-windows-installer",level:3},{value:"With the installation bat script",id:"with-the-installation-bat-script",level:3},{value:"Uninstall",id:"uninstall",level:2},{value:"With the Windows Uninstaller",id:"with-the-windows-uninstaller",level:3},{value:"With the uninstallation batch script",id:"with-the-uninstallation-batch-script",level:3},{value:"Update",id:"update",level:2},{value:"With the Windows Installer",id:"with-the-windows-installer-1",level:3},{value:"With binaries (from zip file)",id:"with-binaries-from-zip-file",level:3}];function f(e){const n={a:"a",admonition:"admonition",code:"code",h1:"h1",h2:"h2",h3:"h3",img:"img",li:"li",ol:"ol",p:"p",pre:"pre",...(0,l.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(n.h1,{id:"windows",children:"Windows"}),"\n",(0,i.jsx)(n.h2,{id:"download",children:"Download"}),"\n",(0,i.jsxs)("div",{style:{display:"flex",justifyContent:"space-around"},children:[(0,i.jsx)(s.A,{link:`https://github.com/OptimistikSAS/OIBus/releases/download/v${a.rE}/oibus-setup-win_x64-v${a.rE}.exe`,children:(0,i.jsxs)("div",{children:[(0,i.jsx)("div",{children:`OIBus v${a.rE} (installer)`}),(0,i.jsx)("div",{children:"Windows (x64)"})]})}),(0,i.jsx)(s.A,{link:`https://github.com/OptimistikSAS/OIBus/releases/download/v${a.rE}/oibus-win_x64-v${a.rE}.zip`,children:(0,i.jsxs)("div",{children:[(0,i.jsx)("div",{children:`OIBus v${a.rE} (zip)`}),(0,i.jsx)("div",{children:"Windows (x64)"})]})})]}),"\n",(0,i.jsx)(n.h2,{id:"installation",children:"Installation"}),"\n",(0,i.jsx)(n.h3,{id:"with-the-windows-installer",children:"With the Windows Installer"}),"\n",(0,i.jsxs)(n.ol,{children:["\n",(0,i.jsx)(n.li,{children:"Run the Windows Installer, you should see the following welcome screen:"}),"\n"]}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Installer welcome screen",src:t(8996).A+"",width:"499",height:"392"})})}),"\n",(0,i.jsxs)(n.ol,{start:"2",children:["\n",(0,i.jsxs)(n.li,{children:["\n",(0,i.jsx)(n.p,{children:"Accept the EU-PL license."}),"\n"]}),"\n",(0,i.jsxs)(n.li,{children:["\n",(0,i.jsx)(n.p,{children:"Choose the path where you want to install the binaries."}),"\n"]}),"\n"]}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Installer binaries path",src:t(8911).A+"",width:"499",height:"392"})})}),"\n",(0,i.jsxs)(n.ol,{start:"4",children:["\n",(0,i.jsx)(n.li,{children:"Select the directory where you'd like to store the cache, logs, and configuration files."}),"\n"]}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Installer data folder path",src:t(822).A+"",width:"499",height:"392"})})}),"\n",(0,i.jsxs)(n.ol,{start:"5",children:["\n",(0,i.jsx)(n.li,{children:"Confirm the settings and await the installer to extract and copy the files to the designated folder."}),"\n"]}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Installer validation step",src:t(5081).A+"",width:"499",height:"392"})})}),"\n",(0,i.jsxs)(n.ol,{start:"6",children:["\n",(0,i.jsx)(n.li,{children:"The last screen will confirm the completion of the installation process."}),"\n"]}),"\n",(0,i.jsx)(n.admonition,{title:"Browser support",type:"caution",children:(0,i.jsx)(n.p,{children:"Note that Internet Explorer is not supported."})}),"\n",(0,i.jsxs)(n.p,{children:["Get familiar with the OIBus interface on the ",(0,i.jsx)(n.a,{href:"/docs/guide/installation/first-access",children:"first access page"}),"."]}),"\n",(0,i.jsx)(n.h3,{id:"with-the-installation-bat-script",children:"With the installation bat script"}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{className:"language-commandline",metastring:'title="Usage"',children:"install.bat <data-path>\n"})}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{className:"language-commandline",metastring:'title="Example with terminal outputs"',children:'install.bat C:\\OIBusData\n> Administrator permissions required. Detecting permission...\n> Stopping OIBus service...\n> Installing OIBus as Windows service...\n> The "OIBus" service has been successfully installed!\n> Configuration of the "AppDirectory" parameter value for the "OIBus" service.\n> nssm set OIBus AppNoConsole 1\n> Starting OIBus service...\n> OIBus: START: Operation successful.\n> Creating go.bat\n> echo Stopping OIBus service... You can restart it from the Windows Service Manager\n> nssm.exe stop OIBus\n> "C:\\Users\\Administrator\\Downloads\\oibus-win_x64\\oibus.exe" --config "C:\\OIBusData"\n'})}),"\n",(0,i.jsx)(n.admonition,{type:"tip",children:(0,i.jsx)(n.p,{children:"If you do not provide the data path argument, the script will prompt you to input it during execution."})}),"\n",(0,i.jsxs)(n.p,{children:["Get familiar with the OIBus interface on the ",(0,i.jsx)(n.a,{href:"/docs/guide/installation/first-access",children:"first access page"}),"."]}),"\n",(0,i.jsx)(n.h2,{id:"uninstall",children:"Uninstall"}),"\n",(0,i.jsx)(n.h3,{id:"with-the-windows-uninstaller",children:"With the Windows Uninstaller"}),"\n",(0,i.jsxs)(n.p,{children:["Navigate to the binary folder and execute the ",(0,i.jsx)(n.code,{children:"unin000.exe"})," file with administrative privileges."]}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Installer binaries path",src:t(8378).A+"",width:"410",height:"152"})})}),"\n",(0,i.jsx)("div",{style:{textAlign:"center"},children:(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Installer binaries path",src:t(8545).A+"",width:"499",height:"392"})})}),"\n",(0,i.jsx)(n.h3,{id:"with-the-uninstallation-batch-script",children:"With the uninstallation batch script"}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{className:'language-title="Example',metastring:'with terminal outputs"',children:"uninstall.bat\nAdministrator permissions required. Detecting permission...\nStopping OIBus service...\nRemoving OIBus service...\n"})}),"\n",(0,i.jsx)(n.admonition,{type:"caution",children:(0,i.jsx)(n.p,{children:"The data folder must be removed manually."})}),"\n",(0,i.jsx)(n.h2,{id:"update",children:"Update"}),"\n",(0,i.jsx)(n.h3,{id:"with-the-windows-installer-1",children:"With the Windows Installer"}),"\n",(0,i.jsx)(n.p,{children:"If you wish to update OIBus, you can utilize the OIBus Windows Installer and indicate the current executable and configuration\npaths. You have the option to retain the existing configuration file or replace it."}),"\n",(0,i.jsx)(n.p,{children:"During the update process, the OIBus service will experience a brief interruption."}),"\n",(0,i.jsxs)(n.p,{children:["Upon the initial startup after the update, the configuration database ",(0,i.jsx)(n.code,{children:"oibus.db"})," will be automatically upgraded to the\nlatest version."]}),"\n",(0,i.jsx)(n.h3,{id:"with-binaries-from-zip-file",children:"With binaries (from zip file)"}),"\n",(0,i.jsx)(n.p,{children:"After extracting the files from the zip archive:"}),"\n",(0,i.jsxs)(n.ol,{children:["\n",(0,i.jsx)(n.li,{children:"Open the Windows Service Manager."}),"\n",(0,i.jsx)(n.li,{children:"Halt the OIBus service."}),"\n",(0,i.jsx)(n.li,{children:"Copy and paste the contents of the zip file into the OIBus executable directory, replacing any existing files."}),"\n",(0,i.jsx)(n.li,{children:"Resume the OIBus service."}),"\n"]}),"\n",(0,i.jsxs)(n.p,{children:["Upon the initial startup after the update, the configuration database ",(0,i.jsx)(n.code,{children:"oibus.db"})," will be automatically upgraded to the\nlatest version."]})]})}function h(e={}){const{wrapper:n}={...(0,l.R)(),...e.components};return n?(0,i.jsx)(n,{...e,children:(0,i.jsx)(f,{...e})}):f(e)}},3566:(e,n,t)=>{t.d(n,{A:()=>r});t(6540);var i=t(5556),l=t.n(i),s=t(4848);const a=e=>{let{children:n,link:t,color:i}=e;return(0,s.jsx)("div",{style:{marginBottom:"20px",marginTop:"10px",textAlign:"center"},children:(0,s.jsx)("a",{rel:"nofollow",href:t,style:{backgroundColor:i,borderRadius:"10px",color:"#f5f5f5",padding:"10px",cursor:"pointer",minWidth:"10rem",textAlign:"center",display:"flex",justifyContent:"space-around"},children:n})})};a.propTypes={link:l().string.isRequired,color:l().string,children:l().object.isRequired},a.defaultProps={color:"#009ee0"};const r=a},8996:(e,n,t)=>{t.d(n,{A:()=>i});const i=t.p+"assets/images/1-f589988e5505d211ac2eae70cbda03e8.png"},8911:(e,n,t)=>{t.d(n,{A:()=>i});const i=t.p+"assets/images/2-46a039c0ccef22ae4447c6bd02d9d7ab.png"},822:(e,n,t)=>{t.d(n,{A:()=>i});const i=t.p+"assets/images/3-5eab335ae60ff157b472af391cbaac6b.png"},5081:(e,n,t)=>{t.d(n,{A:()=>i});const i=t.p+"assets/images/4-b36eb49e3c89c588ff47e347c113717a.png"},8378:(e,n,t)=>{t.d(n,{A:()=>i});const i="data:image/png;base64,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"},8545:(e,n,t)=>{t.d(n,{A:()=>i});const i="data:image/png;base64,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"},8453:(e,n,t)=>{t.d(n,{R:()=>a,x:()=>r});var i=t(6540);const l={},s=i.createContext(l);function a(e){const n=i.useContext(s);return i.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function r(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(l):e.components||l:a(e.components),i.createElement(s.Provider,{value:n},e.children)}},8330:e=>{e.exports={rE:"3.3.14"}}}]);