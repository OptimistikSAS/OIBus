import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'
import { Container } from 'reactstrap'

import 'bootstrap/dist/css/bootstrap.min.css'
import './style/oi.css'

import TopHeader from './TopHeader.jsx'
import Activation from './Activation/Activation.jsx'
import NotFound from './NotFound.jsx'
import Engine from './Engine/Engine.jsx'
import ConfigureApi from './North/ConfigureApi.jsx'
import ConfigureProtocol from './South/ConfigureProtocol.jsx'
import SouthStatus from './South/SouthStatus.jsx'
import NorthStatus from './North/NorthStatus.jsx'
import ConfigurePoints from './South/ConfigurePoints.jsx'
import Logs from './Logs/Logs.jsx'
import About from './About/About.jsx'
import HomePage from './Home/HomePage.jsx'
import AlertContainer from './components/AlertContainer.jsx'
import { AlertProvider } from './context/AlertContext.jsx'
import { ConfigProvider } from './context/ConfigContext.jsx'

const Main = () => (
  <Router>
    <ConfigProvider>
      <AlertProvider>
        <TopHeader />
        <Container className="oi-container-with-top-nav" fluid>
          <AlertContainer />
          <Routes>
            <Route exact path="/" element={<HomePage />} />
            <Route exact path="/engine" element={<Engine />} />
            <Route exact path="/south/:id" element={<ConfigureProtocol />} />
            <Route exact path="/south/:id/live" element={<SouthStatus />} />
            <Route exact path="/north/:id/live" element={<NorthStatus />} />
            <Route exact path="/south/:id/points" element={<ConfigurePoints />} />
            <Route exact path="/north/:id" element={<ConfigureApi />} />
            <Route exact path="/log" element={<Logs />} />
            <Route exact path="/about" element={<About />} />
            <Route exact path="/activation" element={<Activation />} />
            <Route element={<NotFound />} />
          </Routes>
        </Container>
      </AlertProvider>
    </ConfigProvider>
  </Router>
)

ReactDOM.render(<Main />, document.getElementById('root'))
