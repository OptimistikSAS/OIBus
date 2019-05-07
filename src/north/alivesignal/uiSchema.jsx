import React from 'react'

const uiSchema = {
  applicationId: { 'ui:help': <div>Help text</div> },
  enabled: { 'ui:help': <div>Help text</div> },
  api: { 'ui:help': <div>Help text</div> },
  AliveSignal: {
    host: { 'ui:help': <div>Help text</div> },
    authentication: {
      type: { 'ui:help': <div>Help text</div> },
      username: { 'ui:help': <div>Help text</div> },
      password: {
        'ui:help': <div>Help text</div>,
        'ui:widget': 'password',
      },
    },
    id: { 'ui:help': <div>Help text</div> },
    frequency: { 'ui:help': <div>Help text</div> },
    defaultProxy: { 'ui:help': <div>Help text</div> },
  },
}

export default uiSchema
