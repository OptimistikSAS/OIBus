import React from 'react'
import PropTypes from 'prop-types'
import { Button } from 'reactstrap'
import { useNavigate } from 'react-router-dom'
import SouthSchemas from './SouthTypes.jsx'

const PointsButton = ({ south }) => {
  const navigate = useNavigate()
  const { points, type, enabled } = south
  const hasPoints = SouthSchemas[type]?.points !== null
  return hasPoints ? (
    <Button
      className="inline-button autosize oi-points-button"
      // eslint-disable-next-line no-nested-ternary
      color={enabled ? (points?.length ? 'success' : 'warning') : 'secondary'}
      onClick={() => navigate(`/south/${south.id}/points`)}
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

PointsButton.propTypes = { south: PropTypes.object.isRequired }

export default PointsButton
