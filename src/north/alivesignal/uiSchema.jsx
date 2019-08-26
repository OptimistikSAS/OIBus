import React from 'react'

const uiSchema = {
  applicationId: {
    'ui:help': '',
    'ui:readonly': true,
  },
  enabled: { 'ui:help': <div>If enabled, appication will be enabled</div> },
  api: { 'ui:help': '' },
  AliveSignal: {
    host: { 'ui:help': '' },
    authentication: {
      type: { 'ui:help': <div>The type of authentication</div> },
      username: { 'ui:help': '' },
      password: {
        'ui:help': '',
        'ui:widget': 'password',
      },
    },
    id: { 'ui:help': '' },
    frequency: { 'ui:help': <div>The value in milliseconds for get request frequency</div> },
    proxy: { 'ui:help': '' },
  },
  subscribedTo: { 'ui:help': <div>allow to select South data source (default is to receive from all enabled data source of the current OIBus</div> },
}

export default uiSchema
