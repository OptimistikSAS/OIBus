import React from 'react'
import { useParams } from 'react-router-dom'
import { Spinner } from 'reactstrap'
import { ConfigContext } from '../context/ConfigContext.jsx'
import SouthForm from './Form/SouthForm.jsx'

const ConfigureSouth = () => {
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  const southConnectors = newConfig?.south // array of all defined south connectors
  const { id } = useParams() // the south id passed in the url
  const southIndex = southConnectors?.findIndex((south) => south.id === id)

  const onChange = (name, value, validity) => {
    dispatchNewConfig({ type: 'update', name, value, validity })
  }

  return southIndex >= 0 ? (
    <SouthForm
      south={southConnectors[southIndex]}
      southIndex={southIndex}
      onChange={onChange}
    />
  ) : (
    <div className="spinner-container">
      <Spinner color="primary" type="grow" />
      ...loading configuration from OIBus server...
    </div>
  )
}

export default ConfigureSouth
