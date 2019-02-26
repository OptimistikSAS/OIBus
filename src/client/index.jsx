import React from 'react'
import ReactDOM from 'react-dom'
import './style/main.less'

// eslint-disable-next-line
class Welcome extends React.Component {
  render() {
    return (
      <>
        <h1 className="header">Hello</h1>
        <p>World</p>
      </>
    )
  }
}

ReactDOM.render(<Welcome />, document.getElementById('root'))
