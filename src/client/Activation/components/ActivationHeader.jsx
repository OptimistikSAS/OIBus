import React from 'react'
import { OIbTitle } from '../../components/OIbForm'

const ActivationHeader = () => (
  <OIbTitle label="Modifications">
    <div>
      <p>Modifications requested on the OIBus configuration are listed below</p>
      <p>The ACTIVE configuration is the one currently used by the OIBus server</p>
      <p>It will be replaced with the new configuration if you use the activate button</p>
      <p>The NEW configuration is the one that will be used OIBus server AFTER the activation</p>
    </div>
  </OIbTitle>
)

export default ActivationHeader
