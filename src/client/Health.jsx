import React from 'react'
import { Label } from 'reactstrap'
import Table from './components/table/Table.jsx'
import apis from './services/apis'

const Health = () => {
  const [status, setStatus] = React.useState([])

  /**
   * Acquire the status
   * @returns {void}
   */
  React.useEffect(() => {
    apis.getStatus().then((response) => {
      setStatus(response)
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
    <div>
      <Label>Health status</Label>
      {tableRows && <Table headers={[]} rows={tableRows} onRowClick={() => null} />}
    </div>
  )
}
export default Health
