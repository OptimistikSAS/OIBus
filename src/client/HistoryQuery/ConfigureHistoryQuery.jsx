import React from 'react'
import { useParams } from 'react-router'
import { Spinner } from 'reactstrap'
import { HistoryConfigContext } from '../context/HistoryContext.jsx'
import HistoryQueryForm from './Form/HistoryQueryForm.jsx'

const ConfigureHistoryQuery = () => {
  const { newHistoryConfig, dispatchNewHistoryConfig } = React.useContext(HistoryConfigContext)
  const { id } = useParams()
  const queryIndex = newHistoryConfig.findIndex((query) => query.id === id)
  const queryToUpdate = newHistoryConfig[queryIndex]
  const onChange = (name, value, validity) => {
    dispatchNewHistoryConfig({ type: 'update', name: `${queryIndex}.${name}`, value, validity })
  }

  return queryToUpdate ? (
    <HistoryQueryForm
      query={queryToUpdate}
      queryIndex={queryIndex}
      onChange={onChange}
    />
  ) : (
    <div className="spinner-container">
      <Spinner color="primary" type="grow" />
      ...loading configuration from OIBus server...
    </div>
  )
}

export default ConfigureHistoryQuery
