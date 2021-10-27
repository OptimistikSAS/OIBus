import React from 'react'
import { useHistory, Link } from 'react-router-dom'
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
  const history = useHistory()

  const bulks = unorderedBulks.slice().sort((a, b) => (a.order > b.order ? 1 : -1))

  /**
   * @param {number} indexInTable the index of a point in the table
   * @returns {number} the index in the config file of the chosen point
   */
  const findIndexBasedOnVirtualIndex = (indexInTable) => {
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
    const bulk = unorderedBulks[findIndexBasedOnVirtualIndex(position)]
    const link = `/bulk/${bulk.id}`
    history.push({ pathname: link })
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
    dispatchNewHistoryConfig({ type: 'deleteRow', name: findIndexBasedOnVirtualIndex(position) })
  }

  /**
   * Copy the chosen bulk
   * @param {integer} position The id to copy
   * @returns {void}
   */
  const handleDuplicate = (position) => {
    const bulk = unorderedBulks[findIndexBasedOnVirtualIndex(position)]
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

  const handleOrder = (type, positionInTable) => {
    const bulk = unorderedBulks[findIndexBasedOnVirtualIndex(positionInTable)]
    switch (type) {
      case 'up': {
        if (positionInTable > 0) {
          dispatchNewHistoryConfig({ type: 'update', name: `${findIndexBasedOnVirtualIndex(positionInTable)}.order`, value: bulk.order - 1 })
          dispatchNewHistoryConfig({ type: 'update', name: `${findIndexBasedOnVirtualIndex(positionInTable - 1)}.order`, value: bulk.order })
        }
        break
      }
      case 'down': {
        if (positionInTable < bulks.length - 1) {
          dispatchNewHistoryConfig({ type: 'update', name: `${findIndexBasedOnVirtualIndex(positionInTable)}.order`, value: bulk.order + 1 })
          dispatchNewHistoryConfig({ type: 'update', name: `${findIndexBasedOnVirtualIndex(positionInTable + 1)}.order`, value: bulk.order })
        }
        break
      }
      default: break
    }
  }

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
