import React from 'react'
import { withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'
import ReactJson from 'react-json-view'
import Table from './components/table/Table.jsx'
import NewEquipmentRow from './NewEquipmentRow.jsx'
import apis from './services/apis'

const South = ({ history }) => {
  const [equipments, setEquipments] = React.useState([])
  const [protocolList, setProtocolList] = React.useState([])

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

  const tableHeaders = ['Equipment ID', 'Enabled', 'Protocol']
  const tableRows = equipments.map(({ equipmentId, enabled, protocol }) => [equipmentId, enabled ? 'enabled' : '', protocol])
  return (
    <>
      {tableRows && <Table headers={tableHeaders} rows={tableRows} onRowClick={handleRowClick} />}
      <NewEquipmentRow protocolList={protocolList} addEquipment={addEquipment} />
      <ReactJson src={equipments} name={null} collapsed displayObjectSize={false} displayDataTypes={false} enableClipboard={false} />
    </>
  )
}

South.propTypes = { history: PropTypes.object.isRequired }

export default withRouter(South)
