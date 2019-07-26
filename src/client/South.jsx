import React from 'react'
import { withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'
import { Button, Col } from 'reactstrap'
import Table from './components/table/Table.jsx'
import NewDataSourceRow from './NewDataSourceRow.jsx'
import Modal from './components/Modal.jsx'
import apis from './services/apis'
import { AlertContext } from './context/AlertContext'

const South = ({ history }) => {
  const [dataSources, setDataSources] = React.useState([])
  const [protocolList, setProtocolList] = React.useState([])
  const { setAlert } = React.useContext(AlertContext)

  /**
   * Acquire the South configuration
   * @returns {void}
   */
  React.useEffect(() => {
    apis.getConfig().then(({ config }) => {
      setDataSources(config.south.dataSources)
    }).catch((error) => {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    })
  }, [])

  /**
   * Acquire the list of Protocols
   * @returns {void}
   */
  React.useEffect(() => {
    apis.getSouthProtocols().then((protocols) => {
      setProtocolList(protocols)
    }).catch((error) => {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    })
  }, [])

  /**
   * Gets the json of a south data source
   * @param {string} dataSourceId ID of a data source
   * @returns {object} The selected data source's config
   */
  const getDataSourceIndex = (dataSourceId) => dataSources.findIndex((dataSource) => dataSource.dataSourceId === dataSourceId)

  /**
   * Adds a new data source row to the table
   * @param {Object} param0 A data source object containing
   * dataSourceId, enabled and protocol fields
   * @returns {void}
   */
  const addDataSource = ({ dataSourceId, enabled, protocol }) => {
    const dataSourceIndex = getDataSourceIndex(dataSourceId)
    if (dataSourceIndex === -1) {
      setDataSources((prev) => [...prev, { dataSourceId, enabled, protocol }])
    } else {
      throw new Error('dataSourceId already exists')
    }
  }

  /**
   * Handles the edit of points and redirects the
   * user to the selected south data source's points page
   * @param {string} dataSourceId The id to edit
   * @return {void}
   */
  const handleEditPoints = (dataSourceId) => {
    const dataSourceIndex = getDataSourceIndex(dataSourceId)
    if (dataSourceIndex === -1) return
    const dataSource = dataSources[dataSourceIndex]
    const link = `/south/${dataSource.protocol}/${dataSource.dataSourceId}/points`
    history.push({ pathname: link })
  }

  /**
   * Handles the edit of data source and redirects the
   * user to the selected south data source's configuration page
   * @param {string} dataSourceId The id to edit
   * @return {void}
   */
  const handleEditClick = (dataSourceId) => {
    const dataSourceIndex = getDataSourceIndex(dataSourceId)
    if (dataSourceIndex === -1) return
    const dataSource = dataSources[dataSourceIndex]
    const link = `/south/${dataSource.protocol}`
    history.push({ pathname: link, formData: dataSource })
  }

  /**
   * Handles the toggle of data source between
   * enabled and disabled state
   * @param {string} dataSourceId The id to enable/disable
   * @return {void}
   */
  const handleToggleClick = async (dataSourceId) => {
    const dataSourceIndex = getDataSourceIndex(dataSourceId)
    if (dataSourceIndex === -1) return
    const newDataSources = dataSources.slice()
    const formData = newDataSources[dataSourceIndex]
    formData.enabled = !formData.enabled
    try {
      await apis.updateSouth(dataSourceId, formData)
      setDataSources(newDataSources)
    } catch (error) {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    }
  }

  /**
   * Deletes the chosen data source
   * @param {string} dataSourceId The id to delete
   * @returns {void}
   */
  const handleDelete = async (dataSourceId) => {
    if (dataSourceId === '') return

    try {
      await apis.deleteSouth(dataSourceId)
      // Remove the deleted data source from the table
      setDataSources((prevState) => prevState.filter((dataSource) => dataSource.dataSourceId !== dataSourceId))
      // TODO: Show loader
    } catch (error) {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    }
  }

  const tableHeaders = ['Data Source ID', 'Status', 'Protocol', 'Points', '']
  const tableRows = dataSources.map(({ dataSourceId, enabled, protocol, points }) => [
    { name: 'id', value: dataSourceId },
    {
      name: 'enabled',
      value: (
        <Modal show={false} title="Change status" body="Are you sure to change this Data Source status ?">
          {(confirm) => (
            <div>
              <Button className="inline-button" color={enabled ? 'success' : 'danger'} onClick={confirm(() => handleToggleClick(dataSourceId))}>
                {enabled ? 'Active' : 'Stopped'}
              </Button>
            </div>
          )}
        </Modal>
      ),
    },
    { name: 'protocol', value: protocol },
    {
      name: 'points',
      value: (
        <div>
          <Button
            className="inline-button autosize"
            color={points && points.length ? 'success' : 'primary'}
            onClick={() => handleEditPoints(dataSourceId)}
          >
            {`Points ${points ? `(${points.length})` : '(0)'}`}
          </Button>
        </div>
      ),
    },
    {
      name: 'delete',
      value: (
        <Modal
          show={false}
          title="Delete Data Source"
          body="Are you sure you want to delete this Data Source?"
          acceptLabel="Delete"
          acceptColor="danger"
        >
          {(confirm) => (
            <div>
              <Button className="inline-button" color="primary" onClick={() => handleEditClick(dataSourceId)}>
                Edit
              </Button>
              <Button className="inline-button" color="danger" onClick={confirm(() => handleDelete(dataSourceId))}>
                Delete
              </Button>
            </div>
          )}
        </Modal>
      ),
    },
  ])
  return (
    <Col xs="12" md="9">
      <Table headers={tableHeaders} rows={tableRows} onRowClick={() => null} />
      <NewDataSourceRow protocolList={protocolList} addDataSource={addDataSource} />
    </Col>
  )
}

South.propTypes = { history: PropTypes.object.isRequired }

export default withRouter(South)
