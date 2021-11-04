import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { FaEllipsisV } from 'react-icons/fa'
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()

  return (
    <>
      <Dropdown
        isOpen={dropdownOpen}
        toggle={toggle}
        direction="down"
      >
        <DropdownToggle size="sm" id="dropdown-toggle" className="p-0 m-0 oi-dropdown-toggle">
          <FaEllipsisV />
        </DropdownToggle>
        <DropdownMenu>
          <DropdownItem id="add-north" onClick={() => setNorthModal(true)}>
            Add North
          </DropdownItem>
          <DropdownItem id="add-south" onClick={() => setSouthModal(true)}>
            Add South
          </DropdownItem>
          <DropdownItem
            id="oi-settings"
            onClick={() => {
              navigate('/engine/')
            }}
          >
            Settings
          </DropdownItem>
          <DropdownItem id="restart" onClick={() => setRestartShow(true)}>
            Restart
          </DropdownItem>
          <ConfirmationModal
            title="Restart"
            body="Confirm restart?"
            onConfirm={onRestart}
            isOpen={restartShow}
            toggle={() => setRestartShow(false)}
          />
          <DropdownItem id="shutdown" onClick={() => setShutdownShow(true)}>
            Shutdown
          </DropdownItem>
          <ConfirmationModal
            title="Shutdown"
            body="Confirm shutdown?"
            onConfirm={onShutdown}
            isOpen={shutdownShow}
            toggle={() => setShutdownShow(false)}
          />
          <DropdownItem
            id="oi-about"
            onClick={() => {
              navigate('/about/')
            }}
          >
            About
          </DropdownItem>
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
