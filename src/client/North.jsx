import React from 'react'
import { withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'
import ReactJson from 'react-json-view'
import { Button } from 'reactstrap'
import Table from './components/table/Table.jsx'
import NewApplicationRow from './NewApplicationRow.jsx'
import Modal from './components/Modal.jsx'
import apis from './services/apis'

const North = ({ history }) => {
  const [applications, setApplications] = React.useState([])
  const [apiList, setApiList] = React.useState([])

  /**
   * Acquire the North configuration
   * @returns {void}
   */
  React.useEffect(() => {
    apis.getConfig().then(({ config }) => {
      setApplications(config.north.applications)
    })
  }, [])

  /**
   * Acquire the list of protocols
   * @returns {void}
   */
  React.useEffect(() => {
    apis.getNorthApis().then((application) => {
      setApiList(application)
    })
  }, [])

  /**
   * Gets the config json of a north application
   * @param {string} applicationId ID of an application
   * @returns {object} The selected application's config
   */
  const getApplicationIndex = applicationId => applications.findIndex(application => application.applicationId === applicationId)

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

    const formData = applications[applicationIndex]
    const link = `/north/${formData.api}`
    history.push({ pathname: link, formData })
  }

  /**
   * Adds a new application row to the table
   * @param {Object} param0 An application object containing
   * applicationId, enabled and api fields
   * @returns {void}
   */
  const addApplication = ({ applicationId, enabled, api }) => {
    const applicationIndex = getApplicationIndex(applicationId)
    if (applicationIndex === -1) {
      // Adds new application to table
      setApplications(prev => [...prev, { applicationId, enabled, api }])
    } else {
      throw new Error('application already exists')
    }
  }

  /**
   * Handles the toggle of application beetween
   * enabled and disabled state
   * @param {string} applicationId The id to enable/disable
   * @return {void}
   */
  const handleToggleClick = async (applicationId) => {
    const applicationIndex = getApplicationIndex(applicationId)
    if (applicationIndex === -1) return
    const newApplications = applications.slice()
    const formData = newApplications[applicationIndex]
    formData.enabled = !formData.enabled
    try {
      await apis.updateNorth(applicationId, formData)
      setApplications(newApplications)
    } catch (error) {
      console.error(error)
    }
  }

  /**
   * Deletes the chosen application
   * @param {string} applicationId The id to delete
   * @returns {void}
   */
  const handleDelete = async (applicationId) => {
    if (applicationId === '') return
    try {
      await apis.deleteNorth(applicationId)

      // Removes the deleted application from table
      setApplications(prevState => prevState.filter(application => application.applicationId !== applicationId))
      // TODO: Show loader
    } catch (error) {
      console.error(error)
    }
  }

  const tableHeaders = ['Application ID', 'Enabled', 'API', '']
  const tableRows = applications.map(({ applicationId, enabled, api }) => [
    { name: 'id', value: applicationId },
    { name: 'enabled', value: enabled ? 'enabled' : 'Actions' },
    { name: 'api', value: api },
    {
      name: 'delete',
      value: (
        <Modal show={false} title="Delete application" body="Are you sure you want to delete this application?">
          {confirm => (
            <div>
              <Button className="inline-button" color={enabled ? 'danger' : 'success'} onClick={() => handleToggleClick(applicationId)}>
                {enabled ? 'Disable' : 'Enable'}
              </Button>
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
    <>
      {tableRows && <Table headers={tableHeaders} rows={tableRows} onRowClick={() => null} />}
      <NewApplicationRow apiList={apiList} addApplication={addApplication} />
      <ReactJson src={applications} name={null} collapsed displayObjectSize={false} displayDataTypes={false} enableClipboard={false} />
    </>
  )
}
North.propTypes = { history: PropTypes.object.isRequired }

export default withRouter(North)
