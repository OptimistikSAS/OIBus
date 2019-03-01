import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom'

import './style/main.less'

import TopHeader from './TopHeader.jsx'
import Welcome from './Welcome.jsx'
import NotFound from './NotFound.jsx'
import South from './South.jsx'
import North from './North.jsx'
import Engine from '../engine/Engine.jsx'

const Main = () => (
  <Router>
    <div>
      <TopHeader />
      <Switch>
        <Route exact path="/" component={Welcome} />
        <Route exact path="/engine" component={Engine} />
        <Route exact path="/south" component={South} />
        <Route exact path="/north" component={North} />
        <Route component={NotFound} />
      </Switch>
    </div>
  </Router>
)

ReactDOM.render(<Main />, document.getElementById('root'))
