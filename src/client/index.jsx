import React from 'react'
import ReactDOM from 'react-dom'
import './style/main.less'

const Welcome = () => {
  const [configJson, setConfigJson] = React.useState()
  React.useEffect(() => {
    fetch('/infos').then((response) => {
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.indexOf('application/json') !== -1) {
        return response.json().then((json) => {
          setConfigJson(json)
        })
      }
      return null
    })
  })
  return (
    <>
      <h1 className="header">Hello</h1>
      <pre>{JSON.stringify(configJson, ' ', 2)}</pre>
    </>
  )
}

ReactDOM.render(<Welcome />, document.getElementById('root'))
