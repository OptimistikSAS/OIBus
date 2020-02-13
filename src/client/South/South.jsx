import React from 'react'
import { useHistory, Link } from 'react-router-dom'
import { Col, Breadcrumb, BreadcrumbItem, Spinner } from 'reactstrap'
import Table from '../components/table/Table.jsx'
import NewDataSourceRow from './NewDataSourceRow.jsx'
import { AlertContext } from '../context/AlertContext.jsx'
import { ConfigContext } from '../context/configContext.jsx'
import PointsButton from './PointsButton.jsx'
import EditableIdField from '../components/EditableIdField.jsx'

const South = () => {
  const { setAlert } = React.useContext(AlertContext)
  const { newConfig, dispatchNewConfig, protocolList } = React.useContext(ConfigContext)
  const dataSources = newConfig?.south?.dataSources
  const history = useHistory()

  /**
   * Gets the config json of a south dataSource
   * @param {string} dataSourceId ID of an dataSource
   * @returns {object} The selected dataSource's config
   */
  const getDataSourceIndex = (dataSourceId) => dataSources.findIndex((dataSource) => dataSource.dataSourceId === dataSourceId)

  /**
   * Handles the edit of dataSource and redirects the
   * user to the selected south datasource's configuration page
   * @param {integer} index The id to edit
   * @return {void}
   */
  const handleEdit = (index) => {
    const dataSource = dataSources[index]
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
   * @param {integer} index The id to delete
   * @returns {void}
   */
  const handleDelete = (index) => {
    dispatchNewConfig({ type: 'deleteRow', name: `south.dataSources.${index}` })
  }

  const tableHeaders = ['Data Source ID', 'Status', 'Protocol', 'Points']
  const tableRows = dataSources?.map((dataSource, index) => [
    {
      name: dataSource.dataSourceId,
      value: (
        <EditableIdField
          id={dataSource.dataSourceId}
          fromList={dataSources}
          index={index}
          name="dataSourceId"
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
    <Col md="8">
      <Breadcrumb tag="h5">
        <BreadcrumbItem tag={Link} to="/" className="oi-breadcrumb">
          Home
        </BreadcrumbItem>
        <BreadcrumbItem active tag="span">
          South
        </BreadcrumbItem>
      </Breadcrumb>
      <Table headers={tableHeaders} rows={tableRows} handleEdit={handleEdit} handleDelete={handleDelete} />
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
