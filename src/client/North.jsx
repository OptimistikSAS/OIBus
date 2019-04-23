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
   * Handles the click of the table rows and redirects the
   * user to the selected north application's configuration page
   * @param {array} application Data of the clicked row
   * @return {void}
   */
  const handleRowClick = (application) => {
    const [applicationId] = application
    const applicationIndex = getApplicationIndex(applicationId.value)
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
    const equipmentIndex = getApplicationIndex(applicationId)
    if (equipmentIndex === -1) {
      // Adds new application to table
      setApplications(prev => [...prev, { applicationId, enabled, api }])
    } else {
      throw new Error('application already exists')
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

  const tableHeaders = ['Application ID', 'Enabled', 'Api']
  const tableRows = applications.map(({ applicationId, enabled, api }) => [
    { name: 'id', value: applicationId },
    { name: 'enabled', value: enabled ? 'enabled' : '' },
    { name: 'api', value: api },
    {
      name: 'delete',
      value: (
        <Modal show={false} title="Delete application" body="Are you sure you want to delete this application?">
          {confirm => (
            <Button color="danger" onClick={confirm(() => handleDelete(applicationId))}>
              Delete
            </Button>
          )}
        </Modal>
      ),
    },
  ])
  return (
    <>
      {tableRows && <Table headers={tableHeaders} rows={tableRows} onRowClick={handleRowClick} />}
      <NewApplicationRow apiList={apiList} addApplication={addApplication} />
      <ReactJson src={applications} name={null} collapsed displayObjectSize={false} displayDataTypes={false} enableClipboard={false} />
    </>
  )
}
North.propTypes = { history: PropTypes.object.isRequired }

export default withRouter(North)
