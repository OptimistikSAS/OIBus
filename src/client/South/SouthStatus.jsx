import React from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Label, Row, Container, Button } from 'reactstrap'
import { FaSync, FaArrowLeft } from 'react-icons/fa'
import Table from '../components/table/Table.jsx'
import apis from '../services/apis'
import { AlertContext } from '../context/AlertContext.jsx'
import PointsButton from './PointsButton.jsx'
import { ConfigContext } from '../context/configContext.jsx'

const SouthStatus = () => {
  const [status, setStatus] = React.useState({})
  const { setAlert } = React.useContext(AlertContext)
  const { newConfig } = React.useContext(ConfigContext)
  const navigate = useNavigate()
  const { id } = useParams() // the dataSource id passed in the url
  const dataSource = newConfig.south?.dataSources?.find((element) => element.id === id)
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

  return dataSource ? (
    <>
      <div className="d-flex align-items-center w-100 oi-sub-nav mb-2">
        <h6 className="text-muted d-flex align-items-center pl-3 pt-1">
          <Button
            close
            onClick={() => {
              navigate(-1)
            }}
          >
            <FaArrowLeft className="oi-icon mr-2" />
          </Button>
          {`| ${dataSource.name}`}
        </h6>
        <div className="pull-right mr-3">
          <PointsButton dataSource={dataSource} />
        </div>
      </div>
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
  ) : null
}
export default SouthStatus
