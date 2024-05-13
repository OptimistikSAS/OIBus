"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[3671],{6310:(e,i,n)=>{n.r(i),n.d(i,{assets:()=>l,contentTitle:()=>a,default:()=>p,frontMatter:()=>c,metadata:()=>d,toc:()=>h});var r=n(4848),s=n(8453),o=n(1432),t=n(8330);const c={displayed_sidebar:"developerSidebar",sidebar_position:4},a="OIBus with Docker",d={id:"developer/docker",title:"OIBus with Docker",description:"OIBus can be incorporated into a Docker image.",source:"@site/i18n/zh/docusaurus-plugin-content-docs/current/developer/docker.mdx",sourceDirName:"developer",slug:"/developer/docker",permalink:"/zh/docs/developer/docker",draft:!1,unlisted:!1,tags:[],version:"current",sidebarPosition:4,frontMatter:{displayed_sidebar:"developerSidebar",sidebar_position:4},sidebar:"developerSidebar",previous:{title:"Connector class",permalink:"/zh/docs/developer/create-connector/class"}},l={},h=[{value:"Docker image",id:"docker-image",level:2},{value:"Init script",id:"init-script",level:3},{value:"Dockerfile",id:"dockerfile",level:3},{value:"Docker commands",id:"docker-commands",level:3},{value:"Build the docker image",id:"build-the-docker-image",level:4},{value:"Build the docker image with specific architecture and version",id:"build-the-docker-image-with-specific-architecture-and-version",level:4},{value:"Run a container",id:"run-a-container",level:4},{value:"Specific settings in Docker",id:"specific-settings-in-docker",level:2},{value:"Web and proxy server port",id:"web-and-proxy-server-port",level:3},{value:"IP filters",id:"ip-filters",level:3},{value:"Curl command",id:"curl-command",level:4},{value:"Bash script",id:"bash-script",level:4}];function u(e){const i={a:"a",admonition:"admonition",code:"code",em:"em",h1:"h1",h2:"h2",h3:"h3",h4:"h4",li:"li",p:"p",pre:"pre",ul:"ul",...(0,s.R)(),...e.components};return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(i.h1,{id:"oibus-with-docker",children:"OIBus with Docker"}),"\n",(0,r.jsx)(i.p,{children:"OIBus can be incorporated into a Docker image."}),"\n",(0,r.jsx)(i.h2,{id:"docker-image",children:"Docker image"}),"\n",(0,r.jsx)(i.p,{children:"The image below takes two optional parameters:"}),"\n",(0,r.jsxs)(i.ul,{children:["\n",(0,r.jsx)(i.li,{children:"arch (default: x64)"}),"\n",(0,r.jsx)(i.li,{children:"version"}),"\n"]}),"\n",(0,r.jsx)(i.p,{children:"This facilitates the generation of a Docker image featuring a specific version and architecture of OIBus."}),"\n",(0,r.jsx)(i.p,{children:"To construct a Docker image, two files are required:"}),"\n",(0,r.jsxs)(i.ul,{children:["\n",(0,r.jsx)(i.li,{children:"The initialization script, used for executing certain curl commands from within the container (or none if the file is empty)."}),"\n",(0,r.jsx)(i.li,{children:"The Dockerfile, used for building the image containing the OIBus binaries."}),"\n"]}),"\n",(0,r.jsx)(i.h3,{id:"init-script",children:"Init script"}),"\n",(0,r.jsxs)(i.p,{children:["This image necessitates an ",(0,r.jsx)(i.code,{children:"oibus-init.sh"})," script to dispatch ",(0,r.jsx)(i.em,{children:"curl"})," commands to OIBus endpoints. If you opt not to\nincorporate this file, you'll have to execute a ",(0,r.jsxs)(i.a,{href:"#curl-command",children:[(0,r.jsx)(i.em,{children:"curl"})," command"]})," from within the Docker manually."]}),"\n",(0,r.jsx)(i.pre,{children:(0,r.jsx)(i.code,{className:"language-bash",metastring:'title="oibus-init.sh"',children:'#!/bin/bash\n\ncurl --location --request POST \'http://localhost:2223/api/ip-filters\' \\\n--header \'Content-Type: application/json\' \\\n--data-raw \'{\n    "address": "*",\n    "description": "All"\n}\' \\\n-u "admin:pass"\n'})}),"\n",(0,r.jsx)(i.h3,{id:"dockerfile",children:"Dockerfile"}),"\n",(0,r.jsx)(o.A,{children:`\n  FROM ubuntu\n\n  ARG arch="x64"\n  ARG version="v${t.rE}"\n\n  # Install git\n  RUN apt update -y && apt install -y curl unzip\n\n  # Create app directory\n  WORKDIR /app\n\n  RUN curl -LO https://github.com/OptimistikSAS/OIBus/releases/download/\${version}/oibus-linux_\${arch}-\${version}.zip\n  RUN unzip -a oibus-linux_\${arch}-\${version}.zip -d OIBus/\n  WORKDIR /app/OIBus\n  COPY ./oibus-init.sh .\n  RUN mkdir OIBusData\n\n  # Expose port 2223 for OIBus\n  EXPOSE 2223\n\n  # Start OIBus\n  CMD ["./oibus-launcher", "--config", "./OIBusData"]\n`}),"\n",(0,r.jsx)(i.h3,{id:"docker-commands",children:"Docker commands"}),"\n",(0,r.jsx)(i.p,{children:"To execute the following commands, ensure that you are in the directory that contains the Dockerfile image."}),"\n",(0,r.jsx)(i.h4,{id:"build-the-docker-image",children:"Build the docker image"}),"\n",(0,r.jsx)(o.A,{children:"docker build -t oibus ."}),"\n",(0,r.jsx)(i.h4,{id:"build-the-docker-image-with-specific-architecture-and-version",children:"Build the docker image with specific architecture and version"}),"\n",(0,r.jsx)(o.A,{children:'docker build -t oibus --build-arg arch="arm64" --build-arg version="v3.3.2" .'}),"\n",(0,r.jsx)(i.h4,{id:"run-a-container",children:"Run a container"}),"\n",(0,r.jsx)(o.A,{children:'docker run --name oibus -d -p 2223:2223 -v "./OIBusData:/app/OIBus/OIBusData" oibus'}),"\n",(0,r.jsx)(i.admonition,{title:"Docker volume",type:"tip",children:(0,r.jsx)(i.p,{children:"The volume is not mandatory, but can be useful to access cache, logs, configuration database..."})}),"\n",(0,r.jsx)(i.h2,{id:"specific-settings-in-docker",children:"Specific settings in Docker"}),"\n",(0,r.jsx)(i.h3,{id:"web-and-proxy-server-port",children:"Web and proxy server port"}),"\n",(0,r.jsxs)(i.p,{children:["When using OIBus within a container, the default HTTP port 2223 is exposed. If you wish to access OIBus from a different\nport, you can modify the ",(0,r.jsx)(i.a,{href:"#docker-commands",children:"docker run"})," command accordingly."]}),"\n",(0,r.jsx)(i.admonition,{title:"OIBus port",type:"danger",children:(0,r.jsx)(i.p,{children:"Do not change the HTTP port from the OIBus configuration. You will not be able to access the web page again if you\nchange it."})}),"\n",(0,r.jsx)(i.admonition,{title:"OIBus proxy server",type:"tip",children:(0,r.jsxs)(i.p,{children:["If you want to use OIBus as a proxy server, you need to update the ",(0,r.jsx)(i.code,{children:"docker run"})," command to expose the port on which the\nproxy server listens to."]})}),"\n",(0,r.jsx)(i.h3,{id:"ip-filters",children:"IP filters"}),"\n",(0,r.jsxs)(i.p,{children:["By default, OIBus accepts connections only from localhost by ",(0,r.jsx)(i.a,{href:"/zh/docs/guide/engine/ip-filters",children:"filtering IP"}),". When inside\na docker, the IP filter list must be updated."]}),"\n",(0,r.jsx)(i.p,{children:"You can either use the curl command or the init bash script."}),"\n",(0,r.jsx)(i.h4,{id:"curl-command",children:"Curl command"}),"\n",(0,r.jsx)(i.pre,{children:(0,r.jsx)(i.code,{children:'docker exec -it oibus curl --location --request POST \'http://localhost:2223/api/ip-filters\' \\\n--header \'Content-Type: application/json\' \\\n--data-raw \'{\n    "address": "*",\n    "description": "All"\n}\' \\\n-u "admin:pass"\n\n'})}),"\n",(0,r.jsx)(i.h4,{id:"bash-script",children:"Bash script"}),"\n",(0,r.jsx)(i.p,{children:(0,r.jsx)(i.code,{children:"docker exec -it oibus ./oibus-init.sh"})})]})}function p(e={}){const{wrapper:i}={...(0,s.R)(),...e.components};return i?(0,r.jsx)(i,{...e,children:(0,r.jsx)(u,{...e})}):u(e)}},8330:e=>{e.exports={rE:"3.3.4"}}}]);