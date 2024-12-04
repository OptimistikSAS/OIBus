"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[4363],{7119:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>d,contentTitle:()=>i,default:()=>h,frontMatter:()=>s,metadata:()=>c,toc:()=>l});var o=t(4848),r=t(8453);const s={displayed_sidebar:"developerSidebar",sidebar_position:1},i="OIBus developer handbook",c={id:"developer/index",title:"OIBus developer handbook",description:"Steps to try out the application",source:"@site/versioned_docs/version-v2/developer/index.md",sourceDirName:"developer",slug:"/developer/",permalink:"/docs/v2/developer/",draft:!1,unlisted:!1,tags:[],version:"v2",sidebarPosition:1,frontMatter:{displayed_sidebar:"developerSidebar",sidebar_position:1},sidebar:"developerSidebar",next:{title:"Certificates",permalink:"/docs/v2/developer/certificates"}},d={},l=[{value:"Steps to try out the application",id:"steps-to-try-out-the-application",level:2},{value:"Run database servers",id:"run-database-servers",level:2},{value:"Commit and branch naming conventions",id:"commit-and-branch-naming-conventions",level:2}];function a(e){const n={a:"a",code:"code",h1:"h1",h2:"h2",li:"li",p:"p",strong:"strong",ul:"ul",...(0,r.R)(),...e.components};return(0,o.jsxs)(o.Fragment,{children:[(0,o.jsx)(n.h1,{id:"oibus-developer-handbook",children:"OIBus developer handbook"}),"\n",(0,o.jsx)(n.h2,{id:"steps-to-try-out-the-application",children:"Steps to try out the application"}),"\n",(0,o.jsxs)(n.ul,{children:["\n",(0,o.jsxs)(n.li,{children:["Clone the repository : ",(0,o.jsx)(n.code,{children:"git clone "})]}),"\n",(0,o.jsxs)(n.li,{children:["Run command ",(0,o.jsx)(n.code,{children:"npm install"})," in project root"]}),"\n",(0,o.jsxs)(n.li,{children:["Run command ",(0,o.jsx)(n.code,{children:"npm run internal:build:web-client"}),". It will create a ",(0,o.jsx)(n.code,{children:"build/web-client"})," folder for the frontend bundle. If you edit\nthe frontend and want to auto-recompile the bundle, you can instead use the command ",(0,o.jsx)(n.code,{children:"npm run watch:web-client"}),"."]}),"\n",(0,o.jsxs)(n.li,{children:["Run command ",(0,o.jsx)(n.code,{children:"npm start"})," (this will start both the backend and frontend)"]}),"\n",(0,o.jsxs)(n.li,{children:["Open up in the browser the following url: ",(0,o.jsx)(n.code,{children:"http://localhost:2223"}),". The port is specified in the ",(0,o.jsx)(n.code,{children:"default-config.json"}),"\nfile (currently 2223 is the default port, it can be changed locally in your own config file generated at project startup)"]}),"\n"]}),"\n",(0,o.jsxs)(n.p,{children:["The folder ",(0,o.jsx)(n.code,{children:"data-folder"})," is used to store the cache, logs and configuration files."]}),"\n",(0,o.jsxs)(n.p,{children:["The project is up and running, but currently there are no South or North connectors. A simple way to try out OIBus is\nto create a ",(0,o.jsx)(n.code,{children:"FolderScanner"})," South connector and a ",(0,o.jsx)(n.code,{children:"Console"})," North connector."]}),"\n",(0,o.jsx)(n.h2,{id:"run-database-servers",children:"Run database servers"}),"\n",(0,o.jsxs)(n.p,{children:["With the help of the ",(0,o.jsx)(n.code,{children:"tests/docker-compose.yml"})," file, we can run a few databases with the following command:"]}),"\n",(0,o.jsx)(n.p,{children:(0,o.jsx)(n.code,{children:"npm run test:setup-env"})}),"\n",(0,o.jsxs)(n.p,{children:["The following services will start: ",(0,o.jsx)(n.strong,{children:"mysql, mssql, postgresql"}),".\nIf you want to change the credentials or the ports for the services, you can create your own ",(0,o.jsx)(n.code,{children:".env"})," file that won't be\npushed to the repository. Note that in this case you will need to replace the environment file path to ",(0,o.jsx)(n.code,{children:"./.env"})," in the\ncommand above (",(0,o.jsx)(n.code,{children:"package.json"}),")."]}),"\n",(0,o.jsx)(n.h2,{id:"commit-and-branch-naming-conventions",children:"Commit and branch naming conventions"}),"\n",(0,o.jsxs)(n.p,{children:["The default branch is ",(0,o.jsx)(n.code,{children:"main"}),", every new branches should be created from here."]}),"\n",(0,o.jsxs)(n.p,{children:["Branch naming convention: ",(0,o.jsx)(n.strong,{children:"descriptive-name-of-the-issue#<issue-number>"})]}),"\n",(0,o.jsxs)(n.p,{children:["For example: ",(0,o.jsx)(n.code,{children:"fix-folder-scanner-path#1564"})]}),"\n",(0,o.jsxs)(n.p,{children:["Commits and PR name convention must follow the ",(0,o.jsx)(n.a,{href:"https://www.conventionalcommits.org/en/v1.0.0/",children:"conventional commits standard"})]})]})}function h(e={}){const{wrapper:n}={...(0,r.R)(),...e.components};return n?(0,o.jsx)(n,{...e,children:(0,o.jsx)(a,{...e})}):a(e)}},8453:(e,n,t)=>{t.d(n,{R:()=>i,x:()=>c});var o=t(6540);const r={},s=o.createContext(r);function i(e){const n=o.useContext(s);return o.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function c(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:i(e.components),o.createElement(s.Provider,{value:n},e.children)}}}]);