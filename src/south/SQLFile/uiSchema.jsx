import React from 'react'

const uiSchema = {
  dataSourceId: { 'ui:help': '' },
  enabled: { 'ui:help': <div>If enabled, equipment will be enabled</div> },
  protocol: { 'ui:help': '' },
  driver: { 'ui:help': '' },
  host: { 'ui:help': '' },
  port: { 'ui:help': '' },
  username: { 'ui:help': '' },
  password: {
    'ui:help': '',
    'ui:widget': 'password',
  },
  query: { 'ui:help': '' },
  delimiter: { 'ui:help': '' },
  tmpFolder: { 'ui:help': '' },
  points: {
    items: {
      pointId: { 'ui:help': '' },
      scanMode: { 'ui:help': <div>List of the scan modes defined by the user</div> },
    },
  },
}

export default uiSchema
