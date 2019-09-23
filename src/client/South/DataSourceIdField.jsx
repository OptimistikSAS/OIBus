import React from 'react'
import PropTypes from 'prop-types'
import { Button } from 'reactstrap'
import { FaPencilAlt, FaCheck } from 'react-icons/fa'
import { OIbText } from '../components/OIbForm'

const DataSourceIdField = ({ dataSourceId, dataSources, dataSourceIndex, dataSourceIdChanged }) => {
  const [editing, setEditing] = React.useState(false)
  const [editingDataSourceId, setEditingDataSourceId] = React.useState()
  const [otherDataSources, setOtherDataSources] = React.useState()
  const [editingError, setEditingError] = React.useState()

  const handleEditName = () => {
    setEditing(true)
    setEditingDataSourceId(dataSourceId)
    const dataSourcesList = dataSources.filter((e, i) => i !== dataSourceIndex).map((dataSource) => dataSource.dataSourceId)
    setOtherDataSources(dataSourcesList)
  }

  const isValidName = (val) => {
    let error = null
    if (otherDataSources.includes(val)) {
      error = 'Data source id already exists'
    }
    if (!error) {
      error = (((typeof val === 'string' || val instanceof String) && val !== '') ? null : 'value must not be empty')
    }
    setEditingError(error)
    return error
  }

  const onChange = (name, value) => {
    setEditingDataSourceId(value)
  }

  const handleDoneEditName = () => {
    if (!editingError) {
      dataSourceIdChanged(dataSourceIndex, editingDataSourceId)
      setEditing(false)
    }
  }

  const style = { display: 'inline-block' }
  return (
    editing ? (
      <div style={style}>
        <OIbText
          onChange={onChange}
          value={editingDataSourceId}
          valid={isValidName}
          name="dataSourceId"
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
        {dataSourceId}
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

DataSourceIdField.propTypes = {
  dataSourceId: PropTypes.string.isRequired,
  dataSources: PropTypes.arrayOf(Object).isRequired,
  dataSourceIndex: PropTypes.number.isRequired,
  dataSourceIdChanged: PropTypes.func.isRequired,
}
export default DataSourceIdField
