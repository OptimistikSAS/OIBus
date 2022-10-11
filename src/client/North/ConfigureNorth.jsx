import React from 'react'
import { useParams } from 'react-router-dom'
import { Spinner } from 'reactstrap'
import { ConfigContext } from '../context/ConfigContext.jsx'
import NorthForm from './Form/NorthForm.jsx'

const ConfigureNorth = () => {
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  const northConnectors = newConfig?.north ?? []// array of all defined North connectors
  const { id } = useParams()
  const northIndex = northConnectors.findIndex((north) => north.id === id)

  const onChange = (name, value, validity) => {
    dispatchNewConfig({ type: 'update', name, value, validity })
  }
  return northIndex >= 0 ? (
    <NorthForm
      north={northConnectors[northIndex]}
      northIndex={northIndex}
      onChange={onChange}
    />
  ) : (
    <div className="spinner-container">
      <Spinner color="primary" type="grow" />
      ...loading configuration from OIBus server...
    </div>
  )
}

export default ConfigureNorth
