import React from 'react'
import PropTypes from 'prop-types'
import { Button } from 'reactstrap'
import { useHistory } from 'react-router-dom'
import { ProtocolForms } from './Protocols.jsx'

const PointsButton = ({ dataSource }) => {
  const history = useHistory()
  const handleEditPoints = () => {
    const link = `/south/${dataSource.dataSourceId}/points`
    history.push({ pathname: link })
  }
  const { points, dataSourceId, protocol } = dataSource
  return (ProtocolForms[protocol] && ProtocolForms[protocol].renderPoints) !== null ? (
    <Button
      className="inline-button autosize oi-points-button"
      color={points && points.length ? 'success' : 'warning'}
      onClick={() => handleEditPoints(dataSourceId)}
      size="sm"
      outline
    >
      {`Points ${points ? `(${points.length})` : '(0)'}`}
    </Button>
  ) : null
}

PointsButton.propTypes = { dataSource: PropTypes.object.isRequired }

export default PointsButton
