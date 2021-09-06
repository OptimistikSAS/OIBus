import React, { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { Button, Tooltip } from 'reactstrap'
import { FaCheck } from 'react-icons/fa'
import { OIbText } from './OIbForm'

const EditableIdField = ({ connectorName, fromList, valid, nameChanged, editing }) => {
  const [editingConnectorName, setEditingConnectorName] = React.useState()
  const [otherConnectorNames, setOtherConnectorNames] = React.useState(fromList.filter((e) => e.name !== connectorName).map((e) => e.name))
  const [openTooltip, setOpenTooltip] = React.useState(false)

  const toggleTooltip = () => {
    setOpenTooltip(!openTooltip)
  }

  const ref = useRef(null)

  useEffect(() => {
    if (editing) {
      setEditingConnectorName(connectorName)
    }
  }, [editing])

  const onChange = (_, value) => {
    setEditingConnectorName(value)
  }

  const handleDoneEditName = () => {
    const editingError = valid(editingConnectorName, otherConnectorNames)
    if (!editingError) {
      nameChanged(connectorName, editingConnectorName)
      const list = fromList.filter((e) => e.name !== connectorName).map((e) => e.name)
      setOtherConnectorNames(list)
    }
  }

  return (
    editing ? (
      <div className="oi-editing" style={{ display: 'flex' }}>
        <OIbText
          onChange={onChange}
          value={editingConnectorName}
          valid={(val) => valid(val, otherConnectorNames)}
          name={connectorName}
          inline
        />
        <Button close>
          <FaCheck
            className="oi-icon oi-icon-inline "
            onClick={handleDoneEditName}
          />
        </Button>
      </div>
    ) : (
      <div>
        <div ref={ref} style={{ display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
          {connectorName}
        </div>
        <Tooltip
          placement="top"
          target={ref}
          innerClassName="oi-popper-inner-class"
          isOpen={openTooltip}
          toggle={toggleTooltip}
        >
          {connectorName}
        </Tooltip>
      </div>
    )
  )
}

EditableIdField.propTypes = {
  connectorName: PropTypes.string.isRequired,
  fromList: PropTypes.arrayOf(Object).isRequired,
  valid: PropTypes.func.isRequired,
  nameChanged: PropTypes.func.isRequired,
  editing: PropTypes.bool.isRequired,
}
export default EditableIdField
