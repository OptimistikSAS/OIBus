import React from 'react'
import { useParams } from 'react-router'
import { Spinner } from 'reactstrap'
import HistoryQueryForm from './form/history-query-form.jsx'
import apis from '../service/apis'

const ConfigureHistoryQuery = () => {
  const { id } = useParams()
  const [query, setQuery] = React.useState(null)

  React.useEffect(() => {
    apis.getHistoryQueryById(id).then((response) => {
      setQuery(response)
    })
  }, [])

  return query ? (
    <HistoryQueryForm
      query={query}
    />
  ) : (
    <div className="spinner-container">
      <Spinner color="primary" type="grow" />
      ...loading configuration from OIBus server...
    </div>
  )
}

export default ConfigureHistoryQuery
