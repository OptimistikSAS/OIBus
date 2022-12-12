import React from 'react'
import { Button } from 'reactstrap'
import PropTypes from 'prop-types'
import Modal from '../../components/modal.jsx'

const ActionButtons = ({ onConfirm, onDecline, errors = undefined }) => (
  <div className="force-row-display">
    <Modal show={false} title="Server restart" body="The server will restart to activate the new configuration">
      {(confirm) => (
        <Button
          className="inline-button"
          color="primary"
          onClick={confirm(onConfirm)}
          disabled={errors !== undefined}
        >
          Activate
        </Button>
      )}
    </Modal>
    <Button className="inline-button" color="primary" onClick={() => onDecline()}>
      Decline
    </Button>
  </div>
)

ActionButtons.propTypes = { onConfirm: PropTypes.func.isRequired, onDecline: PropTypes.func.isRequired, errors: PropTypes.arrayOf(PropTypes.object) }

ActionButtons.defaultProps = { errors: undefined }
export default ActionButtons
