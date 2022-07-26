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
        direction="left"
      >
        <DropdownToggle size="sm" id="dropdown-toggle" className="p-0 m-0 btn btn-secondary oi-dropdown-toggle">
          <FaEllipsisV />
        </DropdownToggle>
        <DropdownMenu flip={false}>
          <DropdownItem id="add-north" onClick={() => setNorthModal(true)}>
            Add North
          </DropdownItem>
          <DropdownItem id="add-south" onClick={() => setSouthModal(true)}>
            Add South
          </DropdownItem>
          <DropdownItem
            id="history"
            onClick={() => {
              navigate('/history-query')
            }}
          >
            History
          </DropdownItem>
          <DropdownItem
            id="oi-settings"
            onClick={() => {
              navigate('/engine')
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
            onConfirm={() => {
              onRestart()
              setRestartShow(false)
            }}
            isOpen={restartShow}
            toggle={() => setRestartShow(false)}
          />
          <DropdownItem id="shutdown" onClick={() => setShutdownShow(true)}>
            Shutdown
          </DropdownItem>
          <ConfirmationModal
            title="Shutdown"
            body="Confirm shutdown?"
            onConfirm={() => {
              onShutdown()
              setShutdownShow(false)
            }}
            isOpen={shutdownShow}
            toggle={() => setShutdownShow(false)}
          />
        </DropdownMenu>

      </Dropdown>
      <NewSouth openModal={southModal} toggle={() => setSouthModal(false)} />
      <NewNorth openModal={northModal} toggle={() => setNorthModal(false)} />
    </>
  )
}

EngineMenu.propTypes = {
  onRestart: PropTypes.func.isRequired,
  onShutdown: PropTypes.func.isRequired,
}

export default EngineMenu
