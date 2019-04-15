import React from 'react'
import PropTypes from 'prop-types'
import { Container, Button, Form, FormGroup, Label, Input } from 'reactstrap'
import Select from './components/Select.jsx'

const NewEquipmentRow = ({ protocolList, addEquipment }) => {
  /**
   * Update the equipment's state if any value changed
   * @param {object} event The event object of the change
   * @returns {void}
   */

  const [equipment, setEquipment] = React.useState({ equipmentId: '', enable: false, protocol: 'Modbus' })
  const handleChange = (event) => {
    const { target } = event
    const { value } = target
    //  update the new equipment's state
    setEquipment(prevState => ({ ...prevState, [target.name]: value }))
  }
  const handleAddEquipement = () => {
    if (equipment.equipmentId === '') return
    addEquipment(equipment)
    // reset the line
    setEquipment({ equipmentId: '', enable: false, protocol: 'Modbus' })
  }

  return (
    <Container>
      <Form>
        <FormGroup>
          <Label for="Id">
            Equipment Id:
            <Input value={equipment.equipmentId} id="Id" name="equipmentId" type="text" onChange={handleChange} />
          </Label>
        </FormGroup>
        <FormGroup>
          <Select value={equipment.protocol} id="protocol" name="protocol" options={protocolList} onChange={handleChange} />
        </FormGroup>
        <Button color="primary" onClick={() => handleAddEquipement()}>
          Add
        </Button>
      </Form>
    </Container>
  )
}

NewEquipmentRow.propTypes = {
  protocolList: PropTypes.arrayOf(PropTypes.string).isRequired,
  addEquipment: PropTypes.func.isRequired,
}
export default NewEquipmentRow
