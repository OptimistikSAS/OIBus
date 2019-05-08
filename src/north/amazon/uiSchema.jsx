import React from 'react'

const uiSchema = {
  applicationId: { 'ui:help': '' },
  enabled: { 'ui:help': <div>If enabled, appication will be enabled</div> },
  api: { 'ui:help': '' },
  AmazonS3: {
    bucket: { 'ui:help': <div>The name of the unique bucket</div> },
    folder: { 'ui:help': <div>The name of the folder</div> },
    authentication: {
      accessKey: { 'ui:help': '' },
      secretKey: {
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
