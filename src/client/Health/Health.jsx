import React from 'react'
import { Label, Row, Button } from 'reactstrap'
import Table from '../components/table/Table.jsx'
import apis from '../services/apis'
import { AlertContext } from '../context/AlertContext.jsx'

const Health = () => {
  const [status, setStatus] = React.useState([])
  const { setAlert } = React.useContext(AlertContext)

  /**
   * Acquire the status
   * @returns {void}
   */
  const fetchStatus = () => {
    apis.getStatus().then((response) => {
      setStatus(response)
    }).catch((error) => {
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

  const tableRows = Object.keys(status).map((key) => (
    [
      {
        name: key,
        value: key,
      },
      {
        name: 'value',
        value: status[key],
      },
    ]
  ))

  return (
    <>
      <Row>
        <Button color="primary" onClick={fetchStatus}>
          Refresh
        </Button>
      </Row>
      <Row>
        <Label>Health status</Label>
        {tableRows && <Table headers={[]} rows={tableRows} />}
      </Row>
    </>
  )
}
export default Health
