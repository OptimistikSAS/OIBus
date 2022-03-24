import React from 'react'
import PropTypes from 'prop-types'
import { Button } from 'reactstrap'
import { useNavigate } from 'react-router-dom'

const ConnectorButton = ({
  connectorUrl,
  connectorName,
}) => {
  const navigate = useNavigate()

  return (
    <Button
      className="inline-button autosize oi-status-button"
      color="primary"
      onClick={() => navigate(connectorUrl)}
      size="sm"
      outline
    >
      {connectorName}
    </Button>
  )
}

ConnectorButton.propTypes = {
  connectorUrl: PropTypes.string.isRequired,
  connectorName: PropTypes.string.isRequired,
}

export default ConnectorButton
