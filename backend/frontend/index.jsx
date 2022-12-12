import React from 'react'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'

import 'bootstrap/dist/css/bootstrap.min.css'
import './style/oi.css'

import { createRoot } from 'react-dom/client'
import TopHeader from './top-header.jsx'
import Activation from './activation/activation.jsx'
import NotFound from './not-found.jsx'
import HistoryQuery from './history-query/history-query.jsx'
import Engine from './engine/engine.jsx'
import ConfigureNorth from './north/configure-north.jsx'
import ConfigureSouth from './south/configure-south.jsx'
import SouthStatus from './south/south-status.jsx'
import NorthStatus from './north/north-status.jsx'
import ConfigurePoints from './south/configure-points.jsx'
import Logs from './logs/logs.jsx'
import About from './about/about.jsx'
import HomePage from './home/home-page.jsx'
import AlertContainer from './components/alert-container.jsx'
import { AlertProvider } from './context/alert-context.jsx'
import ConfigProviders from './context/config-providers.jsx'
import ConfigureHistoryQuery from './history-query/configure-history-query.jsx'
import HistoryQueryForm from './history-query/form/history-query-form.jsx'

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
            <Route exact path="/history-query/:id/edit" element={<ConfigureHistoryQuery />} />
            <Route exact path="/history-query/create" element={<HistoryQueryForm mode="create" />} />
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
