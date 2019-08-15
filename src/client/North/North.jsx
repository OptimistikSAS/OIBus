import React from 'react'
import { withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'
import { Button, Col, Spinner } from 'reactstrap'
import Table from '../components/table/Table.jsx'
import NewApplicationRow from './NewApplicationRow.jsx'
import Modal from '../components/Modal.jsx'
import { AlertContext } from '../context/AlertContext.jsx'
import { ConfigContext } from '../context/configContext.jsx'

const North = ({ history }) => {
  const { setAlert } = React.useContext(AlertContext)
  const { newConfig, dispatchNewConfig, apiList } = React.useContext(ConfigContext)
  const applications = newConfig && newConfig.north && newConfig.north.applications

  /**
   * Gets the config json of a north application
   * @param {string} applicationId ID of an application
   * @returns {object} The selected application's config
   */
  const getApplicationIndex = (applicationId) => applications.findIndex((application) => application.applicationId === applicationId)

  /**
   * Handles the edit of application and redirects the
   * user to the selected north applications's configuration page
   * @param {integer} index The id to edit
   * @return {void}
   */
  const handleEdit = (index) => {
    const application = applications[index]
    const link = `/north/${application.applicationId}`
    history.push({ pathname: link })
  }

  /**
   * Adds a new application row to the table
   * @param {Object} param0 An application object containing
   * applicationId, enabled and api fields
   * @returns {void}
   */
  const addApplication = ({ applicationId, api }) => {
    const applicationIndex = getApplicationIndex(applicationId)
    if (applicationIndex === -1) {
      // Adds new application
      dispatchNewConfig({ type: 'addRow', name: 'north.applications', value: { applicationId, api, enabled: false } })
    } else {
      const error = new Error('application already exists')
      setAlert({ text: error.message, type: 'danger' })
      throw error
    }
  }

  /**
   * Handles the toggle of application beetween
   * enabled and disabled state
   * @param {integer} index The id to enable/disable
   * @return {void}
   */
  const handleToggleClick = (index) => {
    const { enabled } = applications[index]
    dispatchNewConfig({ type: 'update', name: `north.applications.${index}.enabled`, value: !enabled })
  }

  /**
   * Deletes the chosen application
   * @param {integer} index The id to delete
   * @returns {void}
   */
  const handleDelete = (index) => {
    dispatchNewConfig({ type: 'deleteRow', name: `north.applications.${index}` })
  }

  const tableHeaders = ['Application ID', 'Status', 'API']
  const tableRows = applications
    && applications.map(({ applicationId, enabled, api }, index) => [
      { name: applicationId, value: applicationId },
      {
        name: 'enabled',
        value: (
          <Modal show={false} title="Change status" body="Are you sure to change this Data Source status ?">
            {(confirm) => (
              <div>
                <Button className="inline-button" color={enabled ? 'success' : 'danger'} onClick={confirm(() => handleToggleClick(index))}>
                  {enabled ? 'Active' : 'Stopped'}
                </Button>
              </div>
            )}
          </Modal>
        ),
      },
      { name: 'api', value: api },
    ])

  return (applications !== null && Array.isArray(apiList)) ? (
    <Col md="6">
      <Table headers={tableHeaders} rows={tableRows} handleEdit={handleEdit} handleDelete={handleDelete} />
      <NewApplicationRow apiList={apiList} addApplication={addApplication} />
    </Col>
  ) : (
    <div className="spinner-container">
      <Spinner color="primary" type="grow" />
      ...loading configuration from OIBus server...
    </div>
  )
}
North.propTypes = { history: PropTypes.object.isRequired }

export default withRouter(North)
