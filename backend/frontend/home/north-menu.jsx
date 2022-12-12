import React, { useState } from 'react'
import { nanoid } from 'nanoid'
import PropTypes from 'prop-types'
import { FaEllipsisV } from 'react-icons/fa'
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap'
import { useNavigate } from 'react-router-dom'
import { ConfigContext } from '../context/config-context.jsx'
import ConfirmationModal from '../components/confirmation-modal.jsx'

const NorthMenu = ({ north }) => {
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  const navigate = useNavigate()
  const northConnectors = newConfig?.north ?? []
  const [modal, setModal] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const handleDuplicateNorth = () => {
    const newName = `${north.name} copy`
    const countCopies = northConnectors.filter((e) => e.name.startsWith(newName)).length
    dispatchNewConfig({
      type: 'addRow',
      name: 'north',
      value: {
        ...north,
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
    handleDeleteConnector(`north.${northConnectors.findIndex(
      (element) => element.id === north.id,
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
      <DropdownMenu flip={false}>
        <DropdownItem
          id="oi-settings"
          onClick={() => {
            navigate(`/north/${north.id}`)
          }}
        >
          Settings
        </DropdownItem>
        <DropdownItem
          id="oi-status"
          onClick={() => {
            navigate(`/north/${north.id}/live`)
          }}
        >
          Status
        </DropdownItem>
        <DropdownItem
          id="oi-duplicate"
          onClick={() => {
            handleDuplicateNorth()
          }}
        >
          Duplicate
        </DropdownItem>

        <DropdownItem id="oi-delete" onClick={() => setModal(true)}>
          <div>Delete</div>
        </DropdownItem>
        <ConfirmationModal
          title="Delete"
          body={`Are you sure you want to delete ${north.name}?`}
          onConfirm={onConfirm}
          isOpen={modal}
          toggle={() => setModal(false)}
        />
      </DropdownMenu>
    </Dropdown>
  )
}

NorthMenu.propTypes = { north: PropTypes.object.isRequired }

export default NorthMenu
