import React from 'react'

const uiSchema = {
  applicationId: { 'ui:help': '' },
  enabled: { 'ui:help': <div>If enabled, appication will be enabled</div> },
  api: { 'ui:help': '' },
  minimumBuffer: { 'ui:help': <div>The minimum buffer that will ensure date is not sent until value is reached</div> },
  maxTimeBuffer: { 'ui:help': <div>The maximum time while the buffer will be collected</div> },
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
    sendInterval: { 'ui:help': <div>Value in seconds for data sending interval</div> },
    retryInterval: { 'ui:help': <div>Value in seconds for retry sending data in case of failure</div> },
    groupCount: { 'ui:help': <div>Help text</div> },
  },
}

export default uiSchema
