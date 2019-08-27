import React from 'react'

const uiSchema = {
  applicationId: {
    'ui:help': '',
    'ui:readonly': true,
  },
  enabled: { 'ui:help': <div>If enabled, appication will be enabled</div> },
  api: { 'ui:help': '' },
  OIAnalyticsFile: {
    host: { 'ui:help': '' },
    endpoint: { 'ui:help': '' },
    authentication: {
      type: { 'ui:help': <div>The type of authentication</div> },
      username: { 'ui:help': '' },
      password: {
        'ui:widget': 'password',
        'ui:help': '',
      },
    },
    proxy: { 'ui:help': '' },
    stack: { 'ui:help': '' },
  },
  caching: {
    sendInterval: { 'ui:help': <div>Value in milliseconds for data sending interval</div> },
    retryInterval: { 'ui:help': <div>Value in milliseconds for retry sending data in case of failure</div> },
  },
  subscribedTo: { 'ui:help': <div>allow to select South data source (default is to receive from all enabled data source of the current OIBus</div> },
}

export default uiSchema
