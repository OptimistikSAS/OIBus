import React from 'react'

const uiSchema = {
  dataSourceId: {
    'ui:help': '',
    'ui:readonly': true,
  },
  enabled: { 'ui:help': <div>If enabled, data source will be enabled</div> },
  protocol: { 'ui:help': '' },
  host: { 'ui:help': '' },
  opcuaPort: { 'ui:help': '' },
  httpsPort: { 'ui:help': '' },
  endPoint: { 'ui:help': '' },
  timeOrigin: { 'ui:help': '' },
  points: {
    items: {
      pointId: { 'ui:help': '' },
      scanMode: { 'ui:help': <div>List of the scan modes defined by the user</div> },
      ns: { 'ui:help': '' },
      s: { 'ui:help': '' },
    },
  },
}

export default uiSchema
