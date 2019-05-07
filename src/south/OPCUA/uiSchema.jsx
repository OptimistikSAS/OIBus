import React from 'react'

const uiSchema = {
  equipmentId: { 'ui:help': <div>Help text</div> },
  enabled: { 'ui:help': <div>Help text</div> },
  protocol: { 'ui:help': <div>Help text</div> },
  pointIdRoot: { 'ui:help': <div>Help text</div> },
  defaultScanMode: { 'ui:help': <div>Help text</div> },
  OPCUA: {
    host: { 'ui:help': <div>Help text</div> },
    opcuaPort: { 'ui:help': <div>Help text</div> },
    httpsPort: { 'ui:help': <div>Help text</div> },
    endPoint: { 'ui:help': <div>Help text</div> },
    timeOrigin: { 'ui:help': <div>Help text</div> },
  },
  points: {
    items: {
      OPCUAnodeId: {
        ns: { 'ui:help': <div>Help text</div> },
        s: { 'ui:help': <div>Help text</div> },
      },
      pointId: { 'ui:help': <div>Help text</div> },
      scanMode: { 'ui:help': <div>Help text</div> },
    },
  },
}

export default uiSchema
