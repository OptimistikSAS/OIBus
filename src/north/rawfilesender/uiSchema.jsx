import React from 'react'

const uiSchema = {
  applicationId: { 'ui:help': '' },
  enabled: { 'ui:help': <div>If enabled, appication will be enabled</div> },
  api: { 'ui:help': '' },
  RawFileSender: {
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
    defaultProxy: { 'ui:help': '' },
  },
  caching: {
    sendInterval: { 'ui:help': <div>Value in seconds for data sending interval</div> },
    retryInterval: { 'ui:help': <div>Value in seconds for retry sending data in case of failure</div> },
  },
}

export default uiSchema
