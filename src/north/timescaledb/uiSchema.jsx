import React from 'react'

const uiSchema = {
  applicationId: {
    'ui:help': '',
    'ui:readonly': true,
  },
  enabled: { 'ui:help': <div>If enabled, appication will be enabled</div> },
  api: { 'ui:help': '' },
  TimescaleDB: {
    user: { 'ui:help': '' },
    password: {
      'ui:widget': 'password',
      'ui:help': '',
    },
    db: { 'ui:help': <div>Database name</div> },
    host: { 'ui:help': '' },
  },
  caching: {
    sendInterval: { 'ui:help': <div>Value in milliseconds for data sending interval</div> },
    retryInterval: { 'ui:help': <div>Value in milliseconds for retry sending data in case of failure</div> },
    groupCount: { 'ui:help': <div>The minimum count of data before is sent to the database</div> },
  },
  subscribedTo: { 'ui:help': <div>allow to select South data source (default is to receive from all enabled data source of the current OIBus</div> },
}

export default uiSchema
