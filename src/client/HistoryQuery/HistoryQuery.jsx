import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Col, Spinner } from 'reactstrap'
import { nanoid } from 'nanoid'
import Table from '../components/table/Table.jsx'
import { ConfigContext } from '../context/ConfigContext.jsx'
import NewHistoryQueryRow from './NewHistoryQueryRow.jsx'
import apis from '../services/apis'

const HistoryQuery = () => {
  const { newConfig } = React.useContext(ConfigContext)
  const [queries, setQueries] = React.useState([])
  const applications = newConfig?.north?.applications ?? []
  const dataSources = newConfig?.south?.dataSources ?? []
  const navigate = useNavigate()

  React.useEffect(() => {
    apis.getHistoryQueries()
      .then((response) => {
        setQueries(response)
      })
      .catch((_error) => console.warn('Could not get the history queries'))
  }, [])

  const historyQueries = queries.slice().sort((a, b) => (a.orderColumn > b.orderColumn ? 1 : -1))

  /**
   * @param {number} indexInTable the index of a point in the table
   * @returns {number} the index in the config file of the chosen point
   */
  const findIndexBasedOnId = (indexInTable) => {
    const queryToOperate = historyQueries[indexInTable]
    return queries.findIndex((historyQuery) => historyQuery.id === queryToOperate.id)
  }

  /**
   * Handles the edit of history query and redirects the
   * user to the selected north history query's configuration page
   * @param {integer} position The id to edit
   * @return {void}
   */
  const handleEdit = (position) => {
    const historyQuery = queries[findIndexBasedOnId(position)]
    navigate(`/history-query/${historyQuery.id}`)
  }

  /**
   * Adds a new history query row to the table
   * @param {Object} queryObject A history query object containing
   * @returns {void}
   */
  const addHistoryQuery = async (queryObject) => {
    apis.createHistoryQuery(queryObject).then((response) => {
      navigate(`/history-query/${response.id}`)
    })
  }

  /**
   * Deletes the chosen history query
   * @param {integer} position The index to delete
   * @returns {void}
   */
  const handleDelete = async (position) => {
    const queryToDelete = queries[findIndexBasedOnId(position)]
    await apis.deleteHistoryQuery(queryToDelete.id, position)
    apis.getHistoryQueries()
      .then((response) => {
        setQueries(response)
      })
  }

  /**
   * Copy the chosen history query
   * @param {integer} position The id to copy
   * @returns {void}
   */
  const handleDuplicate = (position) => {
    const historyQuery = queries[findIndexBasedOnId(position)]
    const newName = `${historyQuery.name} copy`
    const countCopies = historyQueries.filter((e) => e.name.startsWith(newName)).length
    apis.createHistoryQuery({
      ...historyQuery,
      id: nanoid(),
      name: `${newName}${countCopies > 0 ? countCopies + 1 : ''}`,
      enabled: false,
      status: 'pending',
      orderColumn: historyQueries.length + 1,
    }).then((response) => {
      setQueries([...queries, response])
    })
  }

  /**
   * Updates the order if one of the arrow was pressed
   * @param {string} type The type of order (up or down)
   * @param {number} positionInTable The position of the history query in the table
   * @returns {void}
   */
  const handleOrder = async (type, positionInTable) => {
    const historyQuery = queries[findIndexBasedOnId(positionInTable)]
    switch (type) {
      case 'up': {
        if (positionInTable > 0) {
          const historyQueryAbove = queries[findIndexBasedOnId(positionInTable - 1)]
          await apis.orderHistoryQuery(historyQuery.id, { orderColumn: historyQuery.orderColumn - 1 })
          await apis.orderHistoryQuery(historyQueryAbove.id, { orderColumn: historyQuery.orderColumn })
          setQueries(queries.map((query) => {
            if (query.id === historyQuery.id) {
              return {
                ...query,
                orderColumn: historyQuery.orderColumn - 1,
              }
            }
            if (query.id === historyQueryAbove.id) {
              return {
                ...query,
                orderColumn: historyQuery.orderColumn,
              }
            }
            return query
          }))
        }
        break
      }
      case 'down': {
        if (positionInTable < historyQueries.length - 1) {
          const historyQueryBelow = queries[findIndexBasedOnId(positionInTable + 1)]
          await apis.orderHistoryQuery(historyQuery.id, { orderColumn: historyQuery.orderColumn + 1 })
          await apis.orderHistoryQuery(historyQueryBelow.id, { orderColumn: historyQuery.orderColumn })
          setQueries(queries.map((query) => {
            if (query.id === historyQuery.id) {
              return {
                ...query,
                orderColumn: historyQuery.orderColumn + 1,
              }
            }
            if (query.id === historyQueryBelow.id) {
              return {
                ...query,
                orderColumn: historyQuery.orderColumn,
              }
            }
            return query
          }))
        }
        break
      }
      default: break
    }
  }

  /**
   * Returns the text color for each status
   * @param {string} status The status of the current history query
   * @returns {string} The color represented by the status
   */
  const statusColor = (status) => {
    switch (status) {
      case 'pending': return 'text-warning'
      case 'exporting': return 'text-info'
      case 'importing': return 'text-primary'
      case 'finished': return 'text-success'
      default: return 'text-primary'
    }
  }

  const tableHeaders = ['Order', 'Query', 'Status', 'Period']
  const tableRows = historyQueries?.map(({ name, status, startTime, endTime, orderColumn }) => [
    {
      name: orderColumn,
      value: `${orderColumn}.`,
    },
    {
      name: 'name',
      value: name,
    },
    {
      name: 'status',
      value: <div className={statusColor(status || 'pending')}>{status || 'pending'}</div>,
    },
    { name: 'period', value: startTime && endTime ? `${startTime} -> ${endTime}` : 'Dates not specified' },
  ])

  return tableRows ? (
    <Col md="8" className="m-5">
      {tableRows.length ? (
        <Table
          headers={tableHeaders}
          rows={tableRows}
          handleEdit={handleEdit}
          handleDelete={handleDelete}
          handleDuplicate={handleDuplicate}
          handleOrder={handleOrder}
          isHistoryQuery
        />
      )
        : (
          <h6>
            There is no history query yet, create one by using the form below.
          </h6>
        )}
      {applications.length > 0 && dataSources.length > 0
      && (
      <NewHistoryQueryRow
        northHandlers={applications}
        southHandlers={dataSources}
        addQuery={addHistoryQuery}
        queriesNumber={historyQueries.length}
      />
      )}
    </Col>
  ) : (
    <div className="spinner-container">
      <Spinner color="primary" type="grow" />
      ...loading configuration from OIBus server...
    </div>
  )
}

export default HistoryQuery
