import React from 'react'
import PropTypes from 'prop-types'
import { Button, Modal as BsModal, ModalHeader, ModalBody, ModalFooter } from 'reactstrap'

const Modal = ({ children, show, title, body, acceptLabel, denyLabel }) => {
  const [open, setOpen] = React.useState(show)
  const [callback, setCallback] = React.useState(null)

  const showModal = callbackParam => (event, param) => {
    event.stopPropagation()
    const newEvent = {
      ...event,
      target: { ...event.target, value: event.target.value },
    }

    setOpen(true)
    setCallback({ func: () => callbackParam(newEvent, param) })
  }

  const hideModal = () => {
    setOpen(false)
    setCallback(null)
  }

  const confirm = () => {
    callback.func()
    hideModal()
  }

  React.useEffect(() => {
    setOpen(show)
  }, [show])

  return (
    <>
      {children(showModal)}
      <BsModal isOpen={open} toggle={hideModal}>
        <ModalHeader toggle={hideModal}>{title}</ModalHeader>
        <ModalBody>{body}</ModalBody>
        <ModalFooter>
          <Button color="primary" onClick={confirm}>
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
}

Modal.defaultProps = {
  acceptLabel: 'Confirm',
  denyLabel: 'Cancel',
}
export default Modal
