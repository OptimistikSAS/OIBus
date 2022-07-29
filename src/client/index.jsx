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
import ConfigProviders from './context/ConfigProviders.jsx'
import { SchemaProvider } from './context/SchemaContext.jsx'
import ConfigureHistoryQuery from './HistoryQuery/ConfigureHistoryQuery.jsx'

const Main = () => (
  <Router>
    <SchemaProvider>
      <ConfigProviders>
        <AlertProvider>
          <TopHeader />
          <div className="oi-container-with-top-nav">
            <AlertContainer />
            <Routes>
              <Route end path="/" element={<HomePage />} />
              <Route end path="/engine" element={<Engine />} />
              <Route end path="/history-query" element={<HistoryQuery />} />
              <Route end path="/history-query/:id" element={<ConfigureHistoryQuery />} />
              <Route end path="/south/:id" element={<ConfigureProtocol />} />
              <Route end path="/south/:id/live" element={<SouthStatus />} />
              <Route end path="/south/:id/points" element={<ConfigurePoints />} />
              <Route end path="/north/:id" element={<ConfigureApi />} />
              <Route end path="/north/:id/live" element={<NorthStatus />} />
              <Route end path="/log" element={<Logs />} />
              <Route end path="/about" element={<About />} />
              <Route end path="/activation" element={<Activation />} />
              <Route element={<NotFound />} />
            </Routes>
          </div>
        </AlertProvider>
      </ConfigProviders>
    </SchemaProvider>
  </Router>
)

const container = document.getElementById('root')
const root = createRoot(container)
root.render(<Main />)
