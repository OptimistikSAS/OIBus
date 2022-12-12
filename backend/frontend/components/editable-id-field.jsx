import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import { FaCheck } from 'react-icons/fa'
import { OibText } from './oib-form/index.js'

const EditableIdField = ({
  connectorName,
  fromList,
  valid,
  nameChanged,
  editing,
}) => {
  const [editingConnectorName, setEditingConnectorName] = React.useState()
  const [otherConnectorNames, setOtherConnectorNames] = React.useState(
    fromList.filter((e) => e.name !== connectorName).map((e) => e.name),
  )

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
      const list = fromList
        .filter((e) => e.name !== connectorName)
        .map((e) => e.name)
      setOtherConnectorNames(list)
    }
  }

  return editing ? (
    <div>
      <OibText
        onChange={onChange}
        value={editingConnectorName}
        valid={(val) => valid(val, otherConnectorNames)}
        name={connectorName}
        inline
      />
      <FaCheck id="save-icon" className="oi-icon mx-2" onClick={handleDoneEditName} />
    </div>
  ) : (
    <div>{connectorName}</div>
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
