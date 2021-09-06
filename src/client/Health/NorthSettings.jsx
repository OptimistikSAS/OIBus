import React, { useState } from 'react'
import { nanoid } from 'nanoid'
import PropTypes from 'prop-types'
import { FaEllipsisV, FaTrashAlt, FaPencilAlt, FaCopy, FaCog } from 'react-icons/fa'
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap'
import { Modal, Button } from 'react-bootstrap'
import { useHistory } from 'react-router-dom'
import { ConfigContext } from '../context/configContext.jsx'

const NorthSettings = ({ application, renamingConnector }) => {
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  const history = useHistory()
  const applications = newConfig?.north?.applications ?? []

  const [show, setShow] = useState(false)
  const handleClose = () => setShow(false)
  const handleShow = () => setShow(true)

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const toggle = () => setDropdownOpen((prevState) => !prevState)

  const handleGoToConnector = (pathname) => {
    history.push({ pathname })
  }
  const handleDuplicateNorth = () => {
    const newName = `${application.name} copy`
    const countCopies = applications.filter((e) => e.name.startsWith(newName)).length
    dispatchNewConfig({
      type: 'addRow',
      name: 'north.applications',
      value: {
        ...application,
        id: nanoid(),
        name: `${newName}${countCopies > 0 ? countCopies + 1 : ''}`,
        enabled: false,
      },
    })
  }
  const handleDeleteConnector = (name) => {
    dispatchNewConfig({ type: 'deleteRow', name })
  }

  return (
    <>
      <div className="icon-menu">
        <Dropdown
          isOpen={dropdownOpen}
          toggle={toggle}
        >
          <DropdownToggle size="sm" className="icon-dropdown">
            <FaEllipsisV id="dropdown-toggle" className="icon-dropdown-ellipsis" />
          </DropdownToggle>

          <DropdownMenu>
            <DropdownItem className="icon-dropdown-item">
              <div
                id="icon-rename"
                role="button"
                aria-hidden="true"
                onClick={() => {
                  renamingConnector(`north-${application.id}`)
                }}
              >
                <FaPencilAlt className="icon-dropdown-item" />
                Rename
              </div>
            </DropdownItem>

            <DropdownItem className="icon-dropdown-item">
              <div
                id="icon-settings"
                aria-hidden="true"
                role="button"
                onClick={() => {
                  handleGoToConnector(`/north/${application.id}`)
                }}
              >
                <FaCog className="icon-dropdown-item" />
                Settings
              </div>
            </DropdownItem>

            <DropdownItem className="icon-dropdown-item">
              <div
                id="icon-duplicate"
                aria-hidden="true"
                role="button"
                onClick={() => {
                  handleDuplicateNorth(application.id)
                }}
              >
                <FaCopy className="icon-dropdown-item" />
                Duplicate
              </div>
            </DropdownItem>

            <DropdownItem className="icon-dropdown-item" onClick={handleShow}>
              <FaTrashAlt id="icon-delete" className="icon-dropdown-item" />
              Delete
            </DropdownItem>
            <Modal show={show} onHide={handleClose}>
              <Modal.Header closeButton>
                Delete
              </Modal.Header>
              <Modal.Body>{`Are you sure you want to delete ${application.name}?`}</Modal.Body>
              <Modal.Footer>
                <Button
                  id="icon-confirm"
                  variant="secondary"
                  onClick={() => handleDeleteConnector(`north.applications.${applications.findIndex(
                    (element) => element.id === application.id,
                  )}`)}
                >
                  Confirm
                </Button>
                <Button
                  id="cancel-button"
                  variant="primary"
                  onClick={handleClose}
                >
                  Cancel
                </Button>
              </Modal.Footer>
            </Modal>
          </DropdownMenu>
        </Dropdown>
      </div>
    </>
  )
}

NorthSettings.propTypes = {
  application: PropTypes.object.isRequired,
  renamingConnector: PropTypes.func.isRequired,
}

export default NorthSettings
