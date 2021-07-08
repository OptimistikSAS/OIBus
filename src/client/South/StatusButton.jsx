import React from 'react'
import PropTypes from 'prop-types'
import { Button } from 'reactstrap'
import { FaInfoCircle } from 'react-icons/fa'

const StatusButton = ({ handler, isIcon, enabled }) => (
  <>
    {isIcon ? (
      <FaInfoCircle
        className="oi-icon"
        onClick={(e) => {
          e.preventDefault()
          handler()
        }}
      />
    ) : (
      <Button
        className="inline-button autosize oi-status-button"
        color={enabled ? 'success' : 'secondary'}
        onClick={handler}
        size="sm"
        outline
      >
        Status
      </Button>
    )}
  </>
)

StatusButton.propTypes = { handler: PropTypes.func.isRequired, isIcon: PropTypes.bool, enabled: PropTypes.bool }
StatusButton.defaultProps = { isIcon: false, enabled: false }

export default StatusButton
