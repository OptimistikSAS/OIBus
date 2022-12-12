import React from 'react'
import { Spinner } from 'reactstrap'

import PropTypes from 'prop-types'
import { ConfigContext } from '../../context/config-context.jsx'
import PointsComponent from '../../components/points-component.jsx'
import SouthSchemas from '../../south/south-types.jsx'

const PointsSection = ({ query, handleChange }) => {
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
      points={pointsOrdered}
      onChange={handleChange}
      prefix={`south.${southIndex}.points`}
      schema={SouthSchemas[south.type]}
    />
  )
}

PointsSection.propTypes = {
  query: PropTypes.object.isRequired,
  handleChange: PropTypes.func.isRequired,
}

export default PointsSection
