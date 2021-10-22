import React from 'react'
import PropTypes from 'prop-types'
import { Button, Modal, ModalHeader, ModalBody, ModalFooter } from 'reactstrap'

const ConfirmationModal = ({ title, body, onConfirm, isOpen, toggle }) => (
  <Modal isOpen={isOpen} toggle={toggle}>
    <ModalHeader>
      {title}
    </ModalHeader>
    <ModalBody>
      {body}
    </ModalBody>
    <ModalFooter>
      <Button
        id="confirm"
        variant="secondary"
        onClick={onConfirm}
      >
        Confirm
      </Button>
      <Button
        id="cancel"
        variant="primary"
        onClick={toggle}
      >
        Cancel
      </Button>
    </ModalFooter>
  </Modal>
)

ConfirmationModal.propTypes = {
  title: PropTypes.string.isRequired,
  body: PropTypes.string.isRequired,
  onConfirm: PropTypes.func.isRequired,
  isOpen: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
}

export default ConfirmationModal
