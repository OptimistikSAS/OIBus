import React from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Col, Spinner, Breadcrumb, BreadcrumbItem } from 'reactstrap'
import Table from '../components/table/Table.jsx'
import { ConfigContext } from '../context/configContext.jsx'
import { HistoryConfigContext } from '../context/historyContext.jsx'
import NewBulkRow from './NewBulkRow.jsx'

const Bulk = () => {
  const { newConfig } = React.useContext(ConfigContext)
  const { newHistoryConfig: unorderedBulks, dispatchNewHistoryConfig } = React.useContext(HistoryConfigContext)
  const applications = newConfig?.north?.applications
  const dataSources = newConfig?.south?.dataSources
  const navigate = useNavigate()

  const bulks = unorderedBulks.slice().sort((a, b) => (a.order > b.order ? 1 : -1))

  /**
   * @param {number} indexInTable the index of a point in the table
   * @returns {number} the index in the config file of the chosen point
   */
  const findIndexBasedOnOrderNumber = (indexInTable) => {
    const bulkToOperate = bulks[indexInTable]
    const index = unorderedBulks.findIndex((bulk) => bulk.order === bulkToOperate.order)
    return index
  }

  /**
   * Handles the edit of bulk and redirects the
   * user to the selected north bulk's configuration page
   * @param {integer} position The id to edit
   * @return {void}
   */
  const handleEdit = (position) => {
    const bulk = unorderedBulks[findIndexBasedOnOrderNumber(position)]
    const link = `/bulk/${bulk.id}`
    navigate(link)
  }

  /**
   * Calculates the status of bulk read based on the end time and start time in percent
   * @param {Date} startTime The start time of bulk
   * @param {Date} endTime The end time of bulk
   * @return {number} The status percent
   */
  const percentageCalculator = (startTime, endTime) => {
    const differenceFromStartToEnd = new Date(endTime).getTime() - new Date(startTime).getTime()
    // TODO: The current date should be replaced with the last completed date
    const differenceFromNowToEnd = new Date(endTime).getTime() - new Date().getTime()
    return differenceFromNowToEnd > 0 ? (100 - ((differenceFromNowToEnd * 100) / differenceFromStartToEnd)).toFixed(2) : 100
  }

  /**
   * Adds a new bulk row to the table
   * @param {Object} bulkObject A bulk object containing
   * @returns {void}
   */
  const addBulk = (bulkObject) => {
    dispatchNewHistoryConfig({ type: 'addRow', name: '', value: bulkObject })
  }

  /**
   * Deletes the chosen bulk
   * @param {integer} position The index to delete
   * @returns {void}
   */
  const handleDelete = (position) => {
    unorderedBulks.forEach((currentBulk, index) => {
      if (currentBulk.order > position + 1) {
        dispatchNewHistoryConfig({ type: 'update', name: `${index}.order`, value: currentBulk.order - 1 })
      }
    })
    dispatchNewHistoryConfig({ type: 'deleteRow', name: findIndexBasedOnOrderNumber(position) })
  }

  /**
   * Copy the chosen bulk
   * @param {integer} position The id to copy
   * @returns {void}
   */
  const handleDuplicate = (position) => {
    const bulk = unorderedBulks[findIndexBasedOnOrderNumber(position)]
    const newName = `${bulk.name} copy`
    const countCopies = bulks.filter((e) => e.name.startsWith(newName)).length
    dispatchNewHistoryConfig({
      type: 'addRow',
      value: {
        ...bulk,
        name: `${newName}${countCopies > 0 ? countCopies + 1 : ''}`,
        enabled: false,
        order: bulks.length + 1,
      },
    })
  }

  /**
   * Updates the order if one of the arrow was pressed
   * @param {string} type The type of order (up or down)
   * @param {number} positionInTable The position of the bulk in the table
   * @returns {void}
   */
  const handleOrder = (type, positionInTable) => {
    const bulk = unorderedBulks[findIndexBasedOnOrderNumber(positionInTable)]
    switch (type) {
      case 'up': {
        if (positionInTable > 0) {
          dispatchNewHistoryConfig({ type: 'update', name: `${findIndexBasedOnOrderNumber(positionInTable)}.order`, value: bulk.order - 1 })
          dispatchNewHistoryConfig({ type: 'update', name: `${findIndexBasedOnOrderNumber(positionInTable - 1)}.order`, value: bulk.order })
        }
        break
      }
      case 'down': {
        if (positionInTable < bulks.length - 1) {
          dispatchNewHistoryConfig({ type: 'update', name: `${findIndexBasedOnOrderNumber(positionInTable)}.order`, value: bulk.order + 1 })
          dispatchNewHistoryConfig({ type: 'update', name: `${findIndexBasedOnOrderNumber(positionInTable + 1)}.order`, value: bulk.order })
        }
        break
      }
      default: break
    }
  }

  /**
   * Returns the text color for each status
   * @param {string} status The status of the current bulk
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

  const tableHeaders = ['Order', 'Bulk', 'Status', 'Period', 'Percentage']
  const tableRows = bulks?.map(({ name, status, startTime, endTime, order }) => [
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
    { name: 'percentage', value: `${percentageCalculator(startTime, endTime)} %` },
  ])

  return tableRows ? (
    <Col md="8" className="bulk">
      <Breadcrumb tag="h5">
        <BreadcrumbItem tag={Link} to="/" className="oi-breadcrumb">
          Home
        </BreadcrumbItem>
        <BreadcrumbItem active tag="span">
          Bulk
        </BreadcrumbItem>
      </Breadcrumb>
      <Table
        headers={tableHeaders}
        rows={tableRows}
        handleEdit={handleEdit}
        handleDelete={handleDelete}
        handleDuplicate={handleDuplicate}
        handleOrder={handleOrder}
      />
      {applications && dataSources
      && <NewBulkRow northHandlers={applications} southHandlers={dataSources} addBulk={addBulk} bulksNumber={bulks.length} />}
    </Col>
  ) : (
    <div className="spinner-container">
      <Spinner color="primary" type="grow" />
      ...loading configuration from OIBus server...
    </div>
  )
}

export default Bulk
