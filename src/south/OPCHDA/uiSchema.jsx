import React from 'react'

const uiSchema = {
  dataSourceId: {
    'ui:help': <div>Unique name for this OPCHDA Source</div>,
    'ui:readonly': true,
  },
  enabled: { 'ui:help': <div>Enable this data source</div> },
  protocol: { 'ui:readonly': true },
  agentFilename: { 'ui:help': <div>path to the HDA Agent</div> },
  tcpPort: { 'ui:help': <div>TCP Port of the HDA Agent executable</div> },
  host: { 'ui:help': <div>IP address or hostname of the HDA server</div> },
  serverName: { 'ui:help': <div>Name of the HDA server</div> },
  points: {
    items: {
      pointId: { 'ui:help': '' },
      scanMode: { 'ui:help': <div>List of the scan modes defined by the user</div> },
    },
  },
  scanGroups: {
    items: {
      scanMode: { 'ui:help': 'Name of a valid scan mode (see Engine tab)' },
      aggregate: { 'ui:help': 'Choose if the query will use raw values or aggregates' },
      resampling: { 'ui:help': 'if an aggregate is chosen, select the aggregate period' },
    },
  },
}

export default uiSchema
