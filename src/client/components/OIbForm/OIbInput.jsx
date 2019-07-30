import React from 'react'
import PropTypes from 'prop-types'
import { FormGroup, FormFeedback, FormText, Label } from 'reactstrap'

const OIbInput = ({ config }) => {
  /* const inputChange = (event) => {
    onChange(event)
  } */
  const Dom = {}
  switch (config.type) {
    case 'port':
      Dom.type = 'integer'
      Dom.min = 1
      Dom.max = 65535
      break
    default:
      console.error(`unknown type ${config.type}`)
      break
  }
  /*
      switch(dom.type) {
        case 'integer':
        <Input
        type='integer'
        name={config.name}
        placeholder={config.placeholder}
        invalid={validate === 'has-danger'}
        onChange={handleChange} />
      }
      */
  return (
    <FormGroup>
      <Label for="exampleEmail">Email</Label>
      <FormFeedback>Invalid Entry</FormFeedback>
      <FormText>{config.help}</FormText>
    </FormGroup>
  )
}
OIbInput.propTypes = {
  // onChange: PropTypes.func.isRequired,
  config: PropTypes.object.isRequired,
  type: PropTypes.string.isRequired,
}

export default OIbInput
