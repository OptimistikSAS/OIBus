"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[7740],{8032:(e,n,s)=>{s.r(n),s.d(n,{assets:()=>g,contentTitle:()=>b,default:()=>w,frontMatter:()=>m,metadata:()=>t,toc:()=>j});const t=JSON.parse('{"id":"guide/installation","title":"Installation","description":"Let\'s install OIBus in less than 2 minutes.","source":"@site/versioned_docs/version-v2/guide/installation.mdx","sourceDirName":"guide","slug":"/guide/installation","permalink":"/docs/v2/guide/installation","draft":false,"unlisted":false,"tags":[],"version":"v2","sidebarPosition":2,"frontMatter":{"sidebar_position":2},"sidebar":"guideSidebar","previous":{"title":"Main concepts","permalink":"/docs/v2/guide/"},"next":{"title":"Engine","permalink":"/docs/v2/category/engine"}}');var i=s(4848),a=s(8453),r=s(5537),l=s(9329),o=s(5095);function d(e){const n={a:"a",admonition:"admonition",code:"code",h2:"h2",h3:"h3",img:"img",li:"li",ol:"ol",p:"p",ul:"ul",...(0,a.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)("div",{style:{display:"flex",justifyContent:"space-around"},children:(0,i.jsx)(o.A,{link:"https://github.com/OptimistikSAS/OIBus/releases/download/v2.11.0/oibus-setup-win32x64.exe",children:(0,i.jsxs)("div",{children:[(0,i.jsx)("div",{children:"OIBus v2.11 (installer)"}),(0,i.jsx)("div",{children:"Windows (x64)"})]})})}),"\n",(0,i.jsx)(n.h2,{id:"installation",children:"Installation"}),"\n",(0,i.jsx)(n.h3,{id:"with-the-windows-installer",children:"With the Windows Installer"}),"\n",(0,i.jsxs)(n.ol,{children:["\n",(0,i.jsx)(n.li,{children:"Run the Windows Installer, you should see the following welcome screen:"}),"\n"]}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Installer welcome screen",src:s(1228).A+"",width:"499",height:"392"})}),"\n",(0,i.jsxs)(n.ol,{start:"2",children:["\n",(0,i.jsxs)(n.li,{children:["\n",(0,i.jsx)(n.p,{children:"Accept the EU-PL license and the OPCHDA license."}),"\n"]}),"\n",(0,i.jsxs)(n.li,{children:["\n",(0,i.jsx)(n.p,{children:"Choose the path where you want to install the binaries."}),"\n"]}),"\n"]}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Installer binaries path",src:s(9959).A+"",width:"499",height:"392"})}),"\n",(0,i.jsxs)(n.ol,{start:"4",children:["\n",(0,i.jsx)(n.li,{children:"Choose the path where you want to store the cache, logs and configuration files"}),"\n"]}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Installer data folder path",src:s(6318).A+"",width:"499",height:"392"})}),"\n",(0,i.jsxs)(n.ol,{start:"5",children:["\n",(0,i.jsx)(n.li,{children:"The next step offers you to tune the following OIBus settings:"}),"\n"]}),"\n",(0,i.jsxs)(n.ul,{children:["\n",(0,i.jsxs)(n.li,{children:["The OIBus name (default ",(0,i.jsx)(n.code,{children:"OIBus"}),")"]}),"\n",(0,i.jsxs)(n.li,{children:["The admin name (default ",(0,i.jsx)(n.code,{children:"admin"}),")"]}),"\n",(0,i.jsxs)(n.li,{children:["The port to use (default ",(0,i.jsx)(n.code,{children:"2223"}),")"]}),"\n"]}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Installer settings",src:s(3057).A+"",width:"499",height:"392"})}),"\n",(0,i.jsxs)(n.ol,{start:"6",children:["\n",(0,i.jsx)(n.li,{children:"Validate the settings and wait for the installer to extract and copy the files in the appropriate folder."}),"\n"]}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Installer validation step",src:s(344).A+"",width:"499",height:"392"})}),"\n",(0,i.jsxs)(n.ol,{start:"7",children:["\n",(0,i.jsx)(n.li,{children:"The final screen confirms the installation. You can click on the link at the bottom to directly access OIBus from its\nweb interface."}),"\n"]}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.img,{alt:"Installer final step",src:s(4835).A+"",width:"499",height:"392"})}),"\n",(0,i.jsx)(n.admonition,{title:"Browser support",type:"caution",children:(0,i.jsx)(n.p,{children:"Note that Internet Explorer is not supported."})}),"\n",(0,i.jsx)(n.h2,{id:"update",children:"Update"}),"\n",(0,i.jsx)(n.h3,{id:"with-the-windows-installer-1",children:"With the Windows Installer"}),"\n",(0,i.jsx)(n.p,{children:"In case of OIBus update, you can use the OIBus Windows Installer and specify the already existing executable and\nconfig path. You can choose to keep the existing configuration file or overwrite it."}),"\n",(0,i.jsx)(n.p,{children:"During the update, OIBus service will be stopped briefly."}),"\n",(0,i.jsxs)(n.p,{children:["The configuration file ",(0,i.jsx)(n.code,{children:"oibus.json"})," will be updated to its latest version during the first startup."]}),"\n",(0,i.jsx)(n.h3,{id:"with-binaries",children:"With binaries"}),"\n",(0,i.jsxs)(n.p,{children:["Alternatively, you can download the ",(0,i.jsx)(n.a,{href:"https://github.com/OptimistikSAS/OIBus/releases/latest/download/OIBus-win32x64.zip",children:"zip file\n"})," containing the OIBus executable\nand other dependencies."]}),"\n",(0,i.jsxs)(n.ol,{children:["\n",(0,i.jsx)(n.li,{children:"Go to the Windows service manager."}),"\n",(0,i.jsx)(n.li,{children:"Stop the OIBus service."}),"\n",(0,i.jsx)(n.li,{children:"Copy and paste the content of the zip file into the OIBus executable folder. Overwrite all existing files."}),"\n",(0,i.jsx)(n.li,{children:"Start the OIBus service."}),"\n"]}),"\n",(0,i.jsxs)(n.p,{children:["The configuration file ",(0,i.jsx)(n.code,{children:"oibus.json"})," will be updated to its latest version during the first startup."]})]})}function c(e={}){const{wrapper:n}={...(0,a.R)(),...e.components};return n?(0,i.jsx)(n,{...e,children:(0,i.jsx)(d,{...e})}):d(e)}function u(e){const n={a:"a",code:"code",h2:"h2",p:"p",pre:"pre",...(0,a.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)("div",{style:{display:"flex",justifyContent:"space-around"},children:(0,i.jsx)(o.A,{link:"https://github.com/OptimistikSAS/OIBus/releases/download/v2.11.0/oibus-linux.tar.gz",children:(0,i.jsxs)("div",{children:[(0,i.jsx)("div",{children:"OIBus v2.11"}),(0,i.jsx)("div",{children:"Linux (x64)"})]})})}),"\n",(0,i.jsx)(n.p,{children:"To install or update OIBus, you should run the installation script. To do that, you may either download from the above\nbutton and unzip the downloaded file, or use the following cURL or Wget command:"}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:"curl -o- -L https://github.com/OptimistikSAS/OIBus/releases/download/v2.11.0/oibus-linux.tar.gz | tar -xzv\n"})}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:"wget -c https://github.com/OptimistikSAS/OIBus/releases/download/v2.11.0/oibus-linux.tar.gz -O - | tar -xzv\n"})}),"\n",(0,i.jsx)(n.p,{children:"The following files have been extracted:"}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:"default-config.json     // default configuration that will be updated during the installation process\noibus                   // OIBus binary\noibus-setup.sh          // installation script\noibus-uninstall.sh      // uninstallation script that will be updated during the installation process\n"})}),"\n",(0,i.jsxs)(n.p,{children:["Bash scripts have been tested on Ubuntu. They interact with the user to fill the first OIBus configuration, and set OIBus\nas a service. Alternatively, it is possible to ",(0,i.jsx)(n.a,{href:"#run-oibus-in-standalone",children:"run OIBus binary only"}),"."]}),"\n",(0,i.jsx)(n.h2,{id:"installation-of-oibus-as-a-linux-service",children:"Installation of OIBus as a Linux service"}),"\n",(0,i.jsx)(n.p,{children:"The installation script can be run with the following command. The admin rights will que required during the script execution."}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:"./oibus-setup.sh\n"})}),"\n",(0,i.jsx)(n.p,{children:"The following questions will be asked during the installation (default answers have been kept in this example):"}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:"Administrative permissions are required to proceed. Do you wish to continue? (Y/n)\nAdministrative permissions granted.\nEnter the directory in which you want to install the OIBus binary (default: ./OIBus/):\nEnter the directory in which you want to save all your OIBus related data, caches, and logs (default: ./OIBusData/):\nEnter a username for your session. It will be used every time you log into OIBus (default: admin):\nEnter a name for your OIBus. It will help to identify your OIBus, and assist in potential troubleshooting (default: OIBus):\nEnter the port on which you want OIBus to run (default 2223):\nInstalling oibus service...\nService file successfully created. Enabling oibus service startup on system boot...\nCreated symlink /etc/systemd/system/default.target.wants/oibus.service \u2192 /etc/systemd/system/oibus.service.\nStarting OIBus service...\nSetting oibus-uninstall.sh...\nInstallation procedure completed !\n\nUseful commands:\n        Check service status:   sudo systemctl status oibus\n        Check service-logs:     sudo journalctl -u oibus -f\n\nAccess OIBus: http://localhost:2223/\n"})}),"\n",(0,i.jsx)(n.h2,{id:"update",children:"Update"}),"\n",(0,i.jsx)(n.p,{children:"To update OIBus, download the latest version, unzip the archive and run the setup install:"}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:"./oibus-setup.sh\n"})}),"\n",(0,i.jsx)(n.p,{children:"During the installation process, fill the OIBus directory and OIBus data directory with the already existing directories.\nAt start, OIBus will automatically update the configuration file (oibus.json) and the cache structure if needed. Here is\nan output example, the default values:"}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:"Administrative permissions are required to proceed. Do you wish to continue? (Y/n)\nAdministrative permissions granted.\nEnter the directory in which you want to install the OIBus binary (default: ./OIBus/):\nEnter the directory in which you want to save all your OIBus related data, caches, and logs (default: ./OIBusData/):\nAn oibus.json file was found. Do you want to use it for this OIBus? (Y/n)\nStopping oibus service...\nRemoved /etc/systemd/system/default.target.wants/oibus.service.\nThe oibus service has been stopped and disabled!\nInstalling oibus service...\nService file successfully created. Enabling oibus service startup on system boot...\nCreated symlink /etc/systemd/system/default.target.wants/oibus.service \u2192 /etc/systemd/system/oibus.service.\nStarting OIBus service...\nSetting oibus-uninstall.sh...\nInstallation procedure completed !\n\nUseful commands:\n        Check service status:   sudo systemctl status oibus\n        Check service-logs:     sudo journalctl -u oibus -f\n"})}),"\n",(0,i.jsx)(n.h2,{id:"uninstall-oibus",children:"Uninstall OIBus"}),"\n",(0,i.jsx)(n.p,{children:"An uninstallation script has been created in the OIBus binary folder. Once in this folder, enter the following command:"}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:"oibus-uninstall.sh\n"})}),"\n",(0,i.jsx)(n.p,{children:"Here is an output example:"}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:"Administrative permissions are required to proceed with uninstall. Do you wish to continue ? (Y/n)\nAdministrative permissions granted.\nDo you wish to remove all OIBus data (cache, logs...)? All data, credentials and logs about your current OIBus will be permanently erased. (y/N) y\nRemoved /etc/systemd/system/default.target.wants/oibus.service.\nOIBus service was successfully removed.\n"})}),"\n",(0,i.jsx)(n.p,{children:"By default, the data are kept if you want to reinstall OIBus later. You can remove them, but you will lose all credentials\nand the whole OIBus configuration."}),"\n",(0,i.jsx)(n.h2,{id:"run-oibus-in-standalone",children:"Run OIBus in standalone"}),"\n",(0,i.jsx)(n.p,{children:"If you want to run OIBus without installing it as a service, once the archive downloaded and unzipped, you can run\nthe following command:"}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:"./oibus --config ./OIBusData/oibus.json\n"})}),"\n",(0,i.jsxs)(n.p,{children:["Make sure the OIBusData folder already exists. The cache, logs and configuration files are stored in this folder (in the\nexample ",(0,i.jsx)(n.code,{children:"OIBusData"}),")."]})]})}function h(e={}){const{wrapper:n}={...(0,a.R)(),...e.components};return n?(0,i.jsx)(n,{...e,children:(0,i.jsx)(u,{...e})}):u(e)}var p=s(8069);function x(e){const n={a:"a",admonition:"admonition",code:"code",p:"p",...(0,a.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)("div",{style:{display:"flex",justifyContent:"space-around"},children:(0,i.jsx)(o.A,{link:"https://github.com/OptimistikSAS/OIBus/releases/download/v2.11.0/oibus-macos.zip",children:(0,i.jsxs)("div",{children:[(0,i.jsx)("div",{children:"OIBus v2.11"}),(0,i.jsx)("div",{children:"MacOS (Intel chip)"})]})})}),"\n",(0,i.jsx)(n.admonition,{type:"caution",children:(0,i.jsxs)(n.p,{children:["Apple chip Mac (M1) are not supported yet with binaries. However, it is possible to start OIBus from the\n",(0,i.jsx)(n.a,{href:"https://github.com/OptimistikSAS/OIBus",children:"source code"}),"!"]})}),"\n",(0,i.jsx)(n.p,{children:"MacOS OIBus binary can be run through its executable. Once unzipped, start a Terminal and enter the following command:"}),"\n",(0,i.jsx)(p.A,{children:"./oibus --config ./oibus.json"}),"\n",(0,i.jsxs)(n.p,{children:["The ",(0,i.jsx)(n.code,{children:"./oibus.json"})," file path must be adapted according to the place where the OIBus cache and config will be stored."]}),"\n",(0,i.jsxs)(n.p,{children:["For example, if the binary is stored in ",(0,i.jsx)(n.code,{children:"/bin/"})," and the cache and configuration files are stored in\n",(0,i.jsx)(n.code,{children:"~/test/oibus-data"}),", the command will be:"]}),"\n",(0,i.jsx)(p.A,{children:"/bin/oibus --config ~/test/oibus-data/oibus.json"}),"\n",(0,i.jsx)(n.admonition,{type:"caution",children:(0,i.jsx)(n.p,{children:"Be sure to have admin permissions to run the binary"})})]})}function f(e={}){const{wrapper:n}={...(0,a.R)(),...e.components};return n?(0,i.jsx)(n,{...e,children:(0,i.jsx)(x,{...e})}):x(e)}const m={sidebar_position:2},b="Installation",g={},j=[{value:"Requirements",id:"requirements",level:2},{value:"Installation steps",id:"installation-steps",level:2},{value:"Installation",id:"installation",level:2},{value:"With the Windows Installer",id:"with-the-windows-installer",level:3},{value:"Update",id:"update",level:2},{value:"With the Windows Installer",id:"with-the-windows-installer-1",level:3},{value:"With binaries",id:"with-binaries",level:3},{value:"Installation of OIBus as a Linux service",id:"installation-of-oibus-as-a-linux-service",level:2},{value:"Update",id:"update",level:2},{value:"Uninstall OIBus",id:"uninstall-oibus",level:2},{value:"Run OIBus in standalone",id:"run-oibus-in-standalone",level:2},{value:"Access OIBus interface",id:"access-oibus-interface",level:2}];function v(e){const n={a:"a",admonition:"admonition",code:"code",em:"em",h1:"h1",h2:"h2",header:"header",li:"li",p:"p",strong:"strong",ul:"ul",...(0,a.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(n.header,{children:(0,i.jsx)(n.h1,{id:"installation",children:"Installation"})}),"\n",(0,i.jsx)(n.p,{children:"Let's install OIBus in less than 2 minutes."}),"\n",(0,i.jsx)(n.h2,{id:"requirements",children:"Requirements"}),"\n",(0,i.jsx)(n.p,{children:"To operate, OIBus must be installed on an environment with the following minimum characteristics:"}),"\n",(0,i.jsxs)(n.ul,{children:["\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"64 bits architecture"}),". 32bits and ARM architectures are not supported."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"RAM: 2GB minimum"}),". OIBus may require more RAM depending on the configuration of South and North connectors."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Disk space: 200 MB"}),". For the application. It is however recommended to have extra space (several GB, depending on\nyour data stream) to store the collected data in the cache if an upstream network failure occurs."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Admin rights"})," on the environment to install OIBus and register it as a service (for Windows and Linux)."]}),"\n",(0,i.jsxs)(n.li,{children:[(0,i.jsx)(n.strong,{children:"Modern web browser"})," (IE not supported). Used to access the OIBus configuration interface. The browser can be on the\ntargeted computer or on another, provided you have configured the ",(0,i.jsx)(n.a,{href:"/docs/v2/guide/engine/access",children:"necessary access"}),"."]}),"\n"]}),"\n",(0,i.jsx)(n.h2,{id:"installation-steps",children:"Installation steps"}),"\n",(0,i.jsxs)(r.A,{children:[(0,i.jsx)(l.A,{value:"windows",label:"Windows x64",default:!0,children:(0,i.jsx)(c,{})}),(0,i.jsx)(l.A,{value:"linux",label:"Linux",children:(0,i.jsx)(h,{})}),(0,i.jsx)(l.A,{value:"macos",label:"MacOS",children:(0,i.jsx)(f,{})})]}),"\n",(0,i.jsx)(n.h2,{id:"access-oibus-interface",children:"Access OIBus interface"}),"\n",(0,i.jsxs)(n.p,{children:["OIBus configuration interface is available on ",(0,i.jsx)(n.code,{children:"http://localhost:2223"})," (assuming the default port has been kept)."]}),"\n",(0,i.jsxs)(n.admonition,{title:"Default access",type:"caution",children:[(0,i.jsxs)(n.p,{children:["By default, the user is ",(0,i.jsx)(n.strong,{children:"admin"})," and the password is ",(0,i.jsx)(n.strong,{children:"pass"}),"."]}),(0,i.jsx)(n.p,{children:"We strongly advise to change the password in the Engines settings."})]}),"\n",(0,i.jsxs)(n.p,{children:["When installing OIBus, remember to choose an appropriate name. The ",(0,i.jsx)(n.em,{children:"Engine name"})," is important mainly if you use several\nOIBus and send the logs to a remote ",(0,i.jsx)(n.a,{href:"/docs/v2/guide/engine/logging-parameters#loki",children:"loki instance"}),"."]})]})}function w(e={}){const{wrapper:n}={...(0,a.R)(),...e.components};return n?(0,i.jsx)(n,{...e,children:(0,i.jsx)(v,{...e})}):v(e)}},9329:(e,n,s)=>{s.d(n,{A:()=>r});s(6540);var t=s(4164);const i={tabItem:"tabItem_Ymn6"};var a=s(4848);function r(e){let{children:n,hidden:s,className:r}=e;return(0,a.jsx)("div",{role:"tabpanel",className:(0,t.A)(i.tabItem,r),hidden:s,children:n})}},5537:(e,n,s)=>{s.d(n,{A:()=>y});var t=s(6540),i=s(4164),a=s(5627),r=s(6347),l=s(372),o=s(604),d=s(1861),c=s(8749);function u(e){return t.Children.toArray(e).filter((e=>"\n"!==e)).map((e=>{if(!e||(0,t.isValidElement)(e)&&function(e){const{props:n}=e;return!!n&&"object"==typeof n&&"value"in n}(e))return e;throw new Error(`Docusaurus error: Bad <Tabs> child <${"string"==typeof e.type?e.type:e.type.name}>: all children of the <Tabs> component should be <TabItem>, and every <TabItem> should have a unique "value" prop.`)}))?.filter(Boolean)??[]}function h(e){const{values:n,children:s}=e;return(0,t.useMemo)((()=>{const e=n??function(e){return u(e).map((e=>{let{props:{value:n,label:s,attributes:t,default:i}}=e;return{value:n,label:s,attributes:t,default:i}}))}(s);return function(e){const n=(0,d.XI)(e,((e,n)=>e.value===n.value));if(n.length>0)throw new Error(`Docusaurus error: Duplicate values "${n.map((e=>e.value)).join(", ")}" found in <Tabs>. Every value needs to be unique.`)}(e),e}),[n,s])}function p(e){let{value:n,tabValues:s}=e;return s.some((e=>e.value===n))}function x(e){let{queryString:n=!1,groupId:s}=e;const i=(0,r.W6)(),a=function(e){let{queryString:n=!1,groupId:s}=e;if("string"==typeof n)return n;if(!1===n)return null;if(!0===n&&!s)throw new Error('Docusaurus error: The <Tabs> component groupId prop is required if queryString=true, because this value is used as the search param name. You can also provide an explicit value such as queryString="my-search-param".');return s??null}({queryString:n,groupId:s});return[(0,o.aZ)(a),(0,t.useCallback)((e=>{if(!a)return;const n=new URLSearchParams(i.location.search);n.set(a,e),i.replace({...i.location,search:n.toString()})}),[a,i])]}function f(e){const{defaultValue:n,queryString:s=!1,groupId:i}=e,a=h(e),[r,o]=(0,t.useState)((()=>function(e){let{defaultValue:n,tabValues:s}=e;if(0===s.length)throw new Error("Docusaurus error: the <Tabs> component requires at least one <TabItem> children component");if(n){if(!p({value:n,tabValues:s}))throw new Error(`Docusaurus error: The <Tabs> has a defaultValue "${n}" but none of its children has the corresponding value. Available values are: ${s.map((e=>e.value)).join(", ")}. If you intend to show no default tab, use defaultValue={null} instead.`);return n}const t=s.find((e=>e.default))??s[0];if(!t)throw new Error("Unexpected error: 0 tabValues");return t.value}({defaultValue:n,tabValues:a}))),[d,u]=x({queryString:s,groupId:i}),[f,m]=function(e){let{groupId:n}=e;const s=function(e){return e?`docusaurus.tab.${e}`:null}(n),[i,a]=(0,c.Dv)(s);return[i,(0,t.useCallback)((e=>{s&&a.set(e)}),[s,a])]}({groupId:i}),b=(()=>{const e=d??f;return p({value:e,tabValues:a})?e:null})();(0,l.A)((()=>{b&&o(b)}),[b]);return{selectedValue:r,selectValue:(0,t.useCallback)((e=>{if(!p({value:e,tabValues:a}))throw new Error(`Can't select invalid tab value=${e}`);o(e),u(e),m(e)}),[u,m,a]),tabValues:a}}var m=s(9136);const b={tabList:"tabList__CuJ",tabItem:"tabItem_LNqP"};var g=s(4848);function j(e){let{className:n,block:s,selectedValue:t,selectValue:r,tabValues:l}=e;const o=[],{blockElementScrollPositionUntilNextRender:d}=(0,a.a_)(),c=e=>{const n=e.currentTarget,s=o.indexOf(n),i=l[s].value;i!==t&&(d(n),r(i))},u=e=>{let n=null;switch(e.key){case"Enter":c(e);break;case"ArrowRight":{const s=o.indexOf(e.currentTarget)+1;n=o[s]??o[0];break}case"ArrowLeft":{const s=o.indexOf(e.currentTarget)-1;n=o[s]??o[o.length-1];break}}n?.focus()};return(0,g.jsx)("ul",{role:"tablist","aria-orientation":"horizontal",className:(0,i.A)("tabs",{"tabs--block":s},n),children:l.map((e=>{let{value:n,label:s,attributes:a}=e;return(0,g.jsx)("li",{role:"tab",tabIndex:t===n?0:-1,"aria-selected":t===n,ref:e=>{o.push(e)},onKeyDown:u,onClick:c,...a,className:(0,i.A)("tabs__item",b.tabItem,a?.className,{"tabs__item--active":t===n}),children:s??n},n)}))})}function v(e){let{lazy:n,children:s,selectedValue:a}=e;const r=(Array.isArray(s)?s:[s]).filter(Boolean);if(n){const e=r.find((e=>e.props.value===a));return e?(0,t.cloneElement)(e,{className:(0,i.A)("margin-top--md",e.props.className)}):null}return(0,g.jsx)("div",{className:"margin-top--md",children:r.map(((e,n)=>(0,t.cloneElement)(e,{key:n,hidden:e.props.value!==a})))})}function w(e){const n=f(e);return(0,g.jsxs)("div",{className:(0,i.A)("tabs-container",b.tabList),children:[(0,g.jsx)(j,{...n,...e}),(0,g.jsx)(v,{...n,...e})]})}function y(e){const n=(0,m.A)();return(0,g.jsx)(w,{...e,children:u(e.children)},String(n))}},5095:(e,n,s)=>{s.d(n,{A:()=>l});s(6540);var t=s(5556),i=s.n(t),a=s(4848);const r=e=>{let{children:n,link:s,color:t}=e;return(0,a.jsx)("div",{style:{marginBottom:"20px",marginTop:"10px",textAlign:"center"},children:(0,a.jsx)("a",{rel:"nofollow",href:s,style:{backgroundColor:t,borderRadius:"10px",color:"#f5f5f5",padding:"10px",cursor:"pointer",minWidth:"10rem",textAlign:"center",display:"flex",justifyContent:"space-around"},children:n})})};r.propTypes={link:i().string.isRequired,color:i().string,children:i().object.isRequired},r.defaultProps={color:"#009ee0"};const l=r},1228:(e,n,s)=>{s.d(n,{A:()=>t});const t=s.p+"assets/images/1-e02d4d62d4db9bcee0b6f48af448f252.png"},9959:(e,n,s)=>{s.d(n,{A:()=>t});const t=s.p+"assets/images/2-46a039c0ccef22ae4447c6bd02d9d7ab.png"},6318:(e,n,s)=>{s.d(n,{A:()=>t});const t=s.p+"assets/images/3-5eab335ae60ff157b472af391cbaac6b.png"},3057:(e,n,s)=>{s.d(n,{A:()=>t});const t=s.p+"assets/images/4-cb2a10cebe15bfc50ee53da41d4f53b1.png"},344:(e,n,s)=>{s.d(n,{A:()=>t});const t=s.p+"assets/images/5-03891d75c03fd959ef5be5b741ebbab6.png"},4835:(e,n,s)=>{s.d(n,{A:()=>t});const t=s.p+"assets/images/6-bb5ab7500b1688a4812b65f730e19e38.png"}}]);