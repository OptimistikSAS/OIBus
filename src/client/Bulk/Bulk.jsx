import React from 'react'
import { useHistory, Link } from 'react-router-dom'
import { Col, Spinner, Breadcrumb, BreadcrumbItem } from 'reactstrap'
import Table from '../components/table/Table.jsx'
import { ConfigContext } from '../context/configContext.jsx'
import { HistoryConfigContext } from '../context/historyContext.jsx'
import NewBulkRow from './NewBulkRow.jsx'

const Bulk = () => {
  const { newConfig } = React.useContext(ConfigContext)
  const { newHistoryConfig: bulks, dispatchNewHistoryConfig } = React.useContext(HistoryConfigContext)
  const applications = newConfig?.north?.applications
  const dataSources = newConfig?.south?.dataSources
  const history = useHistory()

  /**
   * Handles the edit of bulk and redirects the
   * user to the selected north bulk's configuration page
   * @param {integer} position The id to edit
   * @return {void}
   */
  const handleEdit = (position) => {
    const bulk = bulks[position]
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
    // NOTE: The current date should be replaced with the last completed date
    const differenceFromNowToEnd = new Date(endTime).getTime() - new Date().getTime()
    return differenceFromNowToEnd > 0 ? (100 - ((differenceFromNowToEnd * 100) / differenceFromStartToEnd)).toFixed(2) : 100
  }

  /**
   * Adds a new bulk row to the table
   * @param {Object} param0 A bulk object containing
   * id, name fields
   * @returns {void}
   */
  const addBulk = ({ id, name }) => {
    dispatchNewHistoryConfig({ type: 'addRow', value: { id, name, enabled: false } })
  }

  /**
   * Deletes the chosen bulk
   * @param {integer} position The index to delete
   * @returns {void}
   */
  const handleDelete = (position) => {
    dispatchNewHistoryConfig({ type: 'deleteRow', name: `north.applications.${applications[position].index}` })
  }

  /**
   * Copy the chosen bulk
   * @param {integer} position The id to copy
   * @returns {void}
   */
  const handleDuplicate = (position) => {
    const bulk = bulks[position]
    const newName = `${bulk.name} copy`
    const countCopies = bulks.filter((e) => e.name.startsWith(newName)).length
    dispatchNewHistoryConfig({
      type: 'addRow',
      value: {
        ...bulk,
        name: `${newName}${countCopies > 0 ? countCopies + 1 : ''}`,
        enabled: false,
      },
    })
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

  const tableHeaders = ['Bulk', 'Status', 'Period', 'Percentage', 'Points']
  const sortableProperties = ['name', 'status', 'period', 'percentage', 'points']
  const tableRows = bulks?.map(({ name, status, startTime, endTime, _index }) => [
    {
      name: 'name',
      value: name,
    },
    {
      name: 'status',
      value: <div className={statusColor(status)}>{status}</div>,
    },
    { name: 'period', value: `${startTime} -> ${endTime}` },
    { name: 'percentage', value: `${percentageCalculator(startTime, endTime)} %` },
    { name: 'points', value: 'Points' },
  ])

  return tableRows ? (
    <Col md="6" className="bulk">
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
        sortableProperties={sortableProperties}
        rows={tableRows}
        handleEdit={handleEdit}
        handleDelete={handleDelete}
        handleDuplicate={handleDuplicate}
      />
      {applications && dataSources && <NewBulkRow northHandlers={applications} southHandlers={dataSources} addBulk={addBulk} />}
    </Col>
  ) : (
    <div className="spinner-container">
      <Spinner color="primary" type="grow" />
      ...loading configuration from OIBus server...
    </div>
  )
}

export default Bulk
