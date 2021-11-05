import React from 'react'
import OIbTitle from '../components/OIbForm/OIbTitle.jsx'

import ActivationHeader from './components/ActivationHeader.jsx'
import HistoryConfigActivation from './HistoryConfigActivation.jsx'
import MainConfigActivation from './MainConfigActivation.jsx'

const Activation = () => (
  <>
    <ActivationHeader />
    <OIbTitle label="OIBus config" />
    <MainConfigActivation />
    <OIbTitle label="Bulk config" />
    <HistoryConfigActivation />
  </>
)
export default Activation
