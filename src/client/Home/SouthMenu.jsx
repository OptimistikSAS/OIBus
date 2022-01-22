import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { nanoid } from 'nanoid'
import { FaEllipsisV } from 'react-icons/fa'
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap'
import { useNavigate } from 'react-router-dom'
import { ConfigContext } from '../context/ConfigContext.jsx'
import ConfirmationModal from '../components/ConfirmationModal.jsx'

const SouthMenu = ({ dataSource }) => {
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  const navigate = useNavigate()
  const dataSources = newConfig?.south?.dataSources ?? []
  const [modal, setModal] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const handleDuplicateSouth = () => {
    const newName = `${dataSource.name} copy`
    const countCopies = dataSources.filter((e) => e.name.startsWith(newName)).length
    dispatchNewConfig({
      type: 'addRow',
      name: 'south.dataSources',
      value: {
        ...dataSource,
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
    handleDeleteConnector(`south.dataSources.${dataSources.findIndex(
      (element) => element.id === dataSource.id,
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
      <DropdownMenu>
        <DropdownItem
          id="oi-settings"
          onClick={() => {
            navigate(`/south/${dataSource.id}`)
          }}
        >
          Settings
        </DropdownItem>
        <DropdownItem
          id="oi-status"
          onClick={() => {
            navigate(`/south/${dataSource.id}/live`)
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
          body={`Are you sure you want to delete ${dataSource.name}?`}
          onConfirm={onConfirm}
          isOpen={modal}
          toggle={() => setModal(false)}
        />
      </DropdownMenu>
    </Dropdown>
  )
}

SouthMenu.propTypes = { dataSource: PropTypes.object.isRequired }

export default SouthMenu
