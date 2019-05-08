import React from 'react'

const uiSchema = {
  equipmentId: { 'ui:help': '' },
  enabled: { 'ui:help': <div>If enabled, equipment will be enabled</div> },
  protocol: { 'ui:help': '' },
  pointIdRoot: { 'ui:help': '' },
  defaultScanMode: { 'ui:help': <div>Default scan mode for every item from points</div> },
  Modbus: {
    host: { 'ui:help': '' },
    port: { 'ui:help': '' },
  },
  points: {
    items: {
      Modbus: {
        address: { 'ui:help': '' },
        type: { 'ui:help': '' },
      },
      pointId: { 'ui:help': '' },
      scanMode: { 'ui:help': <div>List of the scan modes defined by the user</div> },
    },
  },
}

export default uiSchema
