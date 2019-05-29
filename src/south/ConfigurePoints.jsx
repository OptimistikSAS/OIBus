import React from 'react'
import { withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'
import { Button } from 'reactstrap'
import Table from '../client/components/table/Table.jsx'
import apis from '../client/services/apis'

const ConfigureProtocol = ({ match, location }) => {
  const [pointsJson, setPointsJson] = React.useState([])
  const [configSchema, setConfigSchema] = React.useState([])

  /**
   * Sets the points schema JSON
   * @param {Object} schema schema of the protocol
   * @returns {void}
   */
  const updateSchema = (schema) => {
    const { points } = schema.properties
    setConfigSchema(points.items.properties)
  }

  /**
   * Acquire the list of points and schema for the protocol
   * @returns {void}
   */
  React.useEffect(() => {
    const { formData } = location
    setPointsJson(formData.points)
    apis.getSouthProtocolSchema(formData.protocol).then((schema) => {
      updateSchema(schema)
    })
  }, [])

  /**
   * create the array with title for the table header
   * this function is recursive, it will work recursiveli once the schema has objects
   * @param {Object} schema of the points from the protocol
   * @param {boolean} withAddons add addons before actual data
   * like: Index, action buttons etc.
   * @returns {Array} the titles for columns (headers)
   */
  const createTableHeader = (schema, withAddons = false) => {
    const keys = Object.keys(schema)
    let titles = withAddons ? ['Index', 'Actions'] : []
    keys.forEach((key) => {
      if (schema[key].type !== 'object') {
        titles.push(schema[key].title)
      } else {
        // extract titles in case of object
        titles = titles.concat(createTableHeader(schema[key].properties))
      }
    })
    return titles
  }

  /**
   * create one cell with the value
   * @param {string} value the displayed value
   * @returns {void}
   */
  const createCell = value => (
    <div>
      {value}
    </div>
  )

  /**
   * create actions buttons
   * TODO: to finsish on click listeners
   * @returns {void}
   */
  const createActions = () => (
    <div>
      <Button className="inline-button" color="primary" onClick={() => null}>
        Edit
      </Button>
      <Button className="inline-button" color="primary" onClick={() => null}>
        Delete
      </Button>
    </div>
  )

  /**
   * create addons array, to be displayed on each row
   * @param {number} index index of the row
   * @returns {array} array with name-value for the addons
   */
  const createAddons = index => [
    {
      name: 'index',
      value: index + 1,
    },
    {
      name: 'actions',
      value: createActions(),
    },
  ]

  /**
   * create the array with cells on a particular row
   * this function is recursive, it will work recursiveli once the schema has objects
   * @param {Object} schema of the points from the protocol
   * @param {Object} point data of one point
   * @param {number} index index of the row
   * @param {boolean} addAddons flag to add row addons
   * @returns {Array} array with name-value for the cells
   */
  const createTableRow = (schema, point, index = null, addAddons = false) => {
    const keys = Object.keys(point)
    let row = addAddons ? createAddons(index) : []
    keys.forEach((key) => {
      if (schema[key]) {
        if (schema[key].type !== 'object') {
          row.push({
            name: key,
            value: createCell(point[key]),
          })
        } else {
          row = row.concat(createTableRow(schema[key].properties, point[key]))
        }
      }
    })
    return row
  }

  // configure table header and rows
  const tableHeaders = createTableHeader(configSchema, true)
  const tableRows = pointsJson.map((point, index) => createTableRow(configSchema, point, index, true))

  return (
    <>
      <Table headers={tableHeaders} rows={tableRows} onRowClick={() => null} />
    </>
  )
}

ConfigureProtocol.propTypes = {
  match: PropTypes.object.isRequired,
  location: PropTypes.object.isRequired,
}

export default withRouter(ConfigureProtocol)
