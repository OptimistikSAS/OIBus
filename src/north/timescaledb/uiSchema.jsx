import React from 'react'

const uiSchema = {
  applicationId: { 'ui:help': '' },
  enabled: { 'ui:help': <div>If enabled, appication will be enabled</div> },
  api: { 'ui:help': '' },
  minimumBuffer: { 'ui:help': <div>The value of minimum buffer</div> },
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
}

export default uiSchema
