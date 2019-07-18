import React from 'react'

const uiSchema = {
  applicationId: { 'ui:help': <div>Unique name for this Link</div> },
  enabled: { 'ui:help': <div>Enable or not the Link</div> },
  api: { 'ui:readonly': true },
  host: { 'ui:help': '<div>The host for the another OIBus</div>>' },
  caching: {
    sendInterval: { 'ui:help': <div>Value in milliseconds for data sending interval</div> },
    retryInterval: { 'ui:help': <div>Value in milliseconds for retry sending data in case of failure</div> },
    groupCount: { 'ui:help': <div>The minimum buffer that will ensure date is not sent until value is reached</div> },
  },
  subscribedTo: { 'ui:help': <div>allow to select South equipment (default is to receive from all enabled equipment of the current OIBus</div> },
}

export default uiSchema
