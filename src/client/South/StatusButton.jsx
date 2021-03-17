import React from 'react'
import PropTypes from 'prop-types'
import { FaInfoCircle } from 'react-icons/fa'

const StatusButton = ({ handler }) => (
  <FaInfoCircle
    className="oi-icon"
    onClick={(e) => {
      e.preventDefault()
      handler()
    }}
  />
)

StatusButton.propTypes = { handler: PropTypes.func.isRequired }

export default StatusButton
