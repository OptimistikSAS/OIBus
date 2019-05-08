import React from 'react'

const uiSchema = {
  equipmentId: { 'ui:help': '' },
  enabled: { 'ui:help': <div>If enabled, equipment will be enabled</div> },
  protocol: { 'ui:help': '' },
  pointIdRoot: { 'ui:help': '' },
  defaultScanMode: { 'ui:help': '' },
  CSV: {
    inputFolder: { 'ui:help': <div>Path to the input folder</div> },
    archiveFolder: { 'ui:help': <div>Path to the archive folder</div> },
    errorFolder: { 'ui:help': <div>Path to the error folder</div> },
    separator: { 'ui:help': <div>Separator charachter</div> },
    timeColumn: { 'ui:help': '' },
    hasFirstLine: { 'ui:help': '' },
  },
  points: {
    items: {
      CSV: {
        value: { 'ui:help': '' },
        quality: { 'ui:help': '' },
      },
      pointId: { 'ui:help': '' },
      scanMode: { 'ui:help': <div>List of the scan modes defined by the user</div> },
    },
  },
}

export default uiSchema
