import React from 'react'
import { Container } from 'reactstrap'
import OIbTitle from '../components/OIbForm/OIbTitle.jsx'

import ActivationHeader from './components/ActivationHeader.jsx'
import HistoryConfigActivation from './HistoryConfigActivation.jsx'
import MainConfigActivation from './MainConfigActivation.jsx'

const Activation = () => (
  <Container fluid>
    <div className="m-2">
      <ActivationHeader />
      <OIbTitle label="OIBus config" />
      <MainConfigActivation />
      <OIbTitle label="History query config" />
      <HistoryConfigActivation />
    </div>
  </Container>
)
export default Activation
