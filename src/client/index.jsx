import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom'

import './style/main.less'

import TopHeader from './TopHeader.jsx'
import NotFound from './NotFound.jsx'
import South from './South.jsx'
import North from './North.jsx'
import Engine from './Engine.jsx'

const Main = () => {
  const [configJson, setConfigJson] = React.useState()
  React.useEffect(() => {
    fetch('/infos').then((response) => {
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.indexOf('application/json') !== -1) {
        return response.json().then(({ config }) => {
          setConfigJson(config)
        })
      }
      return null
    })
  })
  return (
    <Router>
      <div>
        <TopHeader />
        <Switch>
          <Route exact path="/engine" render={() => <Engine configJson={configJson} />} />
          <Route exact path="/south" render={() => <South configJson={configJson} />} />
          <Route exact path="/north" render={() => <North configJson={configJson} />} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </Router>
  )
}

ReactDOM.render(<Main />, document.getElementById('root'))
