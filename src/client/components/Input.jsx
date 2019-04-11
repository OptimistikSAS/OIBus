import React from 'react'
import PropTypes from 'prop-types'

const Input = ({ name, type, onChange }) => {
  const inputChange = (event) => {
    onChange(event)
  }
  return <input name={name} type={type} onChange={inputChange} />
}
Input.propTypes = {
  onChange: PropTypes.func.isRequired,
  name: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
}

export default Input
