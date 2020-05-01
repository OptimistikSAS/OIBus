import React from 'react'
import { Label, Row, Breadcrumb, BreadcrumbItem } from 'reactstrap'
import { FaSync } from 'react-icons/fa'
import Table from '../components/table/Table.jsx'
import apis from '../services/apis'
import { AlertContext } from '../context/AlertContext.jsx'
import { ConfigContext } from '../context/configContext.jsx'
import Overview from './Overview.jsx'
import utils from '../helpers/utils'

const Health = () => {
  const [status, setStatus] = React.useState([])
  const { setAlert } = React.useContext(AlertContext)
  const { activeConfig } = React.useContext(ConfigContext)
  const config = utils.jsonCopy(activeConfig)
  utils.replaceValues(config, ['password', 'secretKey'], '******')
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
      <Breadcrumb tag="h5">
        <BreadcrumbItem active tag="span">
          Home
        </BreadcrumbItem>
      </Breadcrumb>
      <Row>
        <Label>
          <span>
            {`${engineName} overview`}
            &nbsp;
            <FaSync className="oi-icon" onClick={fetchStatus} />
          </span>
        </Label>
      </Row>
      <Overview status={status} />
      <Row>
        <Label>
          <span>
            {`${engineName} health status`}
            &nbsp;
            <FaSync className="oi-icon" onClick={fetchStatus} />
          </span>
        </Label>
      </Row>
      <Row>{tableRows && <Table headers={[]} rows={tableRows} />}</Row>
    </>
  )
}
export default Health
