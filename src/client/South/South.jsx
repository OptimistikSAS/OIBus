import React from 'react'
import { withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'
import { Button, Col, Spinner } from 'reactstrap'
import Table from '../components/table/Table.jsx'
import NewDataSourceRow from './NewDataSourceRow.jsx'
import Modal from '../components/Modal.jsx'
import { AlertContext } from '../context/AlertContext.jsx'
import { ConfigContext } from '../context/configContext.jsx'
import PointsButton from './PointsButton.jsx'

const South = ({ history }) => {
  const { setAlert } = React.useContext(AlertContext)
  const { newConfig, dispatchNewConfig, protocolList } = React.useContext(ConfigContext)
  const dataSources = newConfig && newConfig.south && newConfig.south.dataSources

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
    const link = `/south/${dataSource.dataSourceId}`
    history.push({ pathname: link })
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
      dispatchNewConfig({ type: 'addRow', name: 'south.dataSources', value: { dataSourceId, protocol, enabled: false } })
    } else {
      const error = new Error('data source already exists')
      setAlert({ text: error.message, type: 'danger' })
      throw error
    }
  }

  /**
   * Handles the toggle of dataSource beetween
   * enabled and disabled state
   * @param {integer} index The id to enable/disable
   * @return {void}
   */
  const handleToggleClick = (index) => {
    const { enabled } = dataSources[index]
    dispatchNewConfig({ type: 'update', name: `south.dataSources.${index}.enabled`, value: !enabled })
  }

  /**
   * Deletes the chosen dataSource
   * @param {integer} index The id to delete
   * @returns {void}
   */
  const handleDelete = (index) => {
    dispatchNewConfig({ type: 'deleteRow', name: `south.dataSources.${index}` })
  }

  const tableHeaders = ['Data Source ID', 'Status', 'Protocol', 'Points', '']
  const tableRows = dataSources
    && dataSources.map((dataSource, index) => [
      { name: dataSource.dataSourceId, value: dataSource.dataSourceId },
      {
        name: 'enabled',
        value: (
          <Modal show={false} title="Change status" body="Are you sure to change this Data Source status ?">
            {(confirm) => (
              <div>
                <Button className="inline-button" color={dataSource.enabled ? 'success' : 'danger'} onClick={confirm(() => handleToggleClick(index))}>
                  {dataSource.enabled ? 'Enabled' : 'Disabled'}
                </Button>
              </div>
            )}
          </Modal>
        ),
      },
      { name: 'protocol', value: dataSource.protocol },
      {
        name: 'points',
        value: <PointsButton dataSource={dataSource} />,
      },
    ])

  return dataSources ? (
    <Col md="8">
      {tableRows && <Table headers={tableHeaders} rows={tableRows} handleEdit={handleEdit} handleDelete={handleDelete} />}
      <NewDataSourceRow protocolList={protocolList} addDataSource={addDataSource} />
    </Col>
  ) : (
    <div className="spinner-container">
      <Spinner color="primary" type="grow" />
      ...loading configuration from OIBus server...
    </div>
  )
}
South.propTypes = { history: PropTypes.object.isRequired }

export default withRouter(South)
