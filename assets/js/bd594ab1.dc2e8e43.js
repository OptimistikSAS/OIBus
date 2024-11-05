"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[3745],{1957:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>a,contentTitle:()=>r,default:()=>h,frontMatter:()=>s,metadata:()=>c,toc:()=>l});var i=n(4848),o=n(8453);const s={sidebar_position:0},r="Concept",c={id:"guide/north-connectors/common-settings",title:"Concept",description:"A North connector is employed to transmit data to a designated target application, extracting the data from its cache.",source:"@site/docs/guide/north-connectors/common-settings.md",sourceDirName:"guide/north-connectors",slug:"/guide/north-connectors/common-settings",permalink:"/docs/guide/north-connectors/common-settings",draft:!1,unlisted:!1,tags:[],version:"current",sidebarPosition:0,frontMatter:{sidebar_position:0},sidebar:"guideSidebar",previous:{title:"North connectors",permalink:"/docs/category/north-connectors"},next:{title:"OIAnalytics",permalink:"/docs/guide/north-connectors/oianalytics"}},a={},l=[{value:"General settings",id:"general-settings",level:2},{value:"Specific section",id:"specific-section",level:2},{value:"Caching",id:"caching",level:2},{value:"Archive",id:"archive",level:2},{value:"Subscriptions",id:"subscriptions",level:2}];function d(e){const t={a:"a",admonition:"admonition",code:"code",em:"em",h1:"h1",h2:"h2",li:"li",p:"p",strong:"strong",ul:"ul",...(0,o.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(t.h1,{id:"concept",children:"Concept"}),"\n",(0,i.jsx)(t.p,{children:"A North connector is employed to transmit data to a designated target application, extracting the data from its cache.\nData can be delivered either as files or JSON payloads."}),"\n",(0,i.jsx)(t.p,{children:"To add a North connector, navigate to the North page and click the '+' button. Choose one of the available North\nconnector types and complete its settings. The form's structure varies depending on the chosen connector type, but\ncertain principles remain consistent."}),"\n",(0,i.jsx)(t.p,{children:"You can monitor the status of the North connector from its display page or make adjustments to its settings."}),"\n",(0,i.jsx)(t.h2,{id:"general-settings",children:"General settings"}),"\n",(0,i.jsxs)(t.ul,{children:["\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Name"}),": The connector's name serves as a user-friendly label to help you easily identify its purpose."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Description"}),": You have the option to include a description to provide additional context, such as details about the\nconnection, access rights, or any unique characteristics."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Toggle"}),": You can enable or disable the connector using the toggle switch. Additionally, you can toggle the connector\nfrom either the North connector list or its dedicated display page (accessible via the magnifying glass icon of the list\npage)."]}),"\n"]}),"\n",(0,i.jsx)(t.h2,{id:"specific-section",children:"Specific section"}),"\n",(0,i.jsx)(t.p,{children:"Specific settings for the connector can be found in the respective connector's documentation for more detailed information."}),"\n",(0,i.jsx)(t.h2,{id:"caching",children:"Caching"}),"\n",(0,i.jsx)(t.p,{children:"The caching section plays a crucial role in helping OIBus efficiently manage network congestion:"}),"\n",(0,i.jsxs)(t.ul,{children:["\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Send interval"}),": This setting allows you to schedule the transmission of data to a target application. Refer to the\n",(0,i.jsx)(t.a,{href:"/docs/guide/engine/scan-modes",children:"scan mode section"})," for configuring new scan modes."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Retry interval"}),": Specifies the waiting period before attempting to resend data to a target application after a\nfailure (measured in milliseconds)."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Retry count"}),": Indicates the number of retry attempts before giving up and relocating failed data to the error folder."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Max size"}),": This parameter defines the maximum size of the cache in megabytes (MB). Once the cache reaches its maximum\nsize, any additional data will be discarded."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Group count"})," (for JSON payloads): Instead of waiting for the ",(0,i.jsx)(t.em,{children:"Send interval"}),", this feature triggers the North\nconnector to transmit data as soon as the specified number of data items is reached."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Max group count"})," (for JSON payloads): When the connection experiences prolonged downtime, the cache of a North\nconnector may accumulate a substantial amount of data. To prevent overwhelming the target or the network, this field can\nbe set to split the data into multiple smaller chunks, each sent separately at intervals defined by the ",(0,i.jsx)(t.em,{children:"Send interval"}),"."]}),"\n",(0,i.jsxs)(t.li,{children:[(0,i.jsx)(t.strong,{children:"Send file immediately"})," (for files): This option enables the North connector to send the file directly, bypassing the\n",(0,i.jsx)(t.em,{children:"Send interval"})," waiting period."]}),"\n"]}),"\n",(0,i.jsx)(t.h2,{id:"archive",children:"Archive"}),"\n",(0,i.jsxs)(t.p,{children:["It is also possible to enable archive mode, and to set a ",(0,i.jsx)(t.strong,{children:"retention duration"}),". With archive mode enabled, files will be\nkept in the ",(0,i.jsx)(t.code,{children:"archive"})," subfolder. Otherwise, they are deleted once sent to the North application."]}),"\n",(0,i.jsx)(t.p,{children:"If the retention duration is set to zero, it will keep files indefinitely."}),"\n",(0,i.jsxs)(t.p,{children:["You can also activate archive mode and define a ",(0,i.jsx)(t.strong,{children:"retention duration"}),". When archive mode is enabled, files will be preserved\nin the ",(0,i.jsx)(t.code,{children:"archive"})," subfolder; otherwise, they will be deleted once transmitted to the North application."]}),"\n",(0,i.jsx)(t.p,{children:"If you set the retention duration to zero, it means that files will be retained indefinitely."}),"\n",(0,i.jsx)(t.admonition,{title:"Disk space",type:"caution",children:(0,i.jsx)(t.p,{children:"If you opt to retain files indefinitely, it's essential to remember to periodically manually clear the archive folder.\nFailing to do so could result in the archive folder consuming a significant amount of disk space."})}),"\n",(0,i.jsx)(t.h2,{id:"subscriptions",children:"Subscriptions"}),"\n",(0,i.jsxs)(t.p,{children:["By default, a North connector collects data from all activated South connectors. However, you have the option to subscribe\na North connector to a particular South connector or a list of South connectors (or ",(0,i.jsx)(t.a,{href:"/docs/guide/engine/external-sources",children:"External Source"}),").\nIn the Subscriptions section, you can add a specific South connector or an External source. This means that only data from\nthe specified South connector or External Source will be included in the cache of this North connector. All other data\nwill either be discarded or sent to other active North connectors that are subscribed to the data stream."]}),"\n",(0,i.jsx)(t.admonition,{title:"No data for disabled North",type:"caution",children:(0,i.jsx)(t.p,{children:"When a North connector is disabled, it will not store any data in its cache."})})]})}function h(e={}){const{wrapper:t}={...(0,o.R)(),...e.components};return t?(0,i.jsx)(t,{...e,children:(0,i.jsx)(d,{...e})}):d(e)}},8453:(e,t,n)=>{n.d(t,{R:()=>r,x:()=>c});var i=n(6540);const o={},s=i.createContext(o);function r(e){const t=i.useContext(s);return i.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function c(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(o):e.components||o:r(e.components),i.createElement(s.Provider,{value:t},e.children)}}}]);