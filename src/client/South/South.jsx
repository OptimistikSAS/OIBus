import React from 'react'
import { useHistory, Link } from 'react-router-dom'
import { Col, Breadcrumb, BreadcrumbItem, Spinner } from 'reactstrap'
import Table from '../components/table/Table.jsx'
import NewDataSourceRow from './NewDataSourceRow.jsx'
import { AlertContext } from '../context/AlertContext.jsx'
import { ConfigContext } from '../context/configContext.jsx'
import PointsButton from './PointsButton.jsx'
import EditableIdField from '../components/EditableIdField.jsx'
import validation from './Form/South.validation'
import utils from '../helpers/utils'

const South = () => {
  const { setAlert } = React.useContext(AlertContext)
  const { newConfig, dispatchNewConfig, protocolList, sort } = React.useContext(ConfigContext)
  const { sortSouthBy: sortBy, setSortSouthBy: setSortBy } = sort
  const { isSouthAscending: isAscending, setIsSouthAscending: setIsAscending } = sort
  const dataSources = newConfig?.south?.dataSources
  const history = useHistory()

  // create a sortable copy to matain original order in case of sort
  const sortableDataSources = utils.jsonCopy(dataSources ?? [])
  // add index for each south datasource for later use in case of sort
  sortableDataSources?.forEach((dataSource, index) => {
    dataSource.index = index
  })
  // sort based on selected property
  if (sortBy !== undefined) {
    sortableDataSources.sort((a, b) => {
      if (a[sortBy].toString().toLowerCase() > b[sortBy].toString().toLowerCase()) return isAscending ? 1 : -1
      if (b[sortBy].toString().toLowerCase() > a[sortBy].toString().toLowerCase()) return isAscending ? -1 : 1
      return 0
    })
  }

  /**
   * Gets the index of a south dataSource
   * @param {string} dataSourceId ID of an dataSource
   * @returns {object} The selected dataSource's config
   */
  const getDataSourceIndex = ((dataSourceId) => {
    const position = sortableDataSources.findIndex((dataSource) => dataSource.dataSourceId === dataSourceId)
    if (position === -1) {
      return position
    }
    return sortableDataSources[position].index
  })

  /**
   * Handles the edit of dataSource and redirects the
   * user to the selected south datasource's configuration page
   * @param {integer} position The id to edit
   * @return {void}
   */
  const handleEdit = (position) => {
    const dataSource = sortableDataSources[position]
    const pathname = `/south/${dataSource.dataSourceId}`
    history.push({ pathname })
  }

  /**
   * Handles the change of one data source id (name)
   * @param {integer} dataSourceIndex The index that will change
   * @param {string} newDataSourceId The new data source id
   * @return {void}
   */
  const handleDataSourceIdChanged = (dataSourceIndex, newDataSourceId) => {
    dispatchNewConfig({
      type: 'update',
      name: `south.dataSources.${dataSourceIndex}.dataSourceId`,
      value: newDataSourceId,
    })
  }

  /**
   * Adds a new datasource row to the table
   * @param {Object} param0 An datasource object containing
   * dataSourceId, enabled and protocol fields
   * @returns {void}
   */
  const addDataSource = ({ dataSourceId, protocol }) => {
    const dataSourceIndex = getDataSourceIndex(dataSourceId)
    if (dataSourceIndex === -1) {
      // Adds new dataSource
      dispatchNewConfig({
        type: 'addRow',
        name: 'south.dataSources',
        value: { dataSourceId, protocol, enabled: false },
      })
    } else {
      const error = new Error('data source already exists')
      setAlert({ text: error.message, type: 'danger' })
      throw error
    }
  }

  /**
   * Deletes the chosen dataSource
   * @param {integer} position The id to delete
   * @returns {void}
   */
  const handleDelete = (position) => {
    dispatchNewConfig({ type: 'deleteRow', name: `south.dataSources.${sortableDataSources[position].index}` })
  }

  /**
  * Sort applications list
  * @param {string} property to be used for sorting
  * @param {bool} ascending flag for ascending/descending
  * @returns {void}
  */
  const handleSort = (property, ascending) => {
    setSortBy(property)
    setIsAscending(ascending)
  }

  /**
   * Copy the chosen dataSource
   * @param {integer} position The id to copy
   * @returns {void}
   */
  const handleDuplicate = (position) => {
    const dataSource = dataSources[sortableDataSources[position].index]
    const newName = `${dataSource.dataSourceId} copy`
    const countCopies = dataSources.filter((e) => e.dataSourceId.startsWith(newName)).length
    dispatchNewConfig({
      type: 'addRow',
      name: 'south.dataSources',
      value: {
        ...dataSource,
        dataSourceId: `${newName}${countCopies > 0 ? countCopies + 1 : ''}`,
        enabled: false,
      },
    })
  }

  const tableHeaders = ['Data Source ID', 'Status', 'Protocol', 'Points']
  const sortableProperties = ['dataSourceId', 'enabled', 'protocol']
  const tableRows = sortableDataSources?.map((dataSource) => [
    {
      name: dataSource.dataSourceId,
      value: (
        <EditableIdField
          id={dataSource.dataSourceId}
          fromList={sortableDataSources}
          index={dataSource.index}
          name="dataSourceId"
          valid={validation.protocol.isValidName}
          idChanged={handleDataSourceIdChanged}
        />
      ),
    },
    {
      name: 'enabled',
      value: (
        <div className={dataSource.enabled ? 'text-success' : 'text-danger'}>
          {dataSource.enabled ? 'Enabled' : 'Disabled'}
        </div>
      ),
    },
    { name: 'protocol', value: dataSource.protocol },
    {
      name: 'points',
      value: <PointsButton dataSource={dataSource} />,
    },
  ])

  return tableRows && Array.isArray(protocolList) ? (
    <Col md="8" className="south">
      <Breadcrumb tag="h5">
        <BreadcrumbItem tag={Link} to="/" className="oi-breadcrumb">
          Home
        </BreadcrumbItem>
        <BreadcrumbItem active tag="span">
          South
        </BreadcrumbItem>
      </Breadcrumb>
      <Table
        headers={tableHeaders}
        sortableProperties={sortableProperties}
        sortBy={sortBy}
        isAscending={isAscending}
        rows={tableRows}
        handleEdit={handleEdit}
        handleDelete={handleDelete}
        handleDuplicate={handleDuplicate}
        handleSort={handleSort}
      />
      <NewDataSourceRow protocolList={protocolList} addDataSource={addDataSource} />
    </Col>
  ) : (
    <div className="spinner-container">
      <Spinner color="primary" type="grow" />
      ...loading configuration from OIBus server...
    </div>
  )
}

export default South
