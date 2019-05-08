import React from 'react'

const uiSchema = {
  equipmentId: { 'ui:help': '' },
  enabled: { 'ui:help': <div>If enabled, equipment will be enabled</div> },
  protocol: { 'ui:help': '' },
  pointIdRoot: { 'ui:help': '' },
  defaultScanMode: { 'ui:help': '' },
  OPCUA: {
    host: { 'ui:help': '' },
    opcuaPort: { 'ui:help': '' },
    httpsPort: { 'ui:help': '' },
    endPoint: { 'ui:help': '' },
    timeOrigin: { 'ui:help': '' },
  },
  points: {
    items: {
      OPCUAnodeId: {
        ns: { 'ui:help': '' },
        s: { 'ui:help': '' },
      },
      pointId: { 'ui:help': '' },
      scanMode: { 'ui:help': <div>Name of the scan mode defined by the user</div> },
    },
  },
}

export default uiSchema
