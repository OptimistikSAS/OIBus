import React from 'react'

const uiSchema = {
  applicationId: { 'ui:help': '' },
  enabled: { 'ui:help': <div>If enabled, appication will be enabled</div> },
  api: { 'ui:help': '' },
  minimumBuffer: { 'ui:help': <div>The minimum buffer that will ensure date is not sent until value is reached</div> },
  timeStamp: { 'ui:help': '' },
  caching: {
    sendInterval: { 'ui:help': <div>Value in seconds for data sending interval</div> },
    retryInterval: { 'ui:help': <div>Value in seconds for retry sending data in case of failure</div> },
    groupCount: { 'ui:help': '' },
  },
}

export default uiSchema
