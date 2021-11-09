import React from 'react'
import { useParams } from 'react-router'
import { Spinner } from 'reactstrap'
import { HistoryConfigContext } from '../context/historyContext.jsx'
import HistoryQueryForm from './Form/HistoryQueryForm.jsx'

const ConfigureHistoryQuery = () => {
  const { newHistoryConfig, dispatchNewHistoryConfig } = React.useContext(HistoryConfigContext)
  const { id } = useParams()
  const bulkIndex = newHistoryConfig.findIndex((bulk) => bulk.id === id)
  const bulkToUpdate = newHistoryConfig[bulkIndex]
  const onChange = (name, value, validity) => {
    dispatchNewHistoryConfig({ type: 'update', name: `${bulkIndex}.${name}`, value, validity })
  }

  return bulkToUpdate ? (
    <HistoryQueryForm
      bulk={bulkToUpdate}
      bulkIndex={bulkIndex}
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
