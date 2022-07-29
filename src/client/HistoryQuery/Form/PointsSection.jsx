import React from 'react'
import { Spinner } from 'reactstrap'

import PropTypes from 'prop-types'
import { ConfigContext } from '../../context/ConfigContext.jsx'
import { SchemaContext } from '../../context/SchemaContext.jsx'
import PointsComponent from '../../components/PointsComponent.jsx'

const PointsSection = ({
  query, handleAddPoint, handleChange, handleDeletePoint,
  handleDeleteAllPoint,
  handleImportPoints,
}) => {
  const { newConfig } = React.useContext(ConfigContext)
  const { southSchemas } = React.useContext(SchemaContext)

  if (!newConfig?.south) {
    return (
      <div className="spinner-container">
        <Spinner color="primary" type="grow" />
        ...loading points from OIBus server...
      </div>
    )
  }
  const dataSourceIndex = newConfig.south.dataSources.findIndex(
    (dataSource) => dataSource.id === query.southId,
  )
  const dataSource = newConfig.south.dataSources[dataSourceIndex]

  const { protocol } = dataSource
  const { points: pointsOrdered = [] } = query.settings

  return (
    <PointsComponent
      southId={query.southId}
      points={pointsOrdered}
      handleAdd={handleAddPoint}
      handleDelete={handleDeletePoint}
      handleDeleteAllPoint={handleDeleteAllPoint}
      handleImportPoints={handleImportPoints}
      onUpdate={handleChange}
      pointsSchema={southSchemas[protocol].points}
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
