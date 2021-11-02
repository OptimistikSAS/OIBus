import React from 'react'
import { ListGroup, ListGroupItem, Row, Breadcrumb, BreadcrumbItem, Container } from 'reactstrap'
import { FaSync } from 'react-icons/fa'
import Table from '../components/table/Table.jsx'
import apis from '../services/apis'
import { AlertContext } from '../context/AlertContext.jsx'
import { ConfigContext } from '../context/configContext.jsx'
import logo from './OIBus.png'

const About = () => {
  const [status, setStatus] = React.useState({})
  const { setAlert } = React.useContext(AlertContext)
  const { activeConfig } = React.useContext(ConfigContext)
  const engineName = activeConfig?.engine.engineName ?? ''

  /**
   * Acquire the status
   * @returns {void}
   */
  const fetchStatus = () => {
    apis
      .getStatus()
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
      <Row>
        <Container fluid>
          {status && (
          <ListGroup>
            <ListGroupItem tag="a" href="https://optimistik.io/oibus">
              <img src={logo} alt="logo" height="100px" />
            </ListGroupItem>
            <ListGroupItem>
              Version:
              {status.version}
            </ListGroupItem>
            <ListGroupItem tag="a" href="https://optimistik.io/oibus">
              Official site
            </ListGroupItem>
            <ListGroupItem>
              Copyright:
              {status.copyright}
            </ListGroupItem>
            <ListGroupItem tag="a" href="https://joinup.ec.europa.eu/sites/default/files/custom-page/attachment/2020-03/EUPL-1.2%20EN.txt">
              Licensed under the EUPL-1.2-or-later
            </ListGroupItem>
          </ListGroup>
          )}
        </Container>
      </Row>
      <br />
      <Row>
        <Breadcrumb tag="h5">
          <BreadcrumbItem active tag="span">
            {`${engineName} health status`}
                    &nbsp;
            <FaSync className="oi-icon" onClick={fetchStatus} />
          </BreadcrumbItem>
        </Breadcrumb>
      </Row>
      <Row>
        <Container>{tableRows && <Table headers={[]} rows={tableRows} />}</Container>
      </Row>
    </>
  )
}
export default About
