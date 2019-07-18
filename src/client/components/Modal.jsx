import React from 'react'
import PropTypes from 'prop-types'
import { Button, Modal as BsModal, ModalHeader, ModalBody, ModalFooter } from 'reactstrap'

const Modal = ({ children, show, title, body, acceptLabel, denyLabel, acceptColor }) => {
  const [open, setOpen] = React.useState(show)
  const [callback, setCallback] = React.useState(null)

  /**
   * Shows the confirmation modal
   * @param {func} callbackParam The function to be called upon confirmation
   * @param {Object} event The event object
   * @returns {void}
   */
  const showModal = (callbackParam) => (event) => {
    event.stopPropagation()
    setOpen(true)
    setCallback({ func: callbackParam })
  }

  /**
   * Hides the modal
   * @returns {void}
   */
  const hideModal = () => {
    setOpen(false)
    setCallback(null)
  }

  /**
   * Handles the confirmation of the modal
   * @returns {void}
   */
  const confirm = () => {
    callback.func()
    hideModal()
  }

  return (
    <>
      {children(showModal)}
      <BsModal isOpen={open} toggle={hideModal}>
        <ModalHeader toggle={hideModal}>{title}</ModalHeader>
        <ModalBody>{body}</ModalBody>
        <ModalFooter>
          <Button color={acceptColor} onClick={confirm}>
            {acceptLabel}
          </Button>
          {' '}
          <Button color="secondary" onClick={hideModal}>
            {denyLabel}
          </Button>
        </ModalFooter>
      </BsModal>
    </>
  )
}
Modal.propTypes = {
  show: PropTypes.bool.isRequired,
  title: PropTypes.string.isRequired,
  body: PropTypes.string.isRequired,
  acceptLabel: PropTypes.string,
  denyLabel: PropTypes.string,
  children: PropTypes.func.isRequired,
  acceptColor: PropTypes.string,
}

Modal.defaultProps = {
  acceptLabel: 'Confirm',
  denyLabel: 'Cancel',
  acceptColor: 'primary',
}
export default Modal
