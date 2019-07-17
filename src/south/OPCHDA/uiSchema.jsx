import React from 'react'

const uiSchema = {
  dataSourceId: { 'ui:help': '' },
  enabled: { 'ui:help': <div>If enabled, equipment will be enabled</div> },
  protocol: { 'ui:help': '' },
  agentFilename: { 'ui:help': '' },
  tcpPort: { 'ui:help': '' },
  host: { 'ui:help': '' },
  serverName: { 'ui:help': '' },
  points: {
    items: {
      pointId: { 'ui:help': '' },
      scanMode: { 'ui:help': <div>List of the scan modes defined by the user</div> },
    },
  },
  scanGroups: {
    items: {
      aggregate: { 'ui:help': '' },
      scanMode: { 'ui:help': '' },
      resampling: { 'ui:help': '' },
    },
  },
}

export default uiSchema
