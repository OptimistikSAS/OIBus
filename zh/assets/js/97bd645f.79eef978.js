"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[4174],{1735:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>c,contentTitle:()=>o,default:()=>f,frontMatter:()=>u,metadata:()=>r,toc:()=>d});const r=JSON.parse('{"id":"guide/installation/installation","title":"\u5b89\u88c5\u8981\u6c42","description":"\u8ba9\u6211\u4eec\u5728\u4e0d\u52302\u5206\u949f\u7684\u65f6\u95f4\u5185\u542f\u52a8\u5e76\u8fd0\u884c OIBus\u3002","source":"@site/i18n/zh/docusaurus-plugin-content-docs/current/guide/installation/installation.mdx","sourceDirName":"guide/installation","slug":"/guide/installation/","permalink":"/zh/docs/guide/installation/","draft":false,"unlisted":false,"tags":[],"version":"current","sidebarPosition":2,"frontMatter":{"sidebar_position":2},"sidebar":"guideSidebar","previous":{"title":"Getting started","permalink":"/zh/docs/category/getting-started"},"next":{"title":"\u9996\u6b21\u8bbf\u95ee","permalink":"/zh/docs/guide/installation/first-access"}}');var a=t(4848),s=t(8453),l=t(1470),i=t(9365);const u={sidebar_position:2},o="\u5b89\u88c5\u8981\u6c42",c={},d=[{value:"\u7cfb\u7edf\u8981\u6c42",id:"\u7cfb\u7edf\u8981\u6c42",level:2},{value:"\u5e73\u53f0",id:"\u5e73\u53f0",level:2}];function h(e){const n={a:"a",h1:"h1",h2:"h2",header:"header",li:"li",p:"p",strong:"strong",ul:"ul",...(0,s.R)(),...e.components};return(0,a.jsxs)(a.Fragment,{children:[(0,a.jsx)(n.header,{children:(0,a.jsx)(n.h1,{id:"\u5b89\u88c5\u8981\u6c42",children:"\u5b89\u88c5\u8981\u6c42"})}),"\n",(0,a.jsx)(n.p,{children:"\u8ba9\u6211\u4eec\u5728\u4e0d\u52302\u5206\u949f\u7684\u65f6\u95f4\u5185\u542f\u52a8\u5e76\u8fd0\u884c OIBus\u3002"}),"\n",(0,a.jsx)(n.h2,{id:"\u7cfb\u7edf\u8981\u6c42",children:"\u7cfb\u7edf\u8981\u6c42"}),"\n",(0,a.jsx)(n.p,{children:"\u4e3a\u4e86\u6210\u529f\u5b89\u88c5 OIBus\uff0c\u60a8\u7684\u73af\u5883\u5e94\u6ee1\u8db3\u4ee5\u4e0b\u6700\u4f4e\u89c4\u683c\uff1a"}),"\n",(0,a.jsxs)(n.ul,{children:["\n",(0,a.jsxs)(n.li,{children:[(0,a.jsx)(n.strong,{children:"RAM: 2GB"}),"\u3002\u867d\u7136\u6839\u636e\u60a8\u7684\u5177\u4f53\u914d\u7f6e\uff0c\u5b9e\u9645\u9700\u8981\u7684 RAM \u53ef\u80fd\u6709\u6240\u4e0d\u540c\uff0c\u4f46\u81f3\u5c11\u9700\u8981 2GB\u3002"]}),"\n",(0,a.jsxs)(n.li,{children:[(0,a.jsx)(n.strong,{children:"\u78c1\u76d8\u7a7a\u95f4: 200 MB"}),"\u3002\u60a8\u5c06\u9700\u8981\u81f3\u5c11 200 MB \u7684\u78c1\u76d8\u7a7a\u95f4\u6765\u5b89\u88c5\u5e94\u7528\u7a0b\u5e8f\u3002\u7136\u800c\uff0c\u5efa\u8bae\u6709\u989d\u5916\u7684\u7a7a\u95f4\uff08\u6839\u636e\u60a8\u7684\u6570\u636e\u6d41\uff0c\u53ef\u80fd\u9700\u8981\u51e0 GB\uff09\u4ee5\u50a8\u5b58\u5728\u4e0a\u6e38\u7f51\u7edc\u6545\u969c\u65f6\u6536\u96c6\u7684\u6570\u636e\u3002"]}),"\n",(0,a.jsxs)(n.li,{children:[(0,a.jsx)(n.strong,{children:"\u7ba1\u7406\u6743\u9650"}),"\uff1a\u60a8\u5fc5\u987b\u5728\u60a8\u7684\u73af\u5883\u4e2d\u62e5\u6709\u7ba1\u7406\u6743\u5229\u624d\u80fd\u5b89\u88c5 OIBus \u5e76\u5c06\u5176\u6ce8\u518c\u4e3a\u670d\u52a1\u3002\u8fd9\u9002\u7528\u4e8e Windows \u548c Linux \u5e73\u53f0\u3002"]}),"\n",(0,a.jsxs)(n.li,{children:[(0,a.jsx)(n.strong,{children:"\u73b0\u4ee3\u7f51\u7edc\u6d4f\u89c8\u5668"}),"\uff1a\u60a8\u9700\u8981\u4e00\u4e2a\u73b0\u4ee3\u7f51\u7edc\u6d4f\u89c8\u5668\u6765\u8bbf\u95ee OIBus \u914d\u7f6e\u754c\u9762\u3002\u6d4f\u89c8\u5668\u53ef\n\u4f4d\u4e8e\u4e0e OIBus \u76f8\u540c\u7684\u8ba1\u7b97\u673a\u4e0a\uff0c\u6216\u8005\u4f4d\u4e8e\u4e0d\u540c\u7684\u8ba1\u7b97\u673a\u4e0a\uff0c\u53ea\u8981\u60a8\u914d\u7f6e\u4e86\n",(0,a.jsx)(n.a,{href:"/zh/docs/guide/engine/ip-filters",children:"\u5fc5\u8981\u7684\u8bbf\u95ee\u8bbe\u7f6e"}),"\u3002\u6ce8\u610f\uff1a\u4e0d\u652f\u6301 Internet Explorer\u3002"]}),"\n"]}),"\n",(0,a.jsx)(n.h2,{id:"\u5e73\u53f0",children:"\u5e73\u53f0"}),"\n",(0,a.jsxs)(l.A,{children:[(0,a.jsx)(i.A,{value:"windows",label:"Windows",default:!0,children:(0,a.jsx)("div",{children:(0,a.jsx)("div",{style:{display:"flex",justifyContent:"space-around"},children:(0,a.jsx)("a",{href:"./windows",children:"Windows \u5b89\u88c5"})})})}),(0,a.jsx)(i.A,{value:"linux",label:"Linux",children:(0,a.jsx)("div",{children:(0,a.jsx)("div",{style:{display:"flex",justifyContent:"space-around"},children:(0,a.jsx)("a",{href:"./linux",children:"Linux \u5b89\u88c5"})})})}),(0,a.jsx)(i.A,{value:"macos",label:"MacOS",children:(0,a.jsx)("div",{children:(0,a.jsx)("div",{style:{display:"flex",justifyContent:"space-around"},children:(0,a.jsx)("a",{href:"./macos",children:"macOS \u5b89\u88c5"})})})})]})]})}function f(e={}){const{wrapper:n}={...(0,s.R)(),...e.components};return n?(0,a.jsx)(n,{...e,children:(0,a.jsx)(h,{...e})}):h(e)}},9365:(e,n,t)=>{t.d(n,{A:()=>l});t(6540);var r=t(4164);const a={tabItem:"tabItem_Ymn6"};var s=t(4848);function l(e){let{children:n,hidden:t,className:l}=e;return(0,s.jsx)("div",{role:"tabpanel",className:(0,r.A)(a.tabItem,l),hidden:t,children:n})}},1470:(e,n,t)=>{t.d(n,{A:()=>w});var r=t(6540),a=t(4164),s=t(3104),l=t(6347),i=t(205),u=t(7485),o=t(1682),c=t(679);function d(e){return r.Children.toArray(e).filter((e=>"\n"!==e)).map((e=>{if(!e||(0,r.isValidElement)(e)&&function(e){const{props:n}=e;return!!n&&"object"==typeof n&&"value"in n}(e))return e;throw new Error(`Docusaurus error: Bad <Tabs> child <${"string"==typeof e.type?e.type:e.type.name}>: all children of the <Tabs> component should be <TabItem>, and every <TabItem> should have a unique "value" prop.`)}))?.filter(Boolean)??[]}function h(e){const{values:n,children:t}=e;return(0,r.useMemo)((()=>{const e=n??function(e){return d(e).map((e=>{let{props:{value:n,label:t,attributes:r,default:a}}=e;return{value:n,label:t,attributes:r,default:a}}))}(t);return function(e){const n=(0,o.XI)(e,((e,n)=>e.value===n.value));if(n.length>0)throw new Error(`Docusaurus error: Duplicate values "${n.map((e=>e.value)).join(", ")}" found in <Tabs>. Every value needs to be unique.`)}(e),e}),[n,t])}function f(e){let{value:n,tabValues:t}=e;return t.some((e=>e.value===n))}function p(e){let{queryString:n=!1,groupId:t}=e;const a=(0,l.W6)(),s=function(e){let{queryString:n=!1,groupId:t}=e;if("string"==typeof n)return n;if(!1===n)return null;if(!0===n&&!t)throw new Error('Docusaurus error: The <Tabs> component groupId prop is required if queryString=true, because this value is used as the search param name. You can also provide an explicit value such as queryString="my-search-param".');return t??null}({queryString:n,groupId:t});return[(0,u.aZ)(s),(0,r.useCallback)((e=>{if(!s)return;const n=new URLSearchParams(a.location.search);n.set(s,e),a.replace({...a.location,search:n.toString()})}),[s,a])]}function b(e){const{defaultValue:n,queryString:t=!1,groupId:a}=e,s=h(e),[l,u]=(0,r.useState)((()=>function(e){let{defaultValue:n,tabValues:t}=e;if(0===t.length)throw new Error("Docusaurus error: the <Tabs> component requires at least one <TabItem> children component");if(n){if(!f({value:n,tabValues:t}))throw new Error(`Docusaurus error: The <Tabs> has a defaultValue "${n}" but none of its children has the corresponding value. Available values are: ${t.map((e=>e.value)).join(", ")}. If you intend to show no default tab, use defaultValue={null} instead.`);return n}const r=t.find((e=>e.default))??t[0];if(!r)throw new Error("Unexpected error: 0 tabValues");return r.value}({defaultValue:n,tabValues:s}))),[o,d]=p({queryString:t,groupId:a}),[b,m]=function(e){let{groupId:n}=e;const t=function(e){return e?`docusaurus.tab.${e}`:null}(n),[a,s]=(0,c.Dv)(t);return[a,(0,r.useCallback)((e=>{t&&s.set(e)}),[t,s])]}({groupId:a}),x=(()=>{const e=o??b;return f({value:e,tabValues:s})?e:null})();(0,i.A)((()=>{x&&u(x)}),[x]);return{selectedValue:l,selectValue:(0,r.useCallback)((e=>{if(!f({value:e,tabValues:s}))throw new Error(`Can't select invalid tab value=${e}`);u(e),d(e),m(e)}),[d,m,s]),tabValues:s}}var m=t(2303);const x={tabList:"tabList__CuJ",tabItem:"tabItem_LNqP"};var v=t(4848);function g(e){let{className:n,block:t,selectedValue:r,selectValue:l,tabValues:i}=e;const u=[],{blockElementScrollPositionUntilNextRender:o}=(0,s.a_)(),c=e=>{const n=e.currentTarget,t=u.indexOf(n),a=i[t].value;a!==r&&(o(n),l(a))},d=e=>{let n=null;switch(e.key){case"Enter":c(e);break;case"ArrowRight":{const t=u.indexOf(e.currentTarget)+1;n=u[t]??u[0];break}case"ArrowLeft":{const t=u.indexOf(e.currentTarget)-1;n=u[t]??u[u.length-1];break}}n?.focus()};return(0,v.jsx)("ul",{role:"tablist","aria-orientation":"horizontal",className:(0,a.A)("tabs",{"tabs--block":t},n),children:i.map((e=>{let{value:n,label:t,attributes:s}=e;return(0,v.jsx)("li",{role:"tab",tabIndex:r===n?0:-1,"aria-selected":r===n,ref:e=>u.push(e),onKeyDown:d,onClick:c,...s,className:(0,a.A)("tabs__item",x.tabItem,s?.className,{"tabs__item--active":r===n}),children:t??n},n)}))})}function j(e){let{lazy:n,children:t,selectedValue:s}=e;const l=(Array.isArray(t)?t:[t]).filter(Boolean);if(n){const e=l.find((e=>e.props.value===s));return e?(0,r.cloneElement)(e,{className:(0,a.A)("margin-top--md",e.props.className)}):null}return(0,v.jsx)("div",{className:"margin-top--md",children:l.map(((e,n)=>(0,r.cloneElement)(e,{key:n,hidden:e.props.value!==s})))})}function y(e){const n=b(e);return(0,v.jsxs)("div",{className:(0,a.A)("tabs-container",x.tabList),children:[(0,v.jsx)(g,{...n,...e}),(0,v.jsx)(j,{...n,...e})]})}function w(e){const n=(0,m.A)();return(0,v.jsx)(y,{...e,children:d(e.children)},String(n))}},8453:(e,n,t)=>{t.d(n,{R:()=>l,x:()=>i});var r=t(6540);const a={},s=r.createContext(a);function l(e){const n=r.useContext(s);return r.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function i(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(a):e.components||a:l(e.components),r.createElement(s.Provider,{value:n},e.children)}}}]);