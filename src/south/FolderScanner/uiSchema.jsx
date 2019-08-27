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
  points: {
    items: {
      pointId: { 'ui:help': '' },
      scanMode: { 'ui:help': <div>List of the scan modes defined by the user</div> },
    },
  },
}

export default uiSchema
