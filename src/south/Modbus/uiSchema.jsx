import React from 'react'

const uiSchema = {
  equipmentId: { 'ui:help': <div>Help text</div> },
  enabled: { 'ui:help': <div>Help text</div> },
  protocol: { 'ui:help': <div>Help text</div> },
  pointIdRoot: { 'ui:help': <div>Help text</div> },
  defaultScanMode: { 'ui:help': <div>Help text</div> },
  Modbus: {
    host: { 'ui:help': <div>Help text</div> },
    port: { 'ui:help': <div>Help text</div> },
  },
  points: {
    items: {
      Modbus: {
        address: { 'ui:help': <div>Help text</div> },
        type: { 'ui:help': <div>Help text</div> },
      },
      pointId: { 'ui:help': <div>Help text</div> },
      scanMode: { 'ui:help': <div>Help text</div> },
    },
  },
}

export default uiSchema
