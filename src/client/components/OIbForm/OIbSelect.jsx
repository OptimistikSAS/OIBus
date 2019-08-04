import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormText, Label, Input } from 'reactstrap'

const OIbSelect = ({ label, help, option, options, name, onChange }) => {
  const [currentOption, setCurrentOption] = React.useState(option)

  const handleChange = (event) => {
    const { target } = event
    setCurrentOption(target.value)
    onChange(target.name, target.value)
  }

  return (
    <FormGroup>
      <Label for={name}>{label}</Label>
      <Input type="select" id={name} name={name} onChange={handleChange} option={currentOption}>
        { options.map((o) => <option key={o}>{o}</option>) }
      </Input>
      <FormText>{help}</FormText>
    </FormGroup>
  )
}
OIbSelect.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  help: PropTypes.element.isRequired,
  onChange: PropTypes.func.isRequired,
  options: PropTypes.arrayOf(String).isRequired,
  option: PropTypes.string.isRequired,
}

export default OIbSelect
