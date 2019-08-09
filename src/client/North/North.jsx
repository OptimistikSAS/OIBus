import React from 'react'
import { withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'
import { Button, Col } from 'reactstrap'
import Table from '../components/table/Table.jsx'
import NewApplicationRow from './NewApplicationRow.jsx'
import Modal from '../components/Modal.jsx'
import apis from '../services/apis'
import { AlertContext } from '../context/AlertContext.jsx'
import { ConfigContext } from '../context/configContext.jsx'

const North = ({ history }) => {
  const [apiList, setApiList] = React.useState([])
  const { setAlert } = React.useContext(AlertContext)
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  const applications = (newConfig && newConfig.north && newConfig.north.applications) || []
  const dataSourceIds = newConfig && newConfig.south.dataSources.map((dataSource) => dataSource.dataSourceId)

  /**
   * Acquire the list of API
   * @returns {void}
   */
  React.useEffect(() => {
    apis
      .getNorthApis()
      .then((application) => {
        setApiList(application)
      })
      .catch((error) => {
        console.error(error)
        setAlert({ text: error.message, type: 'danger' })
      })
  }, [])

  /**
   * Gets the config json of a north application
   * @param {string} applicationId ID of an application
   * @returns {object} The selected application's config
   */
  const getApplicationIndex = (applicationId) => applications.findIndex((application) => application.applicationId === applicationId)

  /**
   * Handles the edit of application and redirects the
   * user to the selected north applications's configuration page
   * @param {string} applicationId The id to edit
   * @return {void}
   */
  const handleEditClick = (applicationId) => {
    const applicationIndex = getApplicationIndex(applicationId)
    // return if no id is provided

    if (applicationIndex === -1) return

    const application = applications[applicationIndex]
    const link = `/north/${application.api}`
    history.push({ pathname: link, formData: application, subscribeList: dataSourceIds })
  }

  /**
   * Adds a new application row to the table
   * @param {Object} param0 An application object containing
   * applicationId, enabled and api fields
   * @returns {void}
   */
  const addApplication = ({ applicationId /* , enabled, api */ }) => {
    const applicationIndex = getApplicationIndex(applicationId)
    if (applicationIndex === -1) {
      // Adds new application to table
      // setApplications((prev) => [...prev, { applicationId, enabled, api }])
    } else {
      const error = new Error('application already exists')
      setAlert({ text: error.message, type: 'danger' })
      throw error
    }
  }

  /**
   * Handles the toggle of application beetween
   * enabled and disabled state
   * @param {string} applicationId The id to enable/disable
   * @return {void}
   */
  const handleToggleClick = (applicationId) => {
    const index = getApplicationIndex(applicationId)
    if (index === -1) return
    const newApplications = applications.slice()
    const { enabled } = newApplications[index]
    dispatchNewConfig({ type: 'update', name: `north.applications.${index}.enabled`, value: !enabled })
  }

  /**
   * Deletes the chosen application
   * @param {string} applicationId The id to delete
   * @returns {void}
   */
  const handleDelete = (applicationId) => {
    if (applicationId === '') return
    const index = getApplicationIndex(applicationId)
    if (index === -1) return
    dispatchNewConfig({ type: 'deleteRow', name: `north.applications.${index}` })
  }

  const tableHeaders = ['Application ID', 'Status', 'API', '']
  const tableRows = applications.map(({ applicationId, enabled, api }) => [
    { name: applicationId, value: applicationId },
    {
      name: 'enabled',
      value: (
        <Modal show={false} title="Change status" body="Are you sure to change this Data Source status ?">
          {(confirm) => (
            <div>
              <Button className="inline-button" color={enabled ? 'success' : 'danger'} onClick={confirm(() => handleToggleClick(applicationId))}>
                {enabled ? 'Active' : 'Stopped'}
              </Button>
            </div>
          )}
        </Modal>
      ),
    },
    { name: 'api', value: api },
    {
      name: 'delete',
      value: (
        <Modal
          show={false}
          title="Delete application"
          body="Are you sure you want to delete this application?"
          acceptLabel="Delete"
          acceptColor="danger"
        >
          {(confirm) => (
            <div>
              <Button className="inline-button" color="primary" onClick={() => handleEditClick(applicationId)}>
                Edit
              </Button>
              <Button className="inline-button" color="danger" onClick={confirm(() => handleDelete(applicationId))}>
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
      {tableRows && <Table headers={tableHeaders} rows={tableRows} onRowClick={() => null} />}
      <NewApplicationRow apiList={apiList} addApplication={addApplication} />
    </Col>
  )
}
North.propTypes = { history: PropTypes.object.isRequired }

export default withRouter(North)
