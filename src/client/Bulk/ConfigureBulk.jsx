import React from 'react'
import { useParams } from 'react-router'
import { Spinner } from 'reactstrap'
import { HistoryConfigContext } from '../context/historyContext.jsx'
import BulkForm from './Form/BulkForm.jsx'

const ConfigureBulk = () => {
  const { newHistoryConfig, dispatchNewHistoryConfig } = React.useContext(HistoryConfigContext)
  const { id } = useParams()
  const bulkIndex = newHistoryConfig.findIndex((bulk) => bulk.id === id)
  const bulkToUpdate = newHistoryConfig[bulkIndex]
  const onChange = (name, value, validity) => {
    dispatchNewHistoryConfig({ type: 'update', name: `${bulkIndex}.${name}`, value, validity })
  }

  return bulkToUpdate ? (
    <BulkForm
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

export default ConfigureBulk
