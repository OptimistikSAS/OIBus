import React from 'react'

// import { } from 'reactstrap'

const North = () => {
  const [configJson, setConfigJson] = React.useState()
  React.useLayoutEffect(() => {
    // eslint-disable-next-line consistent-return
    fetch('/config').then((response) => {
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.indexOf('application/json') !== -1) {
        return response.json().then(({ config }) => {
          setConfigJson(config)
        })
      }
    })
  }, [])

  return (
    <>
      <h1>North</h1>
      <pre>{configJson && JSON.stringify(configJson.north, ' ', 2)}</pre>
    </>
  )
}

export default North
