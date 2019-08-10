import React from 'react'

const LinkForm = () => {
  const form1 = {
    host: {
      type: 'string',
      title: 'Host',
    },
    endpoint: { title: 'Endpoint' },
    authentication: {
      title: 'Authentication',
      properties: {
        type: {
          title: 'Type',
          default: 'Basic',
        },
        username: { title: 'Username' },
        password: { title: 'Password' },
      },
    },
    proxy: {
      type: 'string',
      title: 'Proxy',
    },
    stack: {
      title: 'Stack',
      enum: ['axios', 'request', 'fetch'],
    },
  }

  const form2 = {
    applicationId: {
      'ui:help': '<div>Unique name for this Link</div>',
      'ui:readonly': true,
    },
    enabled: { 'ui:help': '<div>Enable or not the Link</div>' },
    api: { 'ui:readonly': true },
    Link: {
      host: { 'ui:help': '<div>The host for the another OIBus</div>' },
      endpoint: { 'ui:help': '' },
      authentication: {
        type: { 'ui:help': '' },
        username: { 'ui:help': '' },
        password: {
          'ui:widget': 'password',
          'ui:help': '',
        },
      },
      proxy: { 'ui:help': '' },
      stack: { 'ui:help': '' },
    },
    caching: {
      sendInterval: { 'ui:help': '<div>Value in milliseconds for data sending interval</div>' },
      retryInterval: { 'ui:help': '<div>Value in milliseconds for retry sending data in case of failure</div>' },
      groupCount: { 'ui:help': '<div>The minimum buffer that will ensure date is not sent until value is reached</div>' },
      maxSendCount: { 'ui:help': '' },
    },
    subscribedTo: { 'ui:help': '<div>allow to select South equipment (default is to receive from all enabled equipment of the current OIBus</div>' },
  }
  return (
    <>
      <pre>{JSON.stringify(form1)}</pre>
      <pre>{JSON.stringify(form2)}</pre>
    </>
  )
}
export default LinkForm
