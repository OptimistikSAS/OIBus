import React from 'react'
import PropTypes from 'prop-types'
import { Button } from 'reactstrap'
import { withRouter } from 'react-router-dom'

const PointsButton = ({ history, dataSource }) => {
  const handleEditPoints = () => {
    const link = `/south/${dataSource.dataSourceId}/points`
    history.push({ pathname: link })
  }
  const { points, dataSourceId } = dataSource
  return (
    <Button
      className="inline-button autosize oi-points-button"
      color={points && points.length ? 'success' : 'primary'}
      onClick={() => handleEditPoints(dataSourceId)}
    >
      {`Points ${points ? `(${points.length})` : '(0)'}`}
    </Button>
  )
}

PointsButton.propTypes = { dataSource: PropTypes.object.isRequired, history: PropTypes.object.isRequired }

export default withRouter(PointsButton)
