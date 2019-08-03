import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormText, Label, Input } from 'reactstrap'

const OIbSelect = ({ label, help, option, options, id, onChange }) => {
  const [currentOption, setCurrentOption] = React.useState(option)

  const handleChange = (event) => {
    const { target } = event
    setCurrentOption(target.value)
    onChange(target.name, target.value)
  }

  return (
    <FormGroup>
      <Label for={id}>{label}</Label>
      <Input type="select" id={id} name={id} onChange={handleChange} option={currentOption}>
        { options.map((o) => <option key={o}>{o}</option>) }
      </Input>
      <FormText>{help}</FormText>
    </FormGroup>
  )
}
OIbSelect.propTypes = {
  id: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  help: PropTypes.element.isRequired,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(String).isRequired,
  option: PropTypes.string.isRequired,
}

export default OIbSelect
