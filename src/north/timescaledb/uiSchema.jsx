import React from 'react'

const uiSchema = {
  applicationId: { 'ui:help': <div>Help text</div> },
  enabled: { 'ui:help': <div>Help text</div> },
  api: { 'ui:help': <div>Help text</div> },
  minimumBuffer: { 'ui:help': <div>Help text</div> },
  TimescaleDB: {
    user: { 'ui:help': <div>Help text</div> },
    password: {
      'ui:widget': 'password',
      'ui:help': <div>Help text</div>,
    },
    db: { 'ui:help': <div>Help text</div> },
    host: { 'ui:help': <div>Help text</div> },
  },
  caching: {
    sendInterval: { 'ui:help': <div>Help text</div> },
    retryInterval: { 'ui:help': <div>Help text</div> },
    groupCount: { 'ui:help': <div>Help text</div> },
  },
}

export default uiSchema
