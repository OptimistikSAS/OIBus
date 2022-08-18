import React from 'react'
import { Container, Button } from 'reactstrap'
import { useParams, useNavigate } from 'react-router-dom'
import { FaArrowLeft } from 'react-icons/fa'
import { ConfigContext } from '../context/ConfigContext.jsx'
import Table from '../components/table/Table.jsx'
import utils from '../helpers/utils.js'

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
    value: utils.formatValue(value),
  },
]

const NorthStatus = () => {
  const [connectorData, setConnectorData] = React.useState(null)
  const { newConfig } = React.useContext(ConfigContext)
  const navigate = useNavigate()
  const { id } = useParams() // the application id passed in the url
  const [application, setApplication] = React.useState(null)

  React.useEffect(() => {
    const currentApplication = newConfig.north?.applications?.find(
      (element) => element.id === id,
    )
    setApplication(currentApplication)
  }, [newConfig, id])

  React.useEffect(() => {
    let source
    if (application && application.enabled) {
      source = new EventSource(`/north/${application.id}/sse`)
      source.onerror = (error) => {
        console.error(error)
      }
      source.onmessage = (event) => {
        if (event && event.data) {
          const myData = JSON.parse(event.data)
          const tableRows = []
          Object.keys(myData).forEach((key) => {
            tableRows.push(generateRowEntry(key, myData[key]))
          })
          setConnectorData(tableRows)
        }
      }
    }
    return () => {
      source?.close()
    }
  }, [application])

  return application ? (
    <>
      <div
        id="oi-sub-nav"
        className="d-flex align-items-center w-100 oi-sub-nav mb-2"
      >
        <h6 className="text-muted d-flex align-items-center ps-3 pt-2 pb-2 mb-0">
          <Button
            id="oi-navigate"
            outline
            onClick={() => {
              navigate(-1)
            }}
            className="util-button p-0 m-0"
          >
            <FaArrowLeft className="oi-back-icon" />
          </Button>
          <span className="mx-2">|</span>
          <span>{application.name}</span>
        </h6>
      </div>
      <Container>
        {connectorData ? (
          <Table headers={[]} rows={connectorData} />
        ) : (
          <div className="oi-status-error">
            This connector is not enabled.
          </div>
        )}
      </Container>
    </>
  ) : null
}
export default NorthStatus
