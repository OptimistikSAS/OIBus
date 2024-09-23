"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[8460],{2102:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>c,contentTitle:()=>d,default:()=>x,frontMatter:()=>o,metadata:()=>u,toc:()=>h});var i=t(4848),s=t(8453),r=t(1470),l=t(9365),a=t(3566);const o={sidebar_position:6},d="Migrate to v3",u={id:"guide/installation/migrate",title:"Migrate to v3",description:"Migrate from OIBus v1 and v2 into the new OIBus v3 version with our migration tool and a few manuel steps.",source:"@site/docs/guide/installation/migrate.mdx",sourceDirName:"guide/installation",slug:"/guide/installation/migrate",permalink:"/docs/guide/installation/migrate",draft:!1,unlisted:!1,tags:[],version:"current",sidebarPosition:6,frontMatter:{sidebar_position:6},sidebar:"guideSidebar",previous:{title:"First access",permalink:"/docs/guide/installation/first-access"},next:{title:"Engine",permalink:"/docs/category/engine"}},c={},h=[{value:"Download link",id:"download-link",level:2},{value:"Download specific version",id:"download-specific-version",level:2},{value:"Migration steps",id:"migration-steps",level:2}];function p(e){const n={a:"a",admonition:"admonition",code:"code",h1:"h1",h2:"h2",header:"header",li:"li",ol:"ol",p:"p",pre:"pre",strong:"strong",...(0,s.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(n.header,{children:(0,i.jsx)(n.h1,{id:"migrate-to-v3",children:"Migrate to v3"})}),"\n",(0,i.jsx)(n.p,{children:"Migrate from OIBus v1 and v2 into the new OIBus v3 version with our migration tool and a few manuel steps."}),"\n",(0,i.jsx)(n.h2,{id:"download-link",children:"Download link"}),"\n",(0,i.jsxs)(r.A,{children:[(0,i.jsx)(l.A,{value:"windows",label:"Windows",default:!0,children:(0,i.jsx)("div",{style:{display:"flex",justifyContent:"space-around"},children:(0,i.jsx)(a.A,{link:"https://github.com/OptimistikSAS/OIBus-upgrade-v3/releases/latest/download/oibus-upgrade-tool-win_x64.zip",children:(0,i.jsxs)("div",{children:[(0,i.jsx)("div",{children:"OIBus migration tool"}),(0,i.jsx)("div",{children:"Windows (x64)"})]})})})}),(0,i.jsx)(l.A,{value:"linux",label:"Linux",children:(0,i.jsx)("div",{style:{display:"flex",justifyContent:"space-around"},children:(0,i.jsx)(a.A,{link:"https://github.com/OptimistikSAS/OIBus-upgrade-v3/releases/latest/download/oibus-upgrade-tool-linux_x64.zip",children:(0,i.jsxs)("div",{children:[(0,i.jsx)("div",{children:"OIBus migration tool"}),(0,i.jsx)("div",{children:"Linux (x64)"})]})})})}),(0,i.jsx)(l.A,{value:"macos",label:"MacOS",children:(0,i.jsx)("div",{style:{display:"flex",justifyContent:"space-around"},children:(0,i.jsx)(a.A,{link:"https://github.com/OptimistikSAS/OIBus-upgrade-v3/releases/latest/download/oibus-upgrade-tool-macos_x64.zip",children:(0,i.jsxs)("div",{children:[(0,i.jsx)("div",{children:"OIBus migration tool"}),(0,i.jsx)("div",{children:"macOS (Intel chip)"})]})})})})]}),"\n",(0,i.jsx)(n.h2,{id:"download-specific-version",children:"Download specific version"}),"\n",(0,i.jsx)(n.admonition,{title:"OIBus version",type:"caution",children:(0,i.jsx)(n.p,{children:"The migration will work only with the 3.3.4 OIBus version. If you want to migrate to a later version, first install OIBus v3.3.4\nfrom one of the links below, and then update OIBus from v3.3.4 to a later version."})}),"\n",(0,i.jsxs)(r.A,{children:[(0,i.jsxs)(l.A,{value:"windows",label:"Windows",default:!0,children:[(0,i.jsxs)("div",{style:{display:"flex",justifyContent:"space-around"},children:[(0,i.jsx)(a.A,{link:"https://github.com/OptimistikSAS/OIBus/releases/download/v3.3.4/oibus-setup-win_x64-v3.3.4.exe",children:(0,i.jsxs)("div",{children:[(0,i.jsx)("div",{children:"OIBus v3.3.4 (installer)"}),(0,i.jsx)("div",{children:"Windows (x64)"})]})}),(0,i.jsx)(a.A,{link:"https://github.com/OptimistikSAS/OIBus/releases/download/v3.3.4/oibus-win_x64-v3.3.4.zip",children:(0,i.jsxs)("div",{children:[(0,i.jsx)("div",{children:"OIBus v3.3.4 (zip)"}),(0,i.jsx)("div",{children:"Windows (x64)"})]})})]}),(0,i.jsx)("div",{style:{display:"flex",justifyContent:"space-around"},children:(0,i.jsx)("a",{href:"./windows",children:"Installation"})})]}),(0,i.jsxs)(l.A,{value:"linux",label:"Linux",children:[(0,i.jsx)("div",{style:{display:"flex",justifyContent:"space-around"},children:(0,i.jsx)(a.A,{link:"https://github.com/OptimistikSAS/OIBus/releases/download/v3.3.4/oibus-linux_x64-v3.3.4.zip",children:(0,i.jsxs)("div",{children:[(0,i.jsx)("div",{children:"OIBus v3.3.4"}),(0,i.jsx)("div",{children:"Linux (x64)"})]})})}),(0,i.jsx)("div",{style:{display:"flex",justifyContent:"space-around"},children:(0,i.jsx)("a",{href:"./linux",children:"Installation"})})]}),(0,i.jsxs)(l.A,{value:"macos",label:"MacOS",children:[(0,i.jsx)("div",{style:{display:"flex",justifyContent:"space-around"},children:(0,i.jsx)(a.A,{link:"https://github.com/OptimistikSAS/OIBus/releases/download/v3.3.4/oibus-macos_x64-v3.3.4.zip",children:(0,i.jsxs)("div",{children:[(0,i.jsx)("div",{children:"OIBus v3.3.4"}),(0,i.jsx)("div",{children:"MacOS (Intel chip)"})]})})}),(0,i.jsx)("div",{style:{display:"flex",justifyContent:"space-around"},children:(0,i.jsx)("a",{href:"./macos",children:"Installation"})})]})]}),"\n",(0,i.jsx)(n.h2,{id:"migration-steps",children:"Migration steps"}),"\n",(0,i.jsxs)(n.ol,{children:["\n",(0,i.jsx)(n.li,{children:"Stop the OIBus service."}),"\n"]}),"\n",(0,i.jsx)(n.admonition,{type:"tip",children:(0,i.jsxs)(n.p,{children:["You can zip the data folder, or at least the configuration file ",(0,i.jsx)(n.code,{children:"oibus.json"})," and its ",(0,i.jsx)(n.code,{children:"keys"})," as a backup."]})}),"\n",(0,i.jsxs)(n.ol,{start:"2",children:["\n",(0,i.jsxs)(n.li,{children:["\n",(0,i.jsxs)(n.p,{children:["Install ",(0,i.jsx)(n.a,{href:"#download-specific-version",children:"OIBus v3.3.4"}),". Be careful to specify the ",(0,i.jsx)(n.strong,{children:"same data folder"}),". Check\nthat OIBus v3 run properly by login on ",(0,i.jsx)(n.code,{children:"http://localhost:2223"})," with admin / pass. If everything works, go on with the next step."]}),"\n"]}),"\n",(0,i.jsxs)(n.li,{children:["\n",(0,i.jsx)(n.p,{children:"Stop OIBus v3."}),"\n"]}),"\n",(0,i.jsxs)(n.li,{children:["\n",(0,i.jsxs)(n.p,{children:["Copy the migration tool in the OIBus ",(0,i.jsx)(n.strong,{children:"binary folder"}),"."]}),"\n"]}),"\n",(0,i.jsxs)(n.li,{children:["\n",(0,i.jsx)(n.p,{children:"Run the OIBus migration tool. Be sure to specify the appropriate data folder."}),"\n"]}),"\n"]}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.strong,{children:"Windows command"})}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:"oibus-upgrade.exe --config D:\\OIBusData\n"})}),"\n",(0,i.jsx)(n.p,{children:(0,i.jsx)(n.strong,{children:"Linux / macOS command"})}),"\n",(0,i.jsx)(n.pre,{children:(0,i.jsx)(n.code,{children:"./oibus-upgrade --config /usr/oibus/OIBusData\n"})}),"\n",(0,i.jsxs)(n.ol,{start:"6",children:["\n",(0,i.jsx)(n.li,{children:"Start OIBus v3."}),"\n"]}),"\n",(0,i.jsx)(n.admonition,{type:"tip",children:(0,i.jsxs)(n.p,{children:["The file ",(0,i.jsx)(n.code,{children:"upgrade-journal.log"})," contains the logs of the migration."]})})]})}function x(e={}){const{wrapper:n}={...(0,s.R)(),...e.components};return n?(0,i.jsx)(n,{...e,children:(0,i.jsx)(p,{...e})}):p(e)}},9365:(e,n,t)=>{t.d(n,{A:()=>l});t(6540);var i=t(4164);const s={tabItem:"tabItem_Ymn6"};var r=t(4848);function l(e){let{children:n,hidden:t,className:l}=e;return(0,r.jsx)("div",{role:"tabpanel",className:(0,i.A)(s.tabItem,l),hidden:t,children:n})}},1470:(e,n,t)=>{t.d(n,{A:()=>w});var i=t(6540),s=t(4164),r=t(3104),l=t(6347),a=t(205),o=t(7485),d=t(1682),u=t(679);function c(e){return i.Children.toArray(e).filter((e=>"\n"!==e)).map((e=>{if(!e||(0,i.isValidElement)(e)&&function(e){const{props:n}=e;return!!n&&"object"==typeof n&&"value"in n}(e))return e;throw new Error(`Docusaurus error: Bad <Tabs> child <${"string"==typeof e.type?e.type:e.type.name}>: all children of the <Tabs> component should be <TabItem>, and every <TabItem> should have a unique "value" prop.`)}))?.filter(Boolean)??[]}function h(e){const{values:n,children:t}=e;return(0,i.useMemo)((()=>{const e=n??function(e){return c(e).map((e=>{let{props:{value:n,label:t,attributes:i,default:s}}=e;return{value:n,label:t,attributes:i,default:s}}))}(t);return function(e){const n=(0,d.XI)(e,((e,n)=>e.value===n.value));if(n.length>0)throw new Error(`Docusaurus error: Duplicate values "${n.map((e=>e.value)).join(", ")}" found in <Tabs>. Every value needs to be unique.`)}(e),e}),[n,t])}function p(e){let{value:n,tabValues:t}=e;return t.some((e=>e.value===n))}function x(e){let{queryString:n=!1,groupId:t}=e;const s=(0,l.W6)(),r=function(e){let{queryString:n=!1,groupId:t}=e;if("string"==typeof n)return n;if(!1===n)return null;if(!0===n&&!t)throw new Error('Docusaurus error: The <Tabs> component groupId prop is required if queryString=true, because this value is used as the search param name. You can also provide an explicit value such as queryString="my-search-param".');return t??null}({queryString:n,groupId:t});return[(0,o.aZ)(r),(0,i.useCallback)((e=>{if(!r)return;const n=new URLSearchParams(s.location.search);n.set(r,e),s.replace({...s.location,search:n.toString()})}),[r,s])]}function v(e){const{defaultValue:n,queryString:t=!1,groupId:s}=e,r=h(e),[l,o]=(0,i.useState)((()=>function(e){let{defaultValue:n,tabValues:t}=e;if(0===t.length)throw new Error("Docusaurus error: the <Tabs> component requires at least one <TabItem> children component");if(n){if(!p({value:n,tabValues:t}))throw new Error(`Docusaurus error: The <Tabs> has a defaultValue "${n}" but none of its children has the corresponding value. Available values are: ${t.map((e=>e.value)).join(", ")}. If you intend to show no default tab, use defaultValue={null} instead.`);return n}const i=t.find((e=>e.default))??t[0];if(!i)throw new Error("Unexpected error: 0 tabValues");return i.value}({defaultValue:n,tabValues:r}))),[d,c]=x({queryString:t,groupId:s}),[v,f]=function(e){let{groupId:n}=e;const t=function(e){return e?`docusaurus.tab.${e}`:null}(n),[s,r]=(0,u.Dv)(t);return[s,(0,i.useCallback)((e=>{t&&r.set(e)}),[t,r])]}({groupId:s}),m=(()=>{const e=d??v;return p({value:e,tabValues:r})?e:null})();(0,a.A)((()=>{m&&o(m)}),[m]);return{selectedValue:l,selectValue:(0,i.useCallback)((e=>{if(!p({value:e,tabValues:r}))throw new Error(`Can't select invalid tab value=${e}`);o(e),c(e),f(e)}),[c,f,r]),tabValues:r}}var f=t(2303);const m={tabList:"tabList__CuJ",tabItem:"tabItem_LNqP"};var j=t(4848);function g(e){let{className:n,block:t,selectedValue:i,selectValue:l,tabValues:a}=e;const o=[],{blockElementScrollPositionUntilNextRender:d}=(0,r.a_)(),u=e=>{const n=e.currentTarget,t=o.indexOf(n),s=a[t].value;s!==i&&(d(n),l(s))},c=e=>{let n=null;switch(e.key){case"Enter":u(e);break;case"ArrowRight":{const t=o.indexOf(e.currentTarget)+1;n=o[t]??o[0];break}case"ArrowLeft":{const t=o.indexOf(e.currentTarget)-1;n=o[t]??o[o.length-1];break}}n?.focus()};return(0,j.jsx)("ul",{role:"tablist","aria-orientation":"horizontal",className:(0,s.A)("tabs",{"tabs--block":t},n),children:a.map((e=>{let{value:n,label:t,attributes:r}=e;return(0,j.jsx)("li",{role:"tab",tabIndex:i===n?0:-1,"aria-selected":i===n,ref:e=>o.push(e),onKeyDown:c,onClick:u,...r,className:(0,s.A)("tabs__item",m.tabItem,r?.className,{"tabs__item--active":i===n}),children:t??n},n)}))})}function b(e){let{lazy:n,children:t,selectedValue:r}=e;const l=(Array.isArray(t)?t:[t]).filter(Boolean);if(n){const e=l.find((e=>e.props.value===r));return e?(0,i.cloneElement)(e,{className:(0,s.A)("margin-top--md",e.props.className)}):null}return(0,j.jsx)("div",{className:"margin-top--md",children:l.map(((e,n)=>(0,i.cloneElement)(e,{key:n,hidden:e.props.value!==r})))})}function y(e){const n=v(e);return(0,j.jsxs)("div",{className:(0,s.A)("tabs-container",m.tabList),children:[(0,j.jsx)(g,{...n,...e}),(0,j.jsx)(b,{...n,...e})]})}function w(e){const n=(0,f.A)();return(0,j.jsx)(y,{...e,children:c(e.children)},String(n))}},3566:(e,n,t)=>{t.d(n,{A:()=>a});t(6540);var i=t(5556),s=t.n(i),r=t(4848);const l=e=>{let{children:n,link:t,color:i}=e;return(0,r.jsx)("div",{style:{marginBottom:"20px",marginTop:"10px",textAlign:"center"},children:(0,r.jsx)("a",{rel:"nofollow",href:t,style:{backgroundColor:i,borderRadius:"10px",color:"#f5f5f5",padding:"10px",cursor:"pointer",minWidth:"10rem",textAlign:"center",display:"flex",justifyContent:"space-around"},children:n})})};l.propTypes={link:s().string.isRequired,color:s().string,children:s().object.isRequired},l.defaultProps={color:"#009ee0"};const a=l},8453:(e,n,t)=>{t.d(n,{R:()=>l,x:()=>a});var i=t(6540);const s={},r=i.createContext(s);function l(e){const n=i.useContext(r);return i.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function a(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:l(e.components),i.createElement(r.Provider,{value:n},e.children)}}}]);