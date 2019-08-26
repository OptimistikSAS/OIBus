import React from 'react'

const uiSchema = {
  applicationId: {
    'ui:help': '',
    'ui:readonly': true,
  },
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
    proxy: { 'ui:help': '' },
  },
  caching: {
    sendInterval: { 'ui:help': <div>Value in milliseconds for data sending interval</div> },
    retryInterval: { 'ui:help': <div>Value in milliseconds for retry sending data in case of failure</div> },
  },
  subscribedTo: { 'ui:help': <div>allow to select South data source (default is to receive from all enabled data source of the current OIBus</div> },
}

export default uiSchema
