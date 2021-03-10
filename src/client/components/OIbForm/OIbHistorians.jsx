import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import OIbTitle from './OIbTitle.jsx'
import Table from '../table/Table.jsx'

const OIbHistorians = ({ lastCompletedAt }) => {
  const renderTable = () => (
    <Table
      headers={['Type', 'Last Completed At', '']}
      rows={Object.keys(lastCompletedAt).map((key, i) => {
        const date = new Date(lastCompletedAt[key])
        return [
          {
            name: `key.${i}`,
            value: key,
          },
          {
            name: `value.${i}`,
            value: `${date.toLocaleDateString()} - ${date.toLocaleTimeString()} `,
          },
        ]
      })}
    />
  )

  return (
    <>
      <OIbTitle label="Historian support" />
      <Row>
        <Col md="6">
          {renderTable()}
        </Col>
      </Row>
    </>
  )
}

OIbHistorians.propTypes = { lastCompletedAt: PropTypes.object.isRequired }
OIbHistorians.defaultProps = {}

export default OIbHistorians
