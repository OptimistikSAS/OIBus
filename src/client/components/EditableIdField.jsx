import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import { Button } from 'reactstrap'
import { FaCheck } from 'react-icons/fa'
import { OIbText } from './OIbForm'

const EditableIdField = ({ connectorName, fromList, valid, nameChanged, editing }) => {
  const [editingConnectorName, setEditingConnectorName] = React.useState()
  const [otherConnectorNames, setOtherConnectorNames] = React.useState(fromList.filter((e) => e.name !== connectorName).map((e) => e.name))

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
            className="oi-icon oi-icon-inline"
            onClick={handleDoneEditName}
          />
        </Button>
      </div>
    ) : (
      <div>
        <div>
          {connectorName}
        </div>

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
