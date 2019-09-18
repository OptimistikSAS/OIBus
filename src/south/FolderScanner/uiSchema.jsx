import React from 'react'

const uiSchema = {
  dataSourceId: {
    'ui:help': '',
    'ui:readonly': true,
  },
  enabled: { 'ui:help': <div>If enabled, data source will be enabled</div> },
  protocol: { 'ui:help': '' },
  inputFolder: { 'ui:help': <div>Path to input folder</div> },
  preserveFiles: { 'ui:help': <div>If enabled, will preserve files</div> },
  minAge: { 'ui:help': '' },
  regex: { 'ui:help': '' },
}

export default uiSchema
