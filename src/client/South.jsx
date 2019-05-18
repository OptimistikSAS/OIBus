import React from 'react'
import { withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'
import ReactJson from 'react-json-view'
import { Button } from 'reactstrap'
import Table from './components/table/Table.jsx'
import NewEquipmentRow from './NewEquipmentRow.jsx'
import Modal from './components/Modal.jsx'
import apis from './services/apis'

const South = ({ history }) => {
  const [equipments, setEquipments] = React.useState([])
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
      setEquipments(config.south.equipments)
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
   * Gets the json of a south equipment
   * @param {string} equipmentId ID of an equipment
   * @returns {object} The selected equipment's config
   */
  const getEquipmentIndex = equipmentId => equipments.findIndex(equipment => equipment.equipmentId === equipmentId)

  /**
   * Adds a new equipment row to the table
   * @param {Object} param0 An equipment object containing
   * equipmentId, enabled and protocol fields
   * @returns {void}
   */
  const addEquipment = ({ equipmentId, enabled, protocol }) => {
    const equipmentIndex = getEquipmentIndex(equipmentId)
    if (equipmentIndex === -1) {
      setEquipments(prev => [...prev, { equipmentId, enabled, protocol }])
    } else {
      throw new Error('equipmentId already exists')
    }
  }

  /**
   * Handles the edit of equpiment and redirects the
   * user to the selected south equipment's configuration page
   * @param {string} equipmentId The id to edit
   * @return {void}
   */
  const handleEditClick = (equipmentId) => {
    const equipmentIndex = getEquipmentIndex(equipmentId)
    if (equipmentIndex === -1) return
    const formData = equipments[equipmentIndex]
    const link = `/south/${formData.protocol}`
    history.push({ pathname: link, formData, configEngine })
  }

  /**
   * Handles the toggle of equpiment beetween
   * enabled and disabled state
   * @param {string} equipmentId The id to enable/disable
   * @return {void}
   */
  const handleToggleClick = async (equipmentId) => {
    const equipmentIndex = getEquipmentIndex(equipmentId)
    if (equipmentIndex === -1) return
    const newEquipments = equipments.slice()
    const formData = newEquipments[equipmentIndex]
    formData.enabled = !formData.enabled
    try {
      await apis.updateSouth(equipmentId, formData)
      setEquipments(newEquipments)
    } catch (error) {
      console.error(error)
    }
  }

  /**
   * Deletes the chosen equipment
   * @param {string} equipmentId The id to delete
   * @returns {void}
   */
  const handleDelete = async (equipmentId) => {
    if (equipmentId === '') return

    try {
      await apis.deleteSouth(equipmentId)
      // Remove the deleted equipment from the table
      setEquipments(prevState => prevState.filter(equipment => equipment.equipmentId !== equipmentId))
      // TODO: Show loader
    } catch (error) {
      console.error(error)
    }
  }

  const tableHeaders = ['Data Source ID', 'Status', 'Protocol', '']
  const tableRows = equipments.map(({ equipmentId, enabled, protocol }) => [
    { name: 'id', value: equipmentId },
    {
      name: 'enabled',
      value: (
        <Modal show={false} title="Change status" body="Are you sure to change this Data Source status ?">
          {confirm => (
            <div>
              <Button className="inline-button" color={enabled ? 'success' : 'danger'} onClick={confirm(() => handleToggleClick(equipmentId))}>
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
              <Button className="inline-button" color="primary" onClick={() => handleEditClick(equipmentId)}>
                Edit
              </Button>
              <Button className="inline-button" color="danger" onClick={confirm(() => handleDelete(equipmentId))}>
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
      <NewEquipmentRow protocolList={protocolList} addEquipment={addEquipment} />
      <ReactJson src={equipments} name={null} collapsed displayObjectSize={false} displayDataTypes={false} enableClipboard={false} />
    </>
  )
}

South.propTypes = { history: PropTypes.object.isRequired }

export default withRouter(South)
