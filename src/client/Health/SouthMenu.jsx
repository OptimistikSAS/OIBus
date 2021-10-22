import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { nanoid } from 'nanoid'
import { FaEllipsisV } from 'react-icons/fa'
import { Dropdown, DropdownToggle, DropdownMenu, DropdownItem } from 'reactstrap'
import { useHistory } from 'react-router-dom'
import { ConfigContext } from '../context/configContext.jsx'
import ConfirmationModal from '../components/ConfirmationModal.jsx'

const SouthMenu = ({ dataSource }) => {
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
  const title = 'Delete'
  const body = `Are you sure you want to delete ${dataSource.name}?`
  const onConfirm = () => {
    handleDeleteConnector(`south.dataSources.${dataSources.findIndex(
      (element) => element.id === dataSource.id,
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
          <DropdownItem className="dropdown-item">
            <div
              id="oi-settings"
              aria-hidden="true"
              role="button"
              onClick={() => {
                handleGoToConnector(`/south/${dataSource.id}`)
              }}
            >

              Settings
            </div>
          </DropdownItem>

          <DropdownItem className="dropdown-item">
            <div
              id="oi-status"
              aria-hidden="true"
              role="button"
              onClick={() => {
                handleGoToConnector(`/south/${dataSource.id}/live`)
              }}
            >
              Status
            </div>
          </DropdownItem>
          <DropdownItem className="dropdown-item">
            <div
              id="oi-duplicate"
              aria-hidden="true"
              role="button"
              onClick={() => {
                handleDuplicateSouth(dataSource.id)
              }}
            >
              Duplicate
            </div>
          </DropdownItem>

          <DropdownItem className="dropdown-item" onClick={() => setModal(true)}>
            <div id="oi-delete"> Delete </div>
          </DropdownItem>
          <ConfirmationModal title={title} body={body} onConfirm={onConfirm} isOpen={modal} toggle={() => setModal(false)} />
        </DropdownMenu>
      </Dropdown>

    </>
  )
}

SouthMenu.propTypes = { dataSource: PropTypes.object.isRequired }

export default SouthMenu
