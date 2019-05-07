import React from 'react'

const uiSchema = {
  applicationId: { 'ui:help': <div>Help text</div> },
  enabled: { 'ui:help': <div>Help text</div> },
  api: { 'ui:help': <div>Help text</div> },
  AmazonS3: {
    bucket: { 'ui:help': <div>Help text</div> },
    folder: { 'ui:help': <div>Help text</div> },
    authentication: {
      accessKey: { 'ui:help': <div>Help text</div> },
      secretKey: {
        'ui:widget': 'password',
        'ui:help': <div>Help text</div>,
      },
    },
    defaultProxy: { 'ui:help': <div>Help text</div> },
  },
  caching: {
    sendInterval: { 'ui:help': <div>Help text</div> },
    retryInterval: { 'ui:help': <div>Help text</div> },
  },
}

export default uiSchema
