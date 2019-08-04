import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import Table from '../components/table/Table.jsx'

const ScanModes = ({ scanModes }) => scanModes && (
  <>
    <h2>Scan Modes</h2>
    <Row>
      <Col md={6}>
        <Table
          headers={['scanMode', 'cron']}
          rows={scanModes.map((scanMode) => Object.entries(scanMode).map(([name, value]) => ({ name, value })))}
          onRowClick={() => null}
        />
      </Col>
    </Row>
  </>
)

ScanModes.propTypes = { scanModes: PropTypes.arrayOf(String).isRequired }

export default ScanModes

/*
    label="Network Filter"
     defaultIpAddresses={['127.0.0.1']}
            help={(
              <div>
                The list of IP addresses or hostnames allowed to access the Admin interface (can use * as a wildcard)
              </div>
*/

/*
        Scan mode: name of the scan mode defined by the user
        <br />
        Cron time: interval for the scans
        <br />
        Example to scan every 5 seconds at 6am on the first day of each month in 2019
        <br />
        2019 * 1 6 * /5
        <br />
      </div>
*/
