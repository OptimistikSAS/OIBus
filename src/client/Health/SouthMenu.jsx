import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { nanoid } from 'nanoid'
import { FaEllipsisV, FaTrashAlt, FaPencilAlt, FaCopy, FaCog, FaSpinner, FaToggleOff } from 'react-icons/fa'
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap'
import { useHistory } from 'react-router-dom'
import { ConfigContext } from '../context/configContext.jsx'
import ConfirmationModal from '../components/ConfirmationModal.jsx'

const SouthMenu = ({ dataSource, renamingConnector }) => {
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  const history = useHistory()
  const dataSources = newConfig?.south?.dataSources ?? []
  const [modal, setModal] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const handleGoToConnector = (pathname) => {
    history.push({ pathname })
  }
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
  const onChange = () => {
    dispatchNewConfig({
      type: 'update',
      name: dataSource.name,
      value: {
        name: dataSource.name,
        enabled: dataSource.enabled ? 'false' : 'true',
      },
    })
  }
  const title = 'Delete'
  const body = `Are you sure you want to delete ${dataSource.name}?`
  const onConfirm = () => {
    handleDeleteConnector(`south.dataSources.${dataSources.findIndex(
      (element) => element.id === dataSource.id,
    )}`)
  }
  return (
    <>
      <div className="icon-menu">
        <Dropdown
          isOpen={dropdownOpen}
          toggle={() => setDropdownOpen((prevState) => !prevState)}
          direction="up"
        >
          <DropdownToggle size="sm" className="icon-dropdown">
            <FaEllipsisV id="dropdown-toggle" className="icon-dropdown-ellipsis" />
          </DropdownToggle>

          <DropdownMenu>
            <DropdownItem className="icon-dropdown-item">
              <div
                id="icon-activation"
                role="button"
                aria-hidden="true"
                onClick={() => {
                  onChange()
                }}
              >
                <FaToggleOff className="icon-dropdown-item" />
                {dataSource.enabled ? 'Disable' : 'Enable'}
              </div>
            </DropdownItem>
            <DropdownItem className="icon-dropdown-item">
              <div
                id="icon-rename"
                role="button"
                aria-hidden="true"
                onClick={() => {
                  renamingConnector(`south-${dataSource.id}`)
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
                  handleGoToConnector(`/south/${dataSource.id}`)
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
                  handleDuplicateSouth(dataSource.id)
                }}
              >
                <FaCopy className="icon-dropdown-item" />
                Duplicate
              </div>
            </DropdownItem>

            <DropdownItem className="icon-dropdown-item">
              <div
                id="icon-status"
                aria-hidden="true"
                role="button"
                onClick={() => {
                  handleGoToConnector(`/south/${dataSource.id}/live`)
                }}
              >
                <FaSpinner className="icon-dropdown-item" />
                Status
              </div>
            </DropdownItem>

            <DropdownItem className="icon-dropdown-item" onClick={() => setModal(true)}>
              <FaTrashAlt id="icon-delete" className="icon-dropdown-item" />
              Delete
            </DropdownItem>
            <ConfirmationModal title={title} body={body} onConfirm={onConfirm} isOpen={modal} toggle={() => setModal(false)} />
          </DropdownMenu>
        </Dropdown>
      </div>
    </>
  )
}

SouthMenu.propTypes = {
  dataSource: PropTypes.object.isRequired,
  renamingConnector: PropTypes.func.isRequired,
}

export default SouthMenu
