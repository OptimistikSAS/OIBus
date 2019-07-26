import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom'
import { Container } from 'reactstrap'
import '@fortawesome/fontawesome-free/js/all.js'

import './style/main.less'

import TopHeader from './TopHeader.jsx'
import Welcome from './Welcome.jsx'
import NotFound from './NotFound.jsx'
import South from './South.jsx'
import North from './North.jsx'
import Engine from '../engine/Engine.jsx'
import ConfigureApi from '../north/ConfigureApi.jsx'
import ConfigureProtocol from '../south/ConfigureProtocol.jsx'
import ConfigurePoints from '../south/ConfigurePoints.jsx'
import Log from './Log.jsx'
import Health from './Health.jsx'
import AlertContainer from './components/AlertContainer.jsx'
import Context from './context/Context.jsx'

const Main = () => (
  <Router>
    <>
      <Context>
        <TopHeader />
        <Container className="oi-container-with-top-nav" fluid>
          <AlertContainer />
          <Switch>
            <Route exact path="/" component={Welcome} />
            <Route exact path="/engine" component={Engine} />
            <Route exact path="/south" component={South} />
            <Route exact path="/south/:protocol" component={ConfigureProtocol} />
            <Route exact path="/south/:protocol/:datasourceid/points" component={ConfigurePoints} />
            <Route exact path="/north" component={North} />
            <Route exact path="/north/:api" component={ConfigureApi} />
            <Route exact path="/log" component={Log} />
            <Route exact path="/health" component={Health} />
            <Route component={NotFound} />
          </Switch>
        </Container>
      </Context>
    </>
  </Router>
)

ReactDOM.render(<Main />, document.getElementById('root'))
