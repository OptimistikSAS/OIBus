import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Col, Spinner } from 'reactstrap'
import Table from '../components/table/Table.jsx'
import { ConfigContext } from '../context/configContext.jsx'
import { HistoryConfigContext } from '../context/historyContext.jsx'
import NewHistoryQueryRow from './NewHistoryQueryRow.jsx'

const HistoryQuery = () => {
  const { newConfig } = React.useContext(ConfigContext)
  const { newHistoryConfig: unorderedHistoryQueries, dispatchNewHistoryConfig } = React.useContext(HistoryConfigContext)
  const applications = newConfig?.north?.applications
  const dataSources = newConfig?.south?.dataSources
  const navigate = useNavigate()

  const historyQueries = unorderedHistoryQueries.slice().sort((a, b) => (a.order > b.order ? 1 : -1))

  /**
   * @param {number} indexInTable the index of a point in the table
   * @returns {number} the index in the config file of the chosen point
   */
  const findIndexBasedOnOrderNumber = (indexInTable) => {
    const queryToOperate = historyQueries[indexInTable]
    const index = unorderedHistoryQueries.findIndex((historyQuery) => historyQuery.order === queryToOperate.order)
    return index
  }

  /**
   * Handles the edit of history query and redirects the
   * user to the selected north history query's configuration page
   * @param {integer} position The id to edit
   * @return {void}
   */
  const handleEdit = (position) => {
    const historyQuery = unorderedHistoryQueries[findIndexBasedOnOrderNumber(position)]
    const link = `/historyQuery/${historyQuery.id}`
    navigate(link)
  }

  /**
   * Calculates the status of history query read based on the end time and start time in percent
   * @param {Date} startTime The start time of history query
   * @param {Date} endTime The end time of history query
   * @param {Date} lastCompleted The lastCompleted date of history query
   * @return {number} The status percent
   */
  const percentageCalculator = (startTime, endTime, lastCompleted) => {
    if (!lastCompleted) {
      return 0
    }
    const differenceFromStartToEnd = new Date(endTime).getTime() - new Date(startTime).getTime()
    const differenceFromLastCompletedToEnd = new Date(endTime).getTime() - new Date(lastCompleted).getTime()
    return differenceFromLastCompletedToEnd > 0 ? (100 - ((differenceFromLastCompletedToEnd * 100) / differenceFromStartToEnd)).toFixed(2) : 100
  }

  /**
   * Adds a new history query row to the table
   * @param {Object} queryObject A history query object containing
   * @returns {void}
   */
  const addHistoryQuery = (queryObject) => {
    dispatchNewHistoryConfig({ type: 'addRow', name: '', value: queryObject })
  }

  /**
   * Deletes the chosen history query
   * @param {integer} position The index to delete
   * @returns {void}
   */
  const handleDelete = (position) => {
    unorderedHistoryQueries.forEach((currentQuery, index) => {
      if (currentQuery.order > position + 1) {
        dispatchNewHistoryConfig({ type: 'update', name: `${index}.order`, value: currentQuery.order - 1 })
      }
    })
    dispatchNewHistoryConfig({ type: 'deleteRow', name: findIndexBasedOnOrderNumber(position) })
  }

  /**
   * Copy the chosen history query
   * @param {integer} position The id to copy
   * @returns {void}
   */
  const handleDuplicate = (position) => {
    const historyQuery = unorderedHistoryQueries[findIndexBasedOnOrderNumber(position)]
    const newName = `${historyQuery.name} copy`
    const countCopies = historyQueries.filter((e) => e.name.startsWith(newName)).length
    dispatchNewHistoryConfig({
      type: 'addRow',
      value: {
        ...historyQuery,
        name: `${newName}${countCopies > 0 ? countCopies + 1 : ''}`,
        enabled: false,
        order: historyQueries.length + 1,
      },
    })
  }

  /**
   * Updates the order if one of the arrow was pressed
   * @param {string} type The type of order (up or down)
   * @param {number} positionInTable The position of the history query in the table
   * @returns {void}
   */
  const handleOrder = (type, positionInTable) => {
    const historyQuery = unorderedHistoryQueries[findIndexBasedOnOrderNumber(positionInTable)]
    switch (type) {
      case 'up': {
        if (positionInTable > 0) {
          dispatchNewHistoryConfig({ type: 'update', name: `${findIndexBasedOnOrderNumber(positionInTable)}.order`, value: historyQuery.order - 1 })
          dispatchNewHistoryConfig({ type: 'update', name: `${findIndexBasedOnOrderNumber(positionInTable - 1)}.order`, value: historyQuery.order })
        }
        break
      }
      case 'down': {
        if (positionInTable < historyQueries.length - 1) {
          dispatchNewHistoryConfig({ type: 'update', name: `${findIndexBasedOnOrderNumber(positionInTable)}.order`, value: historyQuery.order + 1 })
          dispatchNewHistoryConfig({ type: 'update', name: `${findIndexBasedOnOrderNumber(positionInTable + 1)}.order`, value: historyQuery.order })
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

  const tableHeaders = ['Order', 'Query', 'Status', 'Period', 'Percentage']
  const tableRows = historyQueries?.map(({ name, status, startTime, endTime, order }) => [
    {
      name: order,
      value: `${order}.`,
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
    { name: 'percentage', value: `${percentageCalculator(startTime, endTime, new Date())} %` },
  ])

  return tableRows ? (
    <Col md="8" className="bulk">
      <Table
        headers={tableHeaders}
        rows={tableRows}
        handleEdit={handleEdit}
        handleDelete={handleDelete}
        handleDuplicate={handleDuplicate}
        handleOrder={handleOrder}
      />
      {applications && dataSources
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
