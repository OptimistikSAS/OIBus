import React from 'react'

const uiSchema = {
  equipmentId: { 'ui:help': '' },
  enabled: { 'ui:help': <div>If enabled, equipment will be enabled</div> },
  protocol: { 'ui:help': '' },
  pointIdRoot: { 'ui:help': '' },
  defaultScanMode: { 'ui:help': '' },
  MQTT: {
    server: { 'ui:help': '' },
    protocol: { 'ui:help': '' },
    port: { 'ui:help': '' },
    username: { 'ui:help': '' },
    password: {
      'ui:help': '',
      'ui:widget': 'password',
    },
  },
  points: {
    items: {
      MQTT: { topic: { 'ui:help': '' } },
      pointId: { 'ui:help': '' },
      doNotGroup: { 'ui:help': '' },
      scanMode: { 'ui:help': <div>Name of the scan mode defined by the user</div> },
    },
  },
}

export default uiSchema
