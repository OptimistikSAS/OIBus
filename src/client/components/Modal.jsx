import React from 'react'
import PropTypes from 'prop-types'
import { Button, Modal as BsModal, ModalHeader, ModalBody, ModalFooter } from 'reactstrap'

// eslint-disable-next-line no-unused-vars
const Modal = ({ show, title, body, acceptLabel, denyLabel, onAccept, onDeny }) => {
  const [open, setOpen] = React.useState(show)
  const toggle = () => {
    setOpen(prevState => !prevState)
  }

  React.useEffect(() => {
    setOpen(show)
  }, [show])

  return (
    <BsModal isOpen={open} toggle={toggle}>
      <ModalHeader toggle={toggle}>{title}</ModalHeader>
      <ModalBody>{body}</ModalBody>
      <ModalFooter>
        <Button color="primary" onClick={onAccept}>
          {acceptLabel}
        </Button>
        {' '}
        <Button color="secondary" onClick={onDeny}>
          {denyLabel}
        </Button>
      </ModalFooter>
    </BsModal>
  )
}
Modal.propTypes = {
  show: PropTypes.bool.isRequired,
  onAccept: PropTypes.func.isRequired,
  onDeny: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  body: PropTypes.string.isRequired,
  acceptLabel: PropTypes.string,
  denyLabel: PropTypes.string,
}

Modal.defaultProps = {
  acceptLabel: 'Confirm',
  denyLabel: 'Cancel',
}
export default Modal
