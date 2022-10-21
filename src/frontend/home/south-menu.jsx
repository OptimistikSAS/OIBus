import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { nanoid } from 'nanoid'
import { FaEllipsisV } from 'react-icons/fa'
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap'
import { useNavigate } from 'react-router-dom'
import { ConfigContext } from '../context/config-context.jsx'
import ConfirmationModal from '../components/confirmation-modal.jsx'

const SouthMenu = ({ south }) => {
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  const navigate = useNavigate()
  const southConnectors = newConfig?.south ?? []
  const [modal, setModal] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const handleDuplicateSouth = () => {
    const newName = `${south.name} copy`
    const countCopies = southConnectors.filter((e) => e.name.startsWith(newName)).length
    dispatchNewConfig({
      type: 'addRow',
      name: 'south',
      value: {
        ...south,
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
    handleDeleteConnector(`south.${southConnectors.findIndex(
      (element) => element.id === south.id,
    )}`)
  }

  return (
    <Dropdown
      isOpen={dropdownOpen}
      toggle={() => setDropdownOpen((prevState) => !prevState)}
      direction="down"
    >
      <DropdownToggle size="sm" id="dropdown-toggle" className="p-0 m-0 oi-dropdown-toggle">
        <FaEllipsisV />
      </DropdownToggle>
      <DropdownMenu flip={false}>
        <DropdownItem
          id="oi-settings"
          onClick={() => {
            navigate(`/south/${south.id}`)
          }}
        >
          Settings
        </DropdownItem>
        <DropdownItem
          id="oi-status"
          onClick={() => {
            navigate(`/south/${south.id}/live`)
          }}
        >
          Status
        </DropdownItem>
        <DropdownItem
          id="oi-duplicate"
          onClick={() => {
            handleDuplicateSouth()
          }}
        >
          Duplicate
        </DropdownItem>
        <DropdownItem className="dropdown-item" id="oi-delete" onClick={() => setModal(true)}>
          Delete
        </DropdownItem>
        <ConfirmationModal
          title="Delete"
          body={`Are you sure you want to delete ${south.name}?`}
          onConfirm={onConfirm}
          isOpen={modal}
          toggle={() => setModal(false)}
        />
      </DropdownMenu>
    </Dropdown>
  )
}

SouthMenu.propTypes = { south: PropTypes.object.isRequired }

export default SouthMenu
