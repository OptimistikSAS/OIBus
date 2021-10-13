import React from 'react'
import { useParams } from 'react-router'
import { Spinner } from 'reactstrap'
import { HistoryConfigContext } from '../context/historyContext.jsx'
import BulkForm from './Form/BulkForm.jsx'

const ConfigureBulk = () => {
  const { newHistoryConfig, dispatchNewHistoryConfig } = React.useContext(HistoryConfigContext)
  const { id } = useParams()
  const bulkToUpdate = newHistoryConfig.find((bulk) => bulk.id === id)

  const onChange = (name, value, validity) => {
    dispatchNewHistoryConfig({ type: 'update', name, value, validity })
  }
  return bulkToUpdate ? (
    <BulkForm
      bulk={bulkToUpdate}
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
