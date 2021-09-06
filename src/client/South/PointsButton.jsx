import React from 'react'
import PropTypes from 'prop-types'
import { Button } from 'reactstrap'
import { useHistory } from 'react-router-dom'
import ProtocolSchemas from './Protocols.jsx'

const PointsButton = ({ dataSource }) => {
  const history = useHistory()
  const handleEditPoints = () => {
    const link = `/south/${dataSource.id}/points`
    history.push({ pathname: link })
  }
  const { points, name, protocol, enabled } = dataSource
  const hasPoints = ProtocolSchemas[protocol]?.points !== null
  return hasPoints ? (
    <Button
      className="inline-button autosize oi-points-button"
      // eslint-disable-next-line no-nested-ternary
      color={enabled ? (points?.length ? 'secondary' : 'warning') : 'secondary'}
      onClick={() => handleEditPoints(name)}
      size="sm"
      outline
    >
      {`Points ${points ? `(${points.length})` : '(0)'}`}
    </Button>
  ) : (
    <Button
      className="inline-button autosize oi-points-button"
      size="sm"
      color="secondary"
      disabled
    >
      File
    </Button>
  )
}

PointsButton.propTypes = { dataSource: PropTypes.object.isRequired }

export default PointsButton
