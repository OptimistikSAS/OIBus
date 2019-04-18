/* eslint-disable no-unused-vars */
import React from 'react'
import { withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'
import ReactJson from 'react-json-view'
import Table from './components/table/Table.jsx'
import NewApplicationRow from './NewApplicationRow.jsx'
import Modal from './components/Modal.jsx'
import apis from './services/apis'

const toDelete = ''

const North = ({ history }) => {
  const [applications, setApplications] = React.useState([])
  const [apiList, setApiList] = React.useState([])
  const [showModal, setShowModal] = React.useState(false)

  // acquire the North configuration
  React.useEffect(() => {
    apis.getConfig().then(({ config }) => {
      setApplications(config.north.applications)
    })
  }, [])

  // acquire the list of Apis
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
    const equipmentIndex = getApplicationIndex(applicationId)
    if (equipmentIndex === -1) {
      setApplications(prev => [...prev, { applicationId, enabled, api }])
    } else {
      throw new Error('application already exists')
    }
  }

  /**
   * Deletes the chosen application
   * @param {event} event the event to prevent the table row click event
   * @param {string} applicationId The id to delete
   * @returns {void}
   */
  const handleDelete = (event, applicationId) => {
    if (applicationId === '') return

    apis.deleteNorth(applicationId).then(
      () => {
        setApplications(prevState => prevState.filter(application => application.applicationId !== applicationId))
        // TODO: Show loader
      },
      (error) => {
        console.error(error)
      },
    )
  }

  const tableHeaders = ['Application ID', 'Enabled', 'Api']
  const tableRows = applications.map(({ applicationId, enabled, api }) => [applicationId, enabled ? 'enabled' : '', api])
  return (
    <>
      <Modal show={showModal} title="Delete application" body="Are you sure you want to delete this application?">
        {confirm => tableRows && <Table headers={tableHeaders} rows={tableRows} onRowClick={handleRowClick} onDeleteClick={confirm(handleDelete)} />}
      </Modal>
      <NewApplicationRow apiList={apiList} addApplication={addApplication} />
      <ReactJson src={applications} name={null} collapsed displayObjectSize={false} displayDataTypes={false} enableClipboard={false} />
    </>
  )
}
North.propTypes = { history: PropTypes.object.isRequired }

export default withRouter(North)
