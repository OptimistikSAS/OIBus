import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom'
import { Container } from 'reactstrap'

import './style/main.less'

import TopHeader from './TopHeader.jsx'
import Activation from './Activation/Activation.jsx'
import NotFound from './NotFound.jsx'
import Engine from './Engine/Engine.jsx'
import ConfigureApi from './North/ConfigureApi.jsx'
import ConfigureProtocol from './South/ConfigureProtocol.jsx'
import SouthStatus from './South/SouthStatus.jsx'
import ConfigurePoints from './South/ConfigurePoints.jsx'
import Logs from './Logs/Logs.jsx'
import About from './About/About.jsx'
import Health from './Health/Health.jsx'
import AlertContainer from './components/AlertContainer.jsx'
import { AlertProvider } from './context/AlertContext.jsx'
import { ConfigProvider } from './context/configContext.jsx'

const Main = () => (
  <Router>
    <>
      <ConfigProvider>
        <AlertProvider>
          <TopHeader />
          <Container className="oi-container-with-top-nav" fluid>
            <AlertContainer />
            <Switch>
              <Route exact path="/" component={Health} />
              <Route exact path="/engine" component={Engine} />
              <Route exact path="/south/:id" component={ConfigureProtocol} />
              <Route exact path="/south/:id/live" component={SouthStatus} />
              <Route exact path="/south/:id/points" component={ConfigurePoints} />
              <Route exact path="/north/:id" component={ConfigureApi} />
              <Route exact path="/log" component={Logs} />
              <Route exact path="/about" component={About} />
              <Route exact path="/activation" component={Activation} />
              <Route component={NotFound} />
            </Switch>
          </Container>
        </AlertProvider>
      </ConfigProvider>
    </>
  </Router>
)

ReactDOM.render(<Main />, document.getElementById('root'))
