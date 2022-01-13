import React from 'react'
import { Container, Button } from 'reactstrap'
import { useParams, useNavigate } from 'react-router-dom'
import { FaArrowLeft } from 'react-icons/fa'
import { AlertContext } from '../context/AlertContext.jsx'
import PointsButton from './PointsButton.jsx'
import { ConfigContext } from '../context/ConfigContext.jsx'
import Table from '../components/table/Table.jsx'

function isIsoDate(str) {
  if (!/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/.test(str)) return false
  const d = new Date(str)
  return d.toISOString() === str
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
    value: isIsoDate(value) ? new Date(value).toLocaleString() : value,
  },
]

const SouthStatus = () => {
  const [connectorData, setConnectorData] = React.useState([])
  const { setAlert } = React.useContext(AlertContext)
  const { newConfig } = React.useContext(ConfigContext)
  const navigate = useNavigate()
  const { id } = useParams() // the dataSource id passed in the url
  const [dataSource, setDataSource] = React.useState(null)
  const [sseSource, setSseSource] = React.useState(null)

  React.useEffect(() => {
    const currentDataSource = newConfig.south?.dataSources?.find(
      (element) => element.id === id,
    )
    setDataSource(currentDataSource)

    if (currentDataSource && currentDataSource.enabled) {
      const source = new EventSource(`/south/${id}/sse`)
      source.onerror = (error) => {
        setAlert({ text: error.message, type: 'danger' })
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
      setSseSource(source)
    }
    return () => {
      if (sseSource) {
        sseSource.close()
      }
    }
  }, [newConfig])

  return dataSource ? (
    <>
      <div
        id="oi-sub-nav"
        className="d-flex align-items-center w-100 oi-sub-nav mb-2"
      >
        <h6 className="text-muted d-flex align-items-center ps-3 pt-1">
          <Button
            id="oi-navigate"
            outline
            onClick={() => {
              navigate(-1)
            }}
            className="util-button"
          >
            <FaArrowLeft className="oi-icon me-2" />
          </Button>
          {`| ${dataSource.name}`}
        </h6>
        <div className="pull-right me-3">
          <PointsButton dataSource={dataSource} />
        </div>
      </div>

      <Container>
        {connectorData.length > 0 ? (
          <Table headers={[]} rows={connectorData} />
        ) : (
          <div className="oi-status-error">
            {' '}
            No Information displayed because the connector is disabled
            {' '}
          </div>
        )}
      </Container>
    </>
  ) : null
}
export default SouthStatus
