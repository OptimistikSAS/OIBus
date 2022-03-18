import React from 'react'
import { Container } from 'reactstrap'
import OIbTitle from '../components/OIbForm/OIbTitle.jsx'

import ActivationHeader from './components/ActivationHeader.jsx'
import MainConfigActivation from './MainConfigActivation.jsx'

const Activation = () => (
  <Container fluid>
    <div className="m-2">
      <ActivationHeader />
      <OIbTitle label="OIBus config" />
      <MainConfigActivation />
    </div>
  </Container>
)
export default Activation
