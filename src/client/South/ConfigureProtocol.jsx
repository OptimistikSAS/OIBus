import React from 'react'
import { useParams } from 'react-router-dom'
import { Spinner } from 'reactstrap'
import { ConfigContext } from '../context/ConfigContext.jsx'
import SouthForm from './Form/SouthForm.jsx'

const ConfigureProtocol = () => {
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  const dataSources = newConfig?.south // array of all defined dataSources
  const { id } = useParams() // the dataSource id passed in the url
  const dataSourceIndex = dataSources?.findIndex((dataSource) => dataSource.id === id)

  const onChange = (name, value, validity) => {
    dispatchNewConfig({ type: 'update', name, value, validity })
  }

  return dataSourceIndex >= 0 ? (
    <SouthForm
      dataSource={dataSources[dataSourceIndex]}
      dataSourceIndex={dataSourceIndex}
      onChange={onChange}
    />
  ) : (
    <div className="spinner-container">
      <Spinner color="primary" type="grow" />
      ...loading configuration from OIBus server...
    </div>
  )
}

export default ConfigureProtocol
