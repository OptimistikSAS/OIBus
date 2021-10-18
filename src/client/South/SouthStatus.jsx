import React from 'react'
import { Link, useParams } from 'react-router-dom'
import { Label, Row, Breadcrumb, BreadcrumbItem, Container } from 'reactstrap'
import { FaSync } from 'react-icons/fa'
import Table from '../components/table/Table.jsx'
import apis from '../services/apis'
import { AlertContext } from '../context/AlertContext.jsx'

const SouthStatus = () => {
  const [status, setStatus] = React.useState({})
  const { setAlert } = React.useContext(AlertContext)
  const { id } = useParams() // the dataSource id passed in the url

  /**
   * Acquire the status
   * @returns {void}
   */
  const fetchStatus = () => {
    apis
      .getSouthStatus(id)
      .then((response) => {
        setStatus(response)
      })
      .catch((error) => {
        console.error(error)
        setAlert({ text: error.message, type: 'danger' })
      })
  }

  /**
   * Fetch status after render
   * @returns {void}
   */
  React.useEffect(() => {
    fetchStatus()
  }, [])

  /**
   * Generate string value from on object.
   * @param {Object[]} data - The object
   * @return {string} - The string value
   */
  const generateStringValueFromObject = (data) => {
    let stringValue = ''
    Object.entries(data).forEach(([key, value]) => {
      if (key !== 'name') {
        stringValue += stringValue ? ` / ${key}: ${value}` : `${key}: ${value}`
      }
    })
    return stringValue
  }

  /**
   * Generate row entry for the status table.
   * @param {string} key - The key
   * @param {string} value - The value
   * @return {[{name: *, value: *}, {name: string, value: *}]} - The table row
   */
  const generateRowEntry = (key, value) => [
    {
      name: key,
      value: key,
    },
    {
      name: 'value',
      value,
    },
  ]

  const tableRows = []
  Object.keys(status).forEach((key) => {
    if (Array.isArray(status[key])) {
      status[key].forEach((entry) => {
        tableRows.push(generateRowEntry(entry.name, generateStringValueFromObject(entry)))
      })
    } else {
      tableRows.push(generateRowEntry(key, status[key]))
    }
  })

  return (
    <>
      <Breadcrumb tag="h5">
        <BreadcrumbItem tag={Link} to="/" className="oi-breadcrumb">
          Home
        </BreadcrumbItem>
        <BreadcrumbItem tag={Link} to="/south" className="oi-breadcrumb">
          South
        </BreadcrumbItem>
        <BreadcrumbItem tag={Link} to={`/south/${id}`} className="oi-breadcrumb">
          {status.Name}
        </BreadcrumbItem>
        <BreadcrumbItem active tag="span">
          Live
        </BreadcrumbItem>
      </Breadcrumb>
      <Row>
        <Label>
          <span>
            {`${status.Name} status`}
            &nbsp;
            <FaSync className="oi-icon" onClick={fetchStatus} />
          </span>
        </Label>
      </Row>
      <Row>
        <Container>{tableRows && <Table headers={[]} rows={tableRows} />}</Container>
      </Row>
    </>
  )
}
export default SouthStatus
