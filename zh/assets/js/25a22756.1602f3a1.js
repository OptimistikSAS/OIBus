"use strict";(self.webpackChunkdoc_oibus=self.webpackChunkdoc_oibus||[]).push([[9941],{6329:(e,n,i)=>{i.r(n),i.d(n,{assets:()=>d,contentTitle:()=>o,default:()=>h,frontMatter:()=>r,metadata:()=>l,toc:()=>c});var t=i(4848),s=i(8453);const r={displayed_sidebar:"developerSidebar",sidebar_position:2},o="The manifest",l={id:"developer/create-connector/manifest",title:"The manifest",description:"With this JSON, you can specify what fields are required to configure your connector, what type of fields, etc...",source:"@site/i18n/zh/docusaurus-plugin-content-docs/current/developer/create-connector/manifest.md",sourceDirName:"developer/create-connector",slug:"/developer/create-connector/manifest",permalink:"/zh/docs/developer/create-connector/manifest",draft:!1,unlisted:!1,tags:[],version:"current",sidebarPosition:2,frontMatter:{displayed_sidebar:"developerSidebar",sidebar_position:2},sidebar:"developerSidebar",previous:{title:"Create a new OIBus connector",permalink:"/zh/docs/developer/create-connector/presentation"},next:{title:"Connector class",permalink:"/zh/docs/developer/create-connector/class"}},d={},c=[{value:"Settings",id:"settings",level:2},{value:"OibText",id:"oibtext",level:3},{value:"OibTextArea",id:"oibtextarea",level:3},{value:"OibCodeBlock",id:"oibcodeblock",level:3},{value:"OibNumber",id:"oibnumber",level:3},{value:"OibSelect",id:"oibselect",level:3},{value:"OibSecret",id:"oibsecret",level:3},{value:"OibCheckbox",id:"oibcheckbox",level:3},{value:"OibTimezone",id:"oibtimezone",level:3},{value:"Group settings",id:"group-settings",level:3},{value:"OibArray",id:"oibarray",level:4},{value:"OibFormGroup",id:"oibformgroup",level:4},{value:"Items",id:"items",level:2},{value:"Create or update your data types",id:"create-or-update-your-data-types",level:2}];function a(e){const n={a:"a",admonition:"admonition",code:"code",h1:"h1",h2:"h2",h3:"h3",h4:"h4",header:"header",li:"li",mdxAdmonitionTitle:"mdxAdmonitionTitle",p:"p",pre:"pre",strong:"strong",ul:"ul",...(0,s.R)(),...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.header,{children:(0,t.jsx)(n.h1,{id:"the-manifest",children:"The manifest"})}),"\n",(0,t.jsx)(n.p,{children:"With this JSON, you can specify what fields are required to configure your connector, what type of fields, etc..."}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"id"}),": The id of your manifest (must not be used by another manifest)"]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"name"}),": The name used for display"]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"category"}),": The type of manifest. Existing categories are: ",(0,t.jsx)(n.code,{children:"iot"}),", ",(0,t.jsx)(n.code,{children:"api"}),", ",(0,t.jsx)(n.code,{children:"database"}),", ",(0,t.jsx)(n.code,{children:"file"}),"."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"description"}),": What your connector does, briefly summarized."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"modes"}),": How your connector will integrate with OIBus.","\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:["For South","\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:["subscription: Can your connector subscribe ? If so, it must implements ",(0,t.jsx)(n.code,{children:"QueriesSubscription"})," class."]}),"\n",(0,t.jsxs)(n.li,{children:["lastPoint: Can your connector request a point ? If so the value will be retrieved as JSON payload and the connector must implement the ",(0,t.jsx)(n.code,{children:"QueriesLastPoint"})," interface."]}),"\n",(0,t.jsxs)(n.li,{children:["lastFile: Can your connector request a file ? If so, the connector must implement the ",(0,t.jsx)(n.code,{children:"QueriesFile"})," interface."]}),"\n",(0,t.jsxs)(n.li,{children:["history: Can your connector request a history ? If so, the connector must implement the ",(0,t.jsx)(n.code,{children:"QueriesHistory"})," interface."]}),"\n",(0,t.jsx)(n.li,{children:"If true, it will be possible to create history queries from your connector type."}),"\n"]}),"\n"]}),"\n",(0,t.jsxs)(n.li,{children:["For North","\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:["files: Can manage files. If so, the connector must implement the ",(0,t.jsx)(n.code,{children:"HandlesFile"})," interface."]}),"\n",(0,t.jsxs)(n.li,{children:["points: Can manage JSON payload. If so, the connector must implement the ",(0,t.jsx)(n.code,{children:"HandlesValues"})," interface."]}),"\n"]}),"\n"]}),"\n"]}),"\n"]}),"\n",(0,t.jsxs)(n.li,{children:["settings: An array of settings which represents the inputs to configure your connector. See the ",(0,t.jsx)(n.a,{href:"#settings",children:"settings section"})]}),"\n",(0,t.jsxs)(n.li,{children:["items (South only): A section to describe how to configure the items to query","\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:["scanMode:","\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsx)(n.li,{children:"acceptSubscription: Is it possible to use subscription for an item? Example: OPCUA"}),"\n",(0,t.jsx)(n.li,{children:"subscriptionOnly: Is subscription the only choice for each item? Example: MQTT"}),"\n"]}),"\n"]}),"\n",(0,t.jsxs)(n.li,{children:["settings: An array of settings which represents the inputs to configure your item. See the ",(0,t.jsx)(n.a,{href:"#settings",children:"settings section"})]}),"\n"]}),"\n"]}),"\n"]}),"\n",(0,t.jsx)(n.h2,{id:"settings",children:"Settings"}),"\n",(0,t.jsx)(n.p,{children:"All settings have common fields, used for display or validation. These common fields are:"}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Main fields"}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"key"}),": The field, written in ",(0,t.jsx)(n.code,{children:"camelCase"})]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"type"}),": One of the type described below, starting with the ",(0,t.jsx)(n.code,{children:"Oib"})," prefix"]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"defaultValue"})," (optional): must match the type (string, number, boolean...)"]}),"\n"]}),"\n"]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Display settings"}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"label"}),": What to display in the form"]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"pipe"})," (optional): A pipe to translate the options"]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"unitLabel"})," (optional): The unit of the value"]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"newRow"}),": Should this input start a new row?"]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"class"}),": Bootstrap compatible CSS classes, mainly used to display each input in the row with ",(0,t.jsx)(n.code,{children:"col-4"}),", ",(0,t.jsx)(n.code,{children:"col"}),", etc."]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"displayInViewMode"}),": Should this input be shown on the display page of a connector"]}),"\n"]}),"\n"]}),"\n",(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:"Validation"}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsx)(n.li,{children:"conditionalDisplay: The other field to monitor according to which the current field is displayed or not. The validators apply only\nif the current field is displayed. See example below."}),"\n",(0,t.jsxs)(n.li,{children:["validators: An array of ",(0,t.jsx)(n.a,{href:"https://angular.io/api/forms/Validators",children:"Angular validators"}),". See example below"]}),"\n"]}),"\n"]}),"\n"]}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-json",metastring:'title="Conditional display example"',children:'{\n  "field": "authentication", "values": ["basic"]\n}\n'})}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{className:"language-json",metastring:'title="Validator example"',children:'[{\n  "key": "required"\n},\n{\n  "key": "maxLength",\n  "params": {\n    "maxLength": 50\n  }\n}]\n'})}),"\n",(0,t.jsx)(n.p,{children:"Then, each type of fields comes with its frontend logic and backend type safety. Some types add more fields."}),"\n",(0,t.jsx)(n.h3,{id:"oibtext",children:"OibText"}),"\n",(0,t.jsxs)(n.p,{children:["Create an input of type text in the frontend, and a field of type ",(0,t.jsx)(n.code,{children:"string"})," in the TypeScript model."]}),"\n",(0,t.jsx)(n.h3,{id:"oibtextarea",children:"OibTextArea"}),"\n",(0,t.jsxs)(n.p,{children:["Create a textarea input in the frontend, and a field of type ",(0,t.jsx)(n.code,{children:"string"})," in the TypeScript model."]}),"\n",(0,t.jsx)(n.h3,{id:"oibcodeblock",children:"OibCodeBlock"}),"\n",(0,t.jsxs)(n.p,{children:["Create a code block with ",(0,t.jsx)(n.a,{href:"https://microsoft.github.io/monaco-editor/",children:"monaco editor"})," in the frontend, and a field of type\n",(0,t.jsx)(n.code,{children:"string"})," in the TypeScript model.\nAdditional field:"]}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsxs)(n.li,{children:["contentType: The language to set up the editor on the frontend (example: ",(0,t.jsx)(n.code,{children:"sql"}),", ",(0,t.jsx)(n.code,{children:"json"}),")."]}),"\n"]}),"\n",(0,t.jsx)(n.h3,{id:"oibnumber",children:"OibNumber"}),"\n",(0,t.jsxs)(n.p,{children:["Create an input of type number in the frontend, and a field of type ",(0,t.jsx)(n.code,{children:"number"})," in the TypeScript model."]}),"\n",(0,t.jsx)(n.h3,{id:"oibselect",children:"OibSelect"}),"\n",(0,t.jsxs)(n.p,{children:["Create an input of type select in the frontend, and a field of type ",(0,t.jsx)(n.code,{children:"string"})," in the TypeScript model.\nAdditional field:"]}),"\n",(0,t.jsxs)(n.ul,{children:["\n",(0,t.jsx)(n.li,{children:"options: The options to display in the select"}),"\n"]}),"\n",(0,t.jsx)(n.h3,{id:"oibsecret",children:"OibSecret"}),"\n",(0,t.jsxs)(n.p,{children:["Create an input of type password in the frontend, and a field of type ",(0,t.jsx)(n.code,{children:"string"})," in the TypeScript model.\nThis field does not show what is typed in the frontend, and indicate OIBus ",(0,t.jsx)(n.a,{href:"../../guide/advanced/oibus-security",children:"to encrypt the\ninput"}),"."]}),"\n",(0,t.jsx)(n.h3,{id:"oibcheckbox",children:"OibCheckbox"}),"\n",(0,t.jsxs)(n.p,{children:["Create an input of type checkbox in the frontend (customized in a toggle), and a field of type ",(0,t.jsx)(n.code,{children:"boolean"})," in the TypeScript\nmodel."]}),"\n",(0,t.jsx)(n.h3,{id:"oibtimezone",children:"OibTimezone"}),"\n",(0,t.jsxs)(n.p,{children:["Create an input of type select in the frontend, and a field of type ",(0,t.jsx)(n.code,{children:"string"})," in the TypeScript model. The options are the\navailable timezones."]}),"\n",(0,t.jsx)(n.h3,{id:"group-settings",children:"Group settings"}),"\n",(0,t.jsx)(n.p,{children:"It is possible to group settings together, inside a structure or inside an array."}),"\n",(0,t.jsx)(n.h4,{id:"oibarray",children:"OibArray"}),"\n",(0,t.jsxs)(n.p,{children:["OibArray will be displayed... as an array where you can add or delete rows: each row will have the fields described in\nthe ",(0,t.jsx)(n.strong,{children:"content"})," fields. See the ",(0,t.jsx)(n.code,{children:"dateTimeFields"})," builder as an example."]}),"\n",(0,t.jsx)(n.h4,{id:"oibformgroup",children:"OibFormGroup"}),"\n",(0,t.jsxs)(n.p,{children:["Group settings in another structure. Specially useful to apply a ",(0,t.jsx)(n.code,{children:"conditonalDisplay"})," to a group of settings, and add other\n",(0,t.jsx)(n.code,{children:"conditionalDisplays"})," inside the structure"]}),"\n",(0,t.jsx)(n.h2,{id:"items",children:"Items"}),"\n",(0,t.jsxs)(n.p,{children:["The items form (create, or update) can be called from the Item array of the display or edit page of a South connector.\nAll items must have a name, a scanMode (that can be hidden if it only accepts subscription) and ",(0,t.jsx)(n.a,{href:"#settings",children:"specific settings described\nin the manifest"}),"."]}),"\n",(0,t.jsx)(n.h2,{id:"create-or-update-your-data-types",children:"Create or update your data types"}),"\n",(0,t.jsxs)(n.p,{children:["If you create a new connector, add it in the ",(0,t.jsx)(n.code,{children:"buildSouthInterfaceName"})," or ",(0,t.jsx)(n.code,{children:"buildNorthInterfaceName"})," method of the\n",(0,t.jsx)(n.code,{children:"settings-interface.generator.ts"})," file."]}),"\n",(0,t.jsxs)(n.p,{children:["Once your manifest is ready, you can generate the appropriate types by running in the ",(0,t.jsx)(n.code,{children:"backend"})," folder:"]}),"\n",(0,t.jsx)(n.pre,{children:(0,t.jsx)(n.code,{children:"npm run generate-settings-interface\n"})}),"\n",(0,t.jsxs)(n.p,{children:["This command will parse all the manifest files found in the ",(0,t.jsx)(n.code,{children:"backend"})," folder and create the TypeScript types according\nto each field description."]}),"\n",(0,t.jsxs)(n.p,{children:["You will be able to call them with the customized name ",(0,t.jsx)(n.code,{children:"South<ConnectorType>Settings"})," and ",(0,t.jsx)(n.code,{children:"South<ConnectorType>ItemSettings"}),"."]}),"\n",(0,t.jsxs)(n.admonition,{type:"caution",children:[(0,t.jsx)(n.mdxAdmonitionTitle,{}),(0,t.jsx)(n.p,{children:"Once the command has run, if the types have changed, the next run will fail. You will have to update your code to adapt\nit to the new types first."})]})]})}function h(e={}){const{wrapper:n}={...(0,s.R)(),...e.components};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(a,{...e})}):a(e)}},8453:(e,n,i)=>{i.d(n,{R:()=>o,x:()=>l});var t=i(6540);const s={},r=t.createContext(s);function o(e){const n=t.useContext(r);return t.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function l(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(s):e.components||s:o(e.components),t.createElement(r.Provider,{value:n},e.children)}}}]);