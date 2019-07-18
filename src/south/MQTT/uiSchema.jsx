import React from 'react'

const uiSchema = {
  dataSourceId: { 'ui:help': '' },
  enabled: { 'ui:help': <div>If enabled, equipment will be enabled</div> },
  protocol: { 'ui:help': '' },
  server: { 'ui:help': '' },
  mqttProtocol: { 'ui:help': '' },
  port: { 'ui:help': '' },
  username: { 'ui:help': '' },
  password: {
    'ui:help': '',
    'ui:widget': 'password',
  },
  points: {
    items: {
      pointId: { 'ui:help': '' },
      urgent: { 'ui:help': '' },
      scanMode: { 'ui:help': <div>List of the scan modes defined by the user</div> },
      topic: { 'ui:help': '' },
    },
  },
}

export default uiSchema
