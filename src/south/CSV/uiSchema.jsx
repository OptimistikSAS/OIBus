import React from 'react'

const uiSchema = {
  equipmentId: { 'ui:help': <div>Help text</div> },
  enabled: { 'ui:help': <div>Help text</div> },
  protocol: { 'ui:help': <div>Help text</div> },
  pointIdRoot: { 'ui:help': <div>Help text</div> },
  defaultScanMode: { 'ui:help': <div>Help text</div> },
  CSV: {
    inputFolder: { 'ui:help': <div>Help text</div> },
    archiveFolder: { 'ui:help': <div>Help text</div> },
    errorFolder: { 'ui:help': <div>Help text</div> },
    separator: { 'ui:help': <div>Help text</div> },
    timeColumn: { 'ui:help': <div>Help text</div> },
    hasFirstLine: { 'ui:help': <div>Help text</div> },
  },
  points: {
    items: {
      CSV: {
        value: { 'ui:help': <div>Help text</div> },
        quality: { 'ui:help': <div>Help text</div> },
      },
      pointId: { 'ui:help': <div>Help text</div> },
      scanMode: { 'ui:help': <div>Help text</div> },
    },
  },
}

export default uiSchema
