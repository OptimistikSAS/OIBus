import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { FaEllipsisV, FaCog, FaRedoAlt, FaPlus } from 'react-icons/fa'
import { RiShutDownFill } from 'react-icons/ri'
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
            <DropdownItem className="icon-dropdown-item" onClick={() => setSouthModal(true)}>
              <FaPlus id="icon-add-south" className="icon-dropdown-item" />
              Add South
            </DropdownItem>

            <DropdownItem className="icon-dropdown-item" onClick={() => setNorthModal(true)}>
              <FaPlus id="icon-add-north" className="icon-dropdown-item" />
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
                <FaCog className="icon-dropdown-item" />
                Settings
              </div>
            </DropdownItem>

            <DropdownItem className="icon-dropdown-item" onClick={() => setRestartShow(true)}>
              <FaRedoAlt id="icon-restart" className="icon-dropdown-item" />
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
              <RiShutDownFill id="icon-shutdown" className="icon-dropdown-item" />
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
      </div>
    </>
  )
}

EngineMenu.propTypes = {
  onRestart: PropTypes.func.isRequired,
  onShutdown: PropTypes.func.isRequired,
}

export default EngineMenu
