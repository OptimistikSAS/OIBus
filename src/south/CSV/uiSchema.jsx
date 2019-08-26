import React from 'react'

const uiSchema = {
  dataSourceId: {
    'ui:help': '',
    'ui:readonly': true,
  },
  enabled: { 'ui:help': <div>If enabled, data source will be enabled</div> },
  protocol: { 'ui:help': '' },
  inputFolder: { 'ui:help': <div>Path to the input folder</div> },
  archiveFolder: { 'ui:help': <div>Path to the archive folder</div> },
  errorFolder: { 'ui:help': <div>Path to the error folder</div> },
  separator: { 'ui:help': <div>Separator charachter</div> },
  timeColumn: { 'ui:help': '' },
  hasFirstLine: { 'ui:help': '' },
  points: {
    items: {
      pointId: { 'ui:help': '' },
      scanMode: { 'ui:help': <div>List of the scan modes defined by the user</div> },
      value: { 'ui:help': '' },
      quality: { 'ui:help': '' },
    },
  },
}

export default uiSchema
