import React from 'react'
import PropTypes from 'prop-types'
import { Button } from 'reactstrap'
import { FaPencilAlt, FaCheck } from 'react-icons/fa'
import { OIbText } from './OIbForm'

const EditableIdField = ({ id, fromList, index, name, valid, idChanged }) => {
  const [editing, setEditing] = React.useState(false)
  const [editingId, setEditingId] = React.useState()
  const [otherIds, setOtherIds] = React.useState()

  const handleEditName = () => {
    setEditing(true)
    setEditingId(id)
    const list = fromList.filter((e, i) => i !== index).map((e) => e[name])
    setOtherIds(list)
  }

  const onChange = (_, value) => {
    setEditingId(value)
  }

  const handleDoneEditName = () => {
    const editingError = valid(editingId, otherIds)
    if (!editingError) {
      idChanged(index, editingId)
      setEditing(false)
    }
  }

  const style = { display: 'inline-block' }
  return (
    editing ? (
      <div style={style}>
        <OIbText
          onChange={onChange}
          value={editingId}
          valid={(val) => valid(val, otherIds)}
          name={id}
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
      <div style={style}>
        {id}
        <Button close>
          <FaPencilAlt
            className="oi-icon oi-icon-inline"
            onClick={() => {
              handleEditName()
            }}
            style={{ height: 16 }}
          />
        </Button>
      </div>
    )
  )
}

EditableIdField.propTypes = {
  id: PropTypes.string.isRequired,
  fromList: PropTypes.arrayOf(Object).isRequired,
  index: PropTypes.number.isRequired,
  name: PropTypes.string.isRequired,
  valid: PropTypes.func.isRequired,
  idChanged: PropTypes.func.isRequired,
}
export default EditableIdField
