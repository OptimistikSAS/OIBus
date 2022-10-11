import React from 'react'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'

import 'bootstrap/dist/css/bootstrap.min.css'
import './style/oi.css'

import { createRoot } from 'react-dom/client'
import TopHeader from './TopHeader.jsx'
import Activation from './Activation/Activation.jsx'
import NotFound from './NotFound.jsx'
import HistoryQuery from './HistoryQuery/HistoryQuery.jsx'
import Engine from './Engine/Engine.jsx'
import ConfigureNorth from './North/ConfigureNorth.jsx'
import ConfigureSouth from './South/ConfigureSouth.jsx'
import SouthStatus from './South/SouthStatus.jsx'
import NorthStatus from './North/NorthStatus.jsx'
import ConfigurePoints from './South/ConfigurePoints.jsx'
import Logs from './Logs/Logs.jsx'
import About from './About/About.jsx'
import HomePage from './Home/HomePage.jsx'
import AlertContainer from './components/AlertContainer.jsx'
import { AlertProvider } from './context/AlertContext.jsx'
import ConfigProviders from './context/ConfigProviders.jsx'
import ConfigureHistoryQuery from './HistoryQuery/ConfigureHistoryQuery.jsx'

const Main = () => (
  <Router>
    <ConfigProviders>
      <AlertProvider>
        <TopHeader />
        <div className="oi-container-with-top-nav">
          <AlertContainer />
          <Routes>
            <Route exact path="/" element={<HomePage />} />
            <Route exact path="/engine" element={<Engine />} />
            <Route exact path="/history-query" element={<HistoryQuery />} />
            <Route exact path="/history-query/:id" element={<ConfigureHistoryQuery />} />
            <Route exact path="/south/:id" element={<ConfigureSouth />} />
            <Route exact path="/south/:id/live" element={<SouthStatus />} />
            <Route exact path="/south/:id/points" element={<ConfigurePoints />} />
            <Route exact path="/north/:id" element={<ConfigureNorth />} />
            <Route exact path="/north/:id/live" element={<NorthStatus />} />
            <Route exact path="/log" element={<Logs />} />
            <Route exact path="/about" element={<About />} />
            <Route exact path="/activation" element={<Activation />} />
            <Route element={<NotFound />} />
          </Routes>
        </div>
      </AlertProvider>
    </ConfigProviders>
  </Router>
)

const container = document.getElementById('root')
const root = createRoot(container)
root.render(<Main />)
