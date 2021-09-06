import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { FaEllipsisV, FaCog, FaRedoAlt } from 'react-icons/fa'
import { RiShutDownFill } from 'react-icons/ri'

import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap'
import { Modal, Button } from 'react-bootstrap'
import { useHistory } from 'react-router-dom'

const EngineSettings = ({ onRestart, onShutdown }) => {
  const [restartShow, setRestartShow] = useState(false)
  const handleRestartClose = () => setRestartShow(false)
  const handleRestartShow = () => setRestartShow(true)

  const [shutdownShow, setShutdownShow] = useState(false)
  const handleShutdownClose = () => setShutdownShow(false)
  const handleShutdownShow = () => setShutdownShow(true)

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const toggle = () => setDropdownOpen((prevState) => !prevState)

  const history = useHistory()

  const handleGoToConnector = (pathname) => {
    history.push({ pathname })
  }

  return (
    <>
      <div className="icon-menu">
        <Dropdown
          isOpen={dropdownOpen}
          toggle={toggle}
          direction="left"
        >
          <DropdownToggle size="sm" className="icon-dropdown">
            <FaEllipsisV id="dropdown-toggle" className="icon-dropdown-ellipsis" />
          </DropdownToggle>

          <DropdownMenu>
            <DropdownItem className="icon-dropdown-item" onClick={handleRestartShow}>
              <FaRedoAlt id="icon-restart" className="icon-dropdown-item" />
              Restart
            </DropdownItem>
            <Modal show={restartShow} onHide={handleRestartClose}>
              <Modal.Body>Confirm restart?</Modal.Body>
              <Modal.Footer>
                <Button
                  id="restart-button"
                  variant="secondary"
                  onClick={onRestart}
                >
                  Confirm
                </Button>
                <Button
                  id="cancel-restart"
                  variant="primary"
                  onClick={handleRestartClose}
                >
                  Cancel
                </Button>
              </Modal.Footer>
            </Modal>

            <DropdownItem className="icon-dropdown-item" onClick={handleShutdownShow}>
              <RiShutDownFill id="icon-shutdown" className="icon-dropdown-item" />
              Shutdown
            </DropdownItem>
            <Modal show={shutdownShow} onHide={handleShutdownClose}>
              <Modal.Body>Confirm shutdown?</Modal.Body>
              <Modal.Footer>
                <Button
                  id="shutdown-button"
                  variant="secondary"
                  onClick={onShutdown}
                >
                  Confirm
                </Button>
                <Button
                  id="cancel-shutdown"
                  variant="primary"
                  onClick={handleShutdownClose}
                >
                  Cancel
                </Button>
              </Modal.Footer>
            </Modal>

            <DropdownItem className="icon-dropdown-item">
              <div
                id="icon-settings"
                aria-hidden="true"
                role="button"
                onClick={() => {
                  handleGoToConnector('/Engine/')
                }}
              >
                <FaCog className="icon-dropdown-item" />
                Settings
              </div>
            </DropdownItem>
          </DropdownMenu>
        </Dropdown>
      </div>
    </>
  )
}

EngineSettings.propTypes = {
  onRestart: PropTypes.func.isRequired,
  onShutdown: PropTypes.func.isRequired,
}

export default EngineSettings
