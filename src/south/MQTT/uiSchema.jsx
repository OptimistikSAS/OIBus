import React from 'react'

const uiSchema = {
  equipmentId: { 'ui:help': <div>Help text</div> },
  enabled: { 'ui:help': <div>Help text</div> },
  protocol: { 'ui:help': <div>Help text</div> },
  pointIdRoot: { 'ui:help': <div>Help text</div> },
  defaultScanMode: { 'ui:help': <div>Help text</div> },
  MQTT: {
    server: { 'ui:help': <div>Help text</div> },
    protocol: { 'ui:help': <div>Help text</div> },
    port: { 'ui:help': <div>Help text</div> },
    username: { 'ui:help': <div>Help text</div> },
    password: {
      'ui:help': <div>Help text</div>,
      'ui:widget': 'password',
    },
  },
  points: {
    items: {
      MQTT: { topic: { 'ui:help': <div>Help text</div> } },
      pointId: { 'ui:help': <div>Help text</div> },
      doNotGroup: { 'ui:help': <div>Help text</div> },
      scanMode: { 'ui:help': <div>Help text</div> },
    },
  },
}

export default uiSchema
