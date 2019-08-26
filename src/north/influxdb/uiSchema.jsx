import React from 'react'

const uiSchema = {
  applicationId: {
    'ui:help': '',
    'ui:readonly': true,
  },
  enabled: { 'ui:help': <div>If enabled, appication will be enabled</div> },
  api: { 'ui:readonly': true },
  InfluxDB: {
    user: { 'ui:help': '' },
    password: {
      'ui:widget': 'password',
      'ui:help': '',
    },
    db: { 'ui:help': <div>Database name</div> },
    host: { 'ui:help': '' },
    precision: { 'ui:help': '' },
  },
  caching: {
    sendInterval: { 'ui:help': <div>Value in milliseconds for data sending interval</div> },
    retryInterval: { 'ui:help': <div>Value in milliseconds for retry sending data in case of failure</div> },
    groupCount: { 'ui:help': <div>The minimum buffer that will ensure date is not sent until value is reached</div> },
    maxSendCount: { 'ui:help': <div>The maximum buffer that the north app can support</div> },
  },
  subscribedTo: { 'ui:help': <div>allow to select South data source (default is to receive from all enabled data source of the current OIBus</div> },
}

export default uiSchema
