"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[2256],{8481:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>l,contentTitle:()=>o,default:()=>u,frontMatter:()=>s,metadata:()=>r,toc:()=>c});var a=t(4848),i=t(8453);const s={sidebar_position:5},o="External sources and endpoints",r={id:"guide/engine/external-sources",title:"External sources and endpoints",description:"External source",source:"@site/docs/guide/engine/external-sources.md",sourceDirName:"guide/engine",slug:"/guide/engine/external-sources",permalink:"/docs/guide/engine/external-sources",draft:!1,unlisted:!1,tags:[],version:"current",sidebarPosition:5,frontMatter:{sidebar_position:5},sidebar:"guideSidebar",previous:{title:"IP Filters",permalink:"/docs/guide/engine/ip-filters"},next:{title:"Certificates",permalink:"/docs/guide/engine/certificates"}},l={},c=[{value:"External source",id:"external-source",level:2},{value:"OIBus data endpoints",id:"oibus-data-endpoints",level:2},{value:"Data from another application",id:"data-from-another-application",level:2},{value:"JSON payload",id:"json-payload",level:3},{value:"File payload",id:"file-payload",level:3}];function d(e){const n={code:"code",h1:"h1",h2:"h2",h3:"h3",li:"li",p:"p",pre:"pre",ul:"ul",...(0,i.R)(),...e.components};return(0,a.jsxs)(a.Fragment,{children:[(0,a.jsx)(n.h1,{id:"external-sources-and-endpoints",children:"External sources and endpoints"}),"\n",(0,a.jsx)(n.h2,{id:"external-source",children:"External source"}),"\n",(0,a.jsx)(n.p,{children:"An external source refers to a remote entity that transmits data to OIBus endpoints through HTTP requests. This functionality\nenables other applications to send data to OIBus without configuring South connectors."}),"\n",(0,a.jsx)(n.p,{children:"North connectors have the capability to subscribe to either South connectors or external sources to retrieve data from\nthese sources. However, if an external source is not defined within OIBus, any incoming data from that source will be\ndisregarded to prevent cache saturation."}),"\n",(0,a.jsxs)(n.p,{children:["To register an external source, simply provide its name, which will be used as the query parameter ",(0,a.jsx)(n.code,{children:"name"}),", as shown below.\nWhile optional, adding a description can be beneficial to provide context regarding the purpose of this external source."]}),"\n",(0,a.jsx)(n.h2,{id:"oibus-data-endpoints",children:"OIBus data endpoints"}),"\n",(0,a.jsx)(n.p,{children:"OIBus has the capability to receive data through two distinct endpoints:"}),"\n",(0,a.jsxs)(n.ul,{children:["\n",(0,a.jsxs)(n.li,{children:["POST ",(0,a.jsx)(n.code,{children:"/api/add-values"}),": This endpoint is used to accept values in JSON format within the payload. It utilizes basic authentication for security."]}),"\n",(0,a.jsxs)(n.li,{children:["POST ",(0,a.jsx)(n.code,{children:"/api/add-file"}),": Here, data is received in the form of files using HTTP form-data. Basic authentication is also required for this endpoint."]}),"\n"]}),"\n",(0,a.jsxs)(n.p,{children:["Both of these endpoints necessitate the inclusion of the query parameter ",(0,a.jsx)(n.code,{children:"name"}),", which specifies the external source\nassociated with the data. The OIBus engine processes this data and stores it within the North caches that are subscribed\nto the specified external source."]}),"\n",(0,a.jsx)(n.h2,{id:"data-from-another-application",children:"Data from another application"}),"\n",(0,a.jsx)(n.h3,{id:"json-payload",children:"JSON payload"}),"\n",(0,a.jsx)(n.p,{children:"To transmit data to OIBus using a JSON payload, you can make an HTTP request with the following payload:"}),"\n",(0,a.jsx)(n.pre,{children:(0,a.jsx)(n.code,{className:"language-json",metastring:"title=Payload example",children:'[\n    {\n        "timestamp": "2023-01-01T00:00:00.000Z",\n        "pointId": "my reference",\n        "data": {\n            "value": 1234\n        }\n    },\n    {\n        "timestamp": "2023-01-01T10:00:00.000Z",\n        "pointId": "another reference",\n        "data": {\n            "value": 456\n        }\n    }\n]\n'})}),"\n",(0,a.jsx)(n.pre,{children:(0,a.jsx)(n.code,{className:"language-curl",metastring:'title="curl command"',children:'curl --location \'http://localhost:2223/api/add-values?name=%27test%27\' \\\n--header \'Content-Type: application/json\' \\\n-u <username>:<password> \\\n--data \'[\n    {\n        "timestamp": "2023-01-01T00:00:00.000Z",\n        "pointId": "my reference",\n        "data": {\n            "value": 1234\n        }\n    },\n    {\n        "timestamp": "2023-01-01T10:00:00.000Z",\n        "pointId": "another reference",\n        "data": {\n            "value": 456\n        }\n    }\n]\'\n'})}),"\n",(0,a.jsxs)(n.p,{children:["This request will result in a successful response with a ",(0,a.jsx)(n.code,{children:"204 No Content"})," status."]}),"\n",(0,a.jsx)(n.h3,{id:"file-payload",children:"File payload"}),"\n",(0,a.jsx)(n.p,{children:"To send a file to OIBus, you can utilize the following curl command:"}),"\n",(0,a.jsx)(n.pre,{children:(0,a.jsx)(n.code,{className:"language-curl",metastring:'title="curl command"',children:"curl --location 'http://localhost:2223/api/add-file?name=%27test%27' \\\n-u <username>:<password> \\\n--form 'file=@\"<file-path>\"'\n"})}),"\n",(0,a.jsxs)(n.p,{children:["This request will result in a successful response with a ",(0,a.jsx)(n.code,{children:"204 No Content"})," status."]})]})}function u(e={}){const{wrapper:n}={...(0,i.R)(),...e.components};return n?(0,a.jsx)(n,{...e,children:(0,a.jsx)(d,{...e})}):d(e)}},8453:(e,n,t)=>{t.d(n,{R:()=>o,x:()=>r});var a=t(6540);const i={},s=a.createContext(i);function o(e){const n=a.useContext(s);return a.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function r(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:o(e.components),a.createElement(s.Provider,{value:n},e.children)}}}]);