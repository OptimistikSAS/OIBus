import React from 'react'
import { Label, Col } from 'reactstrap'
import Table from './components/table/Table.jsx'
import apis from './services/apis'
import { AlertContext } from './context/AlertContext'

const Health = () => {
  const [status, setStatus] = React.useState([])
  const { setAlert } = React.useContext(AlertContext)

  /**
   * Acquire the status
   * @returns {void}
   */
  React.useEffect(() => {
    apis.getStatus().then((response) => {
      setStatus(response)
    }).catch((error) => {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    })
  }, [])

  const tableRows = Object.keys(status).map((key) => (
    [
      {
        name: 'name',
        value: key,
      },
      {
        name: 'value',
        value: status[key],
      },
    ]
  ))

  return (
    <Col>
      <Label>Health status</Label>
      {tableRows && <Table headers={[]} rows={tableRows} onRowClick={() => null} />}
    </Col>
  )
}
export default Health
