import React from 'react'

const uiSchema = {
  applicationId: {
    'ui:help': <div>Unique name for this Console</div>,
    'ui:readonly': true,
  },
  enabled: { 'ui:help': <div>Enable or not the Console</div> },
  api: { 'ui:readonly': true },
  caching: {
    sendInterval: { 'ui:help': <div>Value in milliseconds for data sending interval</div> },
    retryInterval: { 'ui:help': <div>Value in milliseconds for retry sending data in case of failure</div> },
    groupCount: { 'ui:help': <div>The minimum buffer that will ensure date is not sent until value is reached</div> },
    maxSendCount: { 'ui:help': <div>The maximum buffer that the north app can support</div> },
  },
  subscribedTo: { 'ui:help': <div>allow to select South data source (default is to receive from all enabled data source of the current OIBus</div> },
}

export default uiSchema
