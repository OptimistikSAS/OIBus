import React from 'react'
import { withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'
import ReactJson from 'react-json-view'
import Table from './components/table/Table.jsx'
import NewEquipmentRow from './NewEquipmentRow.jsx'
import Modal from './components/Modal.jsx'
import apis from './services/apis'

let toDelete = ''

const South = ({ history }) => {
  const [equipments, setEquipments] = React.useState([])
  const [protocolList, setProtocolList] = React.useState([])
  const [showModal, setShowModal] = React.useState(false)

  // acquire the South configuration
  React.useEffect(() => {
    apis.getConfig().then(({ config }) => {
      setEquipments(config.south.equipments)
    })
  }, [])

  // acquire the list of Protocols
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
   * Handles the click of the table rows and redirects the
   * user to the selected south equipment's configuration page
   * @param {array} equipment Data of the clicked row
   * @return {void}
   */
  const handleRowClick = (equipment) => {
    const [equipmentId] = equipment
    const equipmentIndex = getEquipmentIndex(equipmentId)
    if (equipmentIndex === -1) return
    const formData = equipments[equipmentIndex]
    const link = `/south/${formData.protocol}`
    history.push({ pathname: link, formData })
  }

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
   * Deletes the chosen equipment
   * @param {event} event the event to prevent the table row click event
   * @param {string} equipmentId The id to delete
   * @returns {void}
   */
  const handleDelete = (event, equipmentId) => {
    event.stopPropagation()

    if (equipmentId === '') return
    toDelete = equipmentId
    setShowModal(true)
  }

  /**
   * Deletes the selected equipment
   * @returns {void}
   */
  const onAcceptDelete = () => {
    setShowModal(false)
    apis.deleteSouth(toDelete).then(
      () => {
        setEquipments(prevState => prevState.filter(equipment => equipment.equipmentId !== toDelete))
        // TODO: Show loader
      },
      (error) => {
        console.error(error)
      },
    )
  }

  /**
   * Hides the modal and resets the toDelete variable
   * @returns {void}
   */
  const onDenyDelete = () => {
    setShowModal(false)
    toDelete = ''
  }

  const tableHeaders = ['Equipment ID', 'Enabled', 'Protocol']
  const tableRows = equipments.map(({ equipmentId, enabled, protocol }) => [equipmentId, enabled ? 'enabled' : '', protocol])
  return (
    <>
      {tableRows && <Table headers={tableHeaders} rows={tableRows} onRowClick={handleRowClick} onDeleteClick={handleDelete} />}
      <NewEquipmentRow protocolList={protocolList} addEquipment={addEquipment} />
      <ReactJson src={equipments} name={null} collapsed displayObjectSize={false} displayDataTypes={false} enableClipboard={false} />
      <Modal
        show={showModal}
        title="Delete equipment"
        body="Are you sure you want to delete this equipment?"
        onAccept={onAcceptDelete}
        onDeny={onDenyDelete}
      />
    </>
  )
}

South.propTypes = { history: PropTypes.object.isRequired }

export default withRouter(South)
