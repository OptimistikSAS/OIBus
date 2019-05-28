import React from 'react'
import { withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'
import ReactJson from 'react-json-view'
import { Button } from 'reactstrap'
import Table from './components/table/Table.jsx'
import NewDataSourceRow from './NewDataSourceRow.jsx'
import Modal from './components/Modal.jsx'
import apis from './services/apis'

const South = ({ history }) => {
  const [dataSources, setDataSources] = React.useState([])
  const [protocolList, setProtocolList] = React.useState([])
  const [configEngine, setConfigEngine] = React.useState()

  /**
   * Acquire the engine configuration and set the configEngine JSON
   * @returns {void}
   */
  React.useEffect(() => {
    // eslint-disable-next-line consistent-return
    fetch('/config').then((response) => {
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.indexOf('application/json') !== -1) {
        return response.json().then(({ config }) => {
          const { engine } = config
          setConfigEngine(engine)
        })
      }
    })
  }, [])

  /**
   * Acquire the South configuration
   * @returns {void}
   */
  React.useEffect(() => {
    apis.getConfig().then(({ config }) => {
      setDataSources(config.south.dataSources)
    })
  }, [])

  /**
   * Acquire the list of Protocols
   * @returns {void}
   */
  React.useEffect(() => {
    apis.getSouthProtocols().then((protocols) => {
      setProtocolList(protocols)
    })
  }, [])

  /**
   * Gets the json of a south data source
   * @param {string} dataSourceId ID of a data source
   * @returns {object} The selected data source's config
   */
  const getDataSourceIndex = dataSourceId => dataSources.findIndex(dataSource => dataSource.dataSourceId === dataSourceId)

  /**
   * Adds a new data source row to the table
   * @param {Object} param0 A data source object containing
   * dataSourceId, enabled and protocol fields
   * @returns {void}
   */
  const addDataSource = ({ dataSourceId, enabled, protocol }) => {
    const dataSourceIndex = getDataSourceIndex(dataSourceId)
    if (dataSourceIndex === -1) {
      setDataSources(prev => [...prev, { dataSourceId, enabled, protocol }])
    } else {
      throw new Error('dataSourceId already exists')
    }
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
    const formData = dataSources[dataSourceIndex]
    const link = `/south/${formData.protocol}`
    history.push({ pathname: link, formData, configEngine })
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
      setDataSources(prevState => prevState.filter(dataSource => dataSource.dataSourceId !== dataSourceId))
      // TODO: Show loader
    } catch (error) {
      console.error(error)
    }
  }

  const tableHeaders = ['Data Source ID', 'Status', 'Protocol', '']
  const tableRows = dataSources.map(({ dataSourceId, enabled, protocol }) => [
    { name: 'id', value: dataSourceId },
    {
      name: 'enabled',
      value: (
        <Modal show={false} title="Change status" body="Are you sure to change this Data Source status ?">
          {confirm => (
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
      name: 'delete',
      value: (
        <Modal show={false} title="Delete Data Source" body="Are you sure you want to delete this Data Source?">
          {confirm => (
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
    <>
      <Modal show={false} title="Delete Data Source" body="Are you sure you want to delete this Data Source?">
        {confirm => tableRows && <Table headers={tableHeaders} rows={tableRows} onRowClick={() => null} onDeleteClick={confirm(handleDelete)} />}
      </Modal>
      <NewDataSourceRow protocolList={protocolList} addDataSource={addDataSource} />
      <ReactJson src={dataSources} name={null} collapsed displayObjectSize={false} displayDataTypes={false} enableClipboard={false} />
    </>
  )
}

South.propTypes = { history: PropTypes.object.isRequired }

export default withRouter(South)
