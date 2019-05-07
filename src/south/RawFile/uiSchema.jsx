import React from 'react'

const uiSchema = {
  equipmentId: { 'ui:help': <div>Help text</div> },
  enabled: { 'ui:help': <div>Help text</div> },
  protocol: { 'ui:help': <div>Help text</div> },
  pointIdRoot: { 'ui:help': <div>Help text</div> },
  defaultScanMode: { 'ui:help': <div>Help text</div> },
  RawFile: {
    inputFolder: { 'ui:help': <div>Help text</div> },
    preserveFiles: { 'ui:help': <div>Help text</div> },
    minAge: { 'ui:help': <div>Help text</div> },
    regex: { 'ui:help': <div>Help text</div> },
  },
  points: {
    items: {
      pointId: { 'ui:help': <div>Help text</div> },
      scanMode: { 'ui:help': <div>Help text</div> },
    },
  },
}

export default uiSchema
