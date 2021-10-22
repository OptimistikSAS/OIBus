import React from 'react'
import { useParams, useHistory } from 'react-router-dom'
import { Label, Row, Container, Col } from 'reactstrap'
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
  const history = useHistory()
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

  const handleGoToConnector = (pathname) => {
    history.push({ pathname })
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
      <Row className="oi-container-settings">
        <FaArrowLeft
          className="oi-container-return"
          onClick={() => {
            handleGoToConnector(`/south/${dataSource.id}`)
          }}

        />

        <div className="oi-container-name">
          |
          {' '}
          {dataSource.name}
        </div>
        <Col md={2} className="oi-container-status">
          <PointsButton dataSource={dataSource} />
        </Col>
      </Row>

      <Row style={{ marginTop: '15px' }}>
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
