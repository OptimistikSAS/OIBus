import React, { useState } from 'react'
import { nanoid } from 'nanoid'
import PropTypes from 'prop-types'
import { FaEllipsisV } from 'react-icons/fa'
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap'
import { useNavigate } from 'react-router-dom'
import { ConfigContext } from '../context/ConfigContext.jsx'
import ConfirmationModal from '../components/ConfirmationModal.jsx'

const NorthMenu = ({ application }) => {
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  const navigate = useNavigate()
  const applications = newConfig?.north?.applications ?? []
  const [modal, setModal] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

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

  const onConfirm = () => {
    handleDeleteConnector(`north.applications.${applications.findIndex(
      (element) => element.id === application.id,
    )}`)
  }

  return (
    <Dropdown
      isOpen={dropdownOpen}
      toggle={() => setDropdownOpen((prevState) => !prevState)}
      direction="down"
    >
      <DropdownToggle size="sm" caret={false} id="dropdown-toggle" className="p-0 m-0 oi-dropdown-toggle">
        <FaEllipsisV />
      </DropdownToggle>
      <DropdownMenu>
        <DropdownItem
          id="oi-settings"
          onClick={() => {
            navigate(`/north/${application.id}`)
          }}
        >
          Settings
        </DropdownItem>
        <DropdownItem
          id="oi-status"
          onClick={() => {
            navigate(`/north/${application.id}/live`)
          }}
        >
          Status
        </DropdownItem>
        <DropdownItem
          id="oi-duplicate"
          onClick={() => {
            handleDuplicateNorth(application.id)
          }}
        >
          Duplicate
        </DropdownItem>

        <DropdownItem id="oi-delete" onClick={() => setModal(true)}>
          <div>Delete</div>
        </DropdownItem>
        <ConfirmationModal
          title="Delete"
          body={`Are you sure you want to delete ${application.name}?`}
          onConfirm={onConfirm}
          isOpen={modal}
          toggle={() => setModal(false)}
        />
      </DropdownMenu>
    </Dropdown>
  )
}

NorthMenu.propTypes = { application: PropTypes.object.isRequired }

export default NorthMenu
