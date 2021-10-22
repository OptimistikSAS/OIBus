import React, { useState } from 'react'
import { nanoid } from 'nanoid'
import PropTypes from 'prop-types'
import { FaEllipsisV } from 'react-icons/fa'
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap'
import { useHistory } from 'react-router-dom'
import { ConfigContext } from '../context/configContext.jsx'
import ConfirmationModal from '../components/ConfirmationModal.jsx'

const NorthMenu = ({ application }) => {
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  const history = useHistory()
  const applications = newConfig?.north?.applications ?? []
  const [modal, setModal] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

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

  const title = 'Delete'
  const body = `Are you sure you want to delete ${application.name}?`
  const onConfirm = () => {
    handleDeleteConnector(`north.applications.${applications.findIndex(
      (element) => element.id === application.id,
    )}`)
  }

  return (
    <>

      <Dropdown
        isOpen={dropdownOpen}
        toggle={() => setDropdownOpen((prevState) => !prevState)}
        direction="down"
      >
        <DropdownToggle size="sm" className="icon-dropdown">
          <FaEllipsisV id="dropdown-toggle" className="icon-dropdown-ellipsis" />
        </DropdownToggle>

        <DropdownMenu style={{ textAlign: 'center' }}>
          <DropdownItem className="icon-dropdown-item">
            <div
              id="icon-settings"
              aria-hidden="true"
              role="button"
              onClick={() => {
                handleGoToConnector(`/north/${application.id}`)
              }}
            >
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
              Duplicate
            </div>
          </DropdownItem>

          <DropdownItem className="icon-dropdown-item" onClick={() => setModal(true)}>
            Delete
          </DropdownItem>
          <ConfirmationModal title={title} body={body} onConfirm={onConfirm} isOpen={modal} toggle={() => setModal(false)} />
        </DropdownMenu>
      </Dropdown>
    </>
  )
}

NorthMenu.propTypes = { application: PropTypes.object.isRequired }

export default NorthMenu
