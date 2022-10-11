import React from 'react'
import { Spinner } from 'reactstrap'

import PropTypes from 'prop-types'
import { ConfigContext } from '../../context/ConfigContext.jsx'
import PointsComponent from '../../components/PointsComponent.jsx'

const PointsSection = ({
  query, handleAddPoint, handleChange, handleDeletePoint,
  handleDeleteAllPoint,
  handleImportPoints,
}) => {
  const { newConfig } = React.useContext(ConfigContext)

  if (!newConfig?.south) {
    return (
      <div className="spinner-container">
        <Spinner color="primary" type="grow" />
        ...loading points from OIBus server...
      </div>
    )
  }
  const southIndex = newConfig.south.findIndex(
    (south) => south.id === query.southId,
  )
  const south = newConfig.south[southIndex]

  const { points: pointsOrdered = [] } = query.settings

  return (
    <PointsComponent
      southId={query.southId}
      southType={south.type}
      points={pointsOrdered}
      handleAdd={handleAddPoint}
      handleDelete={handleDeletePoint}
      handleDeleteAllPoint={handleDeleteAllPoint}
      handleImportPoints={handleImportPoints}
      onUpdate={handleChange}
    />
  )
}

PointsSection.propTypes = {
  query: PropTypes.object.isRequired,
  handleAddPoint: PropTypes.func.isRequired,
  handleChange: PropTypes.func.isRequired,
  handleDeletePoint: PropTypes.func.isRequired,
  handleDeleteAllPoint: PropTypes.func.isRequired,
  handleImportPoints: PropTypes.func.isRequired,
}

export default PointsSection
