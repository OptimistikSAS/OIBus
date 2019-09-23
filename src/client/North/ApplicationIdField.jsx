import React from 'react'
import PropTypes from 'prop-types'
import { Button } from 'reactstrap'
import { FaPencilAlt, FaCheck } from 'react-icons/fa'
import { OIbText } from '../components/OIbForm'

const ApplicationIdField = ({ applicationId, applications, applicationIndex, applicationIdChanged }) => {
  const [editing, setEditing] = React.useState(false)
  const [editingApplicationId, setEditingApplicationId] = React.useState()
  const [otherApplications, setOtherApplications] = React.useState()
  const [editingError, setEditingError] = React.useState()

  const handleEditName = () => {
    setEditing(true)
    setEditingApplicationId(applicationId)
    const applicationsList = applications.filter((e, i) => i !== applicationIndex).map((application) => application.applicationId)
    setOtherApplications(applicationsList)
  }

  const isValidName = (val) => {
    let error = null
    if (otherApplications.includes(val)) {
      error = 'Application id already exists'
    }
    if (!error) {
      error = (((typeof val === 'string' || val instanceof String) && val !== '') ? null : 'value must not be empty')
    }
    setEditingError(error)
    return error
  }

  const onChange = (name, value) => {
    setEditingApplicationId(value)
  }

  const handleDoneEditName = () => {
    if (!editingError) {
      applicationIdChanged(applicationIndex, editingApplicationId)
      setEditing(false)
    }
  }

  const style = { display: 'inline-block' }
  return (
    editing ? (
      <div style={style}>
        <OIbText
          onChange={onChange}
          value={editingApplicationId}
          valid={isValidName}
          name="applicationId"
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
        {applicationId}
        <Button close>
          <FaPencilAlt
            className="oi-icon oi-icon-inline"
            onClick={() => {
              handleEditName()
            }}
            style={{ height: 12 }}
          />
        </Button>
      </div>
    )
  )
}

ApplicationIdField.propTypes = {
  applicationId: PropTypes.string.isRequired,
  applications: PropTypes.arrayOf(Object).isRequired,
  applicationIndex: PropTypes.number.isRequired,
  applicationIdChanged: PropTypes.func.isRequired,
}
export default ApplicationIdField
