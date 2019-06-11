import React from 'react'

const uiSchema = {
  dataSourceId: { 'ui:help': '' },
  enabled: { 'ui:help': <div>If enabled, equipment will be enabled</div> },
  protocol: { 'ui:help': '' },
  host: { 'ui:help': '' },
  port: { 'ui:help': '' },
  points: {
    items: {
      pointId: { 'ui:help': '' },
      scanMode: { 'ui:help': <div>List of the scan modes defined by the user</div> },
      address: { 'ui:help': '' },
      type: { 'ui:help': '' },
    },
  },
}

export default uiSchema
