import React from 'react'
import PropTypes from 'prop-types'
import Select from './components/Select.jsx'

const NewEquipmentRow = ({ protocolList, addEquipment }) => {
  /**
   * Update the equipment's state if any value changed
   * @param {object} event The event object of the change
   * @returns {void}
   */

  const [equipment, setEquipment] = React.useState({ equipmentId: '', enable: false, protocol: 'Modbus' })
  const handleChange = (event) => {
    const {
      target,
      target: { type, name },
    } = event
    const value = type === 'checkbox' ? target.checked : target.value
    //  update the new equipment's state
    setEquipment(prevState => ({ ...prevState, [name]: value }))
  }
  const handleAddEquipement = () => {
    if (equipment.equipmentId === '') return
    addEquipment(equipment)
    // reset the line
    setEquipment({ equipmentId: '', enable: false, protocol: 'Modbus' })
  }

  return (
    <table className="table table-sm">
      <tbody>
        <tr>
          <td>
            <input value={equipment.equipmentId} name="equipmentId" type="text" onChange={handleChange} />
          </td>
          <td>
            <input value={equipment.enable} name="enabled" type="checkbox" onChange={handleChange} />
          </td>
          <td>
            <Select value={equipment.protocol} name="protocol" options={protocolList} onChange={handleChange} />
          </td>
          <td>
            <button type="button" className="btn btn-primary" onClick={() => handleAddEquipement()}>
              Add
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  )
}

NewEquipmentRow.propTypes = {
  protocolList: PropTypes.arrayOf(PropTypes.string).isRequired,
  addEquipment: PropTypes.func.isRequired,
}
export default NewEquipmentRow
