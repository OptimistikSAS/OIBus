import React from 'react'
import PropTypes from 'prop-types'

const Select = ({ name, options, onChange }) => (
  <select onChange={onChange} name={name} className="form-control">
    {options.map((option) => (
      <option key={option} value={option}>
        {option}
      </option>
    ))}
  </select>
)

Select.propTypes = {
  options: PropTypes.PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
  name: PropTypes.string.isRequired,
}

export default Select
