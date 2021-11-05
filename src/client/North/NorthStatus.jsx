import React from 'react'
import { Container, Button } from 'reactstrap'
import { useParams, useNavigate } from 'react-router-dom'
import { FaArrowLeft } from 'react-icons/fa'
import { AlertContext } from '../context/AlertContext.jsx'
import { ConfigContext } from '../context/configContext.jsx'
import Table from '../components/table/Table.jsx'

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

const NorthStatus = () => {
  const [connectorData, setConnectorData] = React.useState([])
  const { setAlert } = React.useContext(AlertContext)
  const { newConfig } = React.useContext(ConfigContext)
  const navigate = useNavigate()
  const { id } = useParams() // the dataSource id passed in the url

  const [application, setApplication] = React.useState(null)

  React.useEffect(() => {
    const currentApplication = newConfig.north?.applications?.find((element) => element.id === id)
    setApplication(currentApplication)
    const source = new EventSource(`/north/${id}/sse`)
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
    return (() => source.close())
  }, [newConfig])

  return application ? (
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
          {`| ${application.name}`}
        </h6>
      </div>
      <Container>{connectorData.length > 0 && <Table headers={[]} rows={connectorData} />}</Container>
    </>
  ) : null
}
export default NorthStatus
