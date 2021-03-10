import React from 'react'
import { useParams } from 'react-router-dom'
import { Spinner } from 'reactstrap'
import { ConfigContext } from '../context/configContext.jsx'
import SouthForm from './Form/SouthForm.jsx'

const ConfigureProtocol = () => {
  const { newConfig, dispatchNewConfig, liveConfig } = React.useContext(ConfigContext)
  const dataSources = newConfig?.south?.dataSources // array of all defined dataSources
  const { dataSourceId } = useParams() // the dataSourceId passed in the url
  const lastCompletedDate = liveConfig?.find((c) => c.name === dataSourceId)
  const dataSourceIndex = dataSources?.findIndex((dataSource) => dataSource.dataSourceId === dataSourceId)

  const onChange = (name, value, validity) => {
    dispatchNewConfig({ type: 'update', name, value, validity })
  }

  return dataSourceIndex >= 0 ? (
    <SouthForm
      dataSource={dataSources[dataSourceIndex]}
      dataSourceIndex={dataSourceIndex}
      onChange={onChange}
      lastCompletedAt={lastCompletedDate?.lastCompletedAt}
    />
  ) : (
    <div className="spinner-container">
      <Spinner color="primary" type="grow" />
      ...loading configuration from OIBus server...
    </div>
  )
}

export default ConfigureProtocol
