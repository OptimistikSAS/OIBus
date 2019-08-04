import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom'
import { Container } from 'reactstrap'
import '@fortawesome/fontawesome-free/js/all.js'

import './style/main.less'

import TopHeader from './TopHeader.jsx'
import Welcome from './Welcome.jsx'
import NotFound from './NotFound.jsx'
import South from './South/South.jsx'
import North from './North/North.jsx'
import Engine from './Engine/Engine.jsx'
import ConfigureApi from '../north/ConfigureApi.jsx'
import ConfigureProtocol from '../south/ConfigureProtocol.jsx'
import ConfigurePoints from '../south/ConfigurePoints.jsx'
import Logs from './Logs/Logs.jsx'
import Health from './Health/Health.jsx'
import AlertContainer from './components/AlertContainer.jsx'
import { AlertProvider } from './context/AlertContext.jsx'
import { EngineProvider } from './context/configContext.jsx'

const Main = () => (
  <Router>
    <>
      <EngineProvider>
        <AlertProvider>
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
              <Route exact path="/log" component={Logs} />
              <Route exact path="/health" component={Health} />
              <Route component={NotFound} />
            </Switch>
          </Container>
        </AlertProvider>
      </EngineProvider>
    </>
  </Router>
)

ReactDOM.render(<Main />, document.getElementById('root'))
