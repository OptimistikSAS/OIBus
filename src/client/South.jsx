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
   * Handles the click of the table rows and redirects the
   * user to the selected south equipment's configuration page
   * @param {array} equipment Data of the clicked row
   * @return {void}
   */
  const handleRowClick = (equipment) => {
    const [equipmentId] = equipment
    const equipmentIndex = getEquipmentIndex(equipmentId.value)
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

  const tableHeaders = ['Equipment ID', 'Enabled', 'Protocol']
  const tableRows = equipments.map(({ equipmentId, enabled, protocol }) => [
    { name: 'id', value: equipmentId },
    { name: 'enabled', value: enabled ? 'enabled' : '' },
    { name: 'protocol', value: protocol },
    {
      name: 'delete',
      value: (
        <Modal show={false} title="Delete equipment" body="Are you sure you want to delete this equipment?">
          {confirm => (
            <Button color="danger" onClick={confirm(() => handleDelete(equipmentId))}>
              Delete
            </Button>
          )}
        </Modal>
      ),
    },
  ])
  return (
    <>
      <Modal show={false} title="Delete equipment" body="Are you sure you want to delete this equipment?">
        {confirm => tableRows && <Table headers={tableHeaders} rows={tableRows} onRowClick={handleRowClick} onDeleteClick={confirm(handleDelete)} />}
      </Modal>
      <NewEquipmentRow protocolList={protocolList} addEquipment={addEquipment} />
      <ReactJson src={equipments} name={null} collapsed displayObjectSize={false} displayDataTypes={false} enableClipboard={false} />
    </>
  )
}

South.propTypes = { history: PropTypes.object.isRequired }

export default withRouter(South)
