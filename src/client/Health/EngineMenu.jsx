import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { FaEllipsisV } from 'react-icons/fa'
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap'
import { useHistory } from 'react-router-dom'
import ConfirmationModal from '../components/ConfirmationModal.jsx'
import NewSouth from './NewSouth.jsx'
import NewNorth from './NewNorth.jsx'

const EngineMenu = ({ onRestart, onShutdown }) => {
  const [southModal, setSouthModal] = useState(false)
  const [northModal, setNorthModal] = useState(false)
  const [restartShow, setRestartShow] = useState(false)
  const [shutdownShow, setShutdownShow] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const toggle = () => setDropdownOpen((prevState) => !prevState)

  const history = useHistory()

  const handleGoToConnector = (pathname) => {
    history.push({ pathname })
  }
  const titleRestart = 'Restart'
  const titleShutDown = 'Shutdown'
  const bodyRestart = 'Confirm restart?'
  const bodyShutDown = 'Confirm shutdown?'

  return (
    <>

      <Dropdown
        isOpen={dropdownOpen}
        toggle={toggle}
        direction="down"
      >
        <DropdownToggle size="sm" className="icon-dropdown">
          <FaEllipsisV id="dropdown-toggle" className="icon-dropdown-ellipsis" />
        </DropdownToggle>

        <DropdownMenu style={{ textAlign: 'center' }}>
          <DropdownItem className="icon-dropdown-item" onClick={() => setSouthModal(true)}>
            Add South
          </DropdownItem>

          <DropdownItem className="icon-dropdown-item" onClick={() => setNorthModal(true)}>
            Add North
          </DropdownItem>

          <DropdownItem className="icon-dropdown-item">
            <div
              id="icon-settings"
              aria-hidden="true"
              role="button"
              onClick={() => {
                handleGoToConnector('/Engine/')
              }}
            >
              Settings
            </div>
          </DropdownItem>

          <DropdownItem className="icon-dropdown-item" onClick={() => setRestartShow(true)}>
            Restart
          </DropdownItem>
          <ConfirmationModal
            title={titleRestart}
            body={bodyRestart}
            onConfirm={onRestart}
            isOpen={restartShow}
            toggle={() => setRestartShow(false)}
          />

          <DropdownItem className="icon-dropdown-item" onClick={() => setShutdownShow(true)}>
            Shutdown
          </DropdownItem>
          <ConfirmationModal
            title={titleShutDown}
            body={bodyShutDown}
            onConfirm={onShutdown}
            isOpen={shutdownShow}
            toggle={() => setShutdownShow(false)}
          />
        </DropdownMenu>
      </Dropdown>
      <NewSouth modal={southModal} toggle={() => setSouthModal(false)} />
      <NewNorth modal={northModal} toggle={() => setNorthModal(false)} />

    </>
  )
}

EngineMenu.propTypes = {
  onRestart: PropTypes.func.isRequired,
  onShutdown: PropTypes.func.isRequired,
}

export default EngineMenu
