import React from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { Tooltip } from 'reactstrap'
import NorthMenu from './NorthMenu.jsx'
import NorthSchemas from '../North/NorthTypes.jsx'
import imageCategories from './imageCategories'
import OIbCheckBox from '../components/OIbForm/OIbCheckBox.jsx'

const NorthNode = ({ north, northIndex, onChange }) => {
  const [tooltipOpenedId, setTooltipOpenedId] = React.useState()
  return (
    <div className="d-flex flex-column h-100 w-100">
      <div className="w-100 d-flex flex-row justify-content-between align-items-center p-1 oi-node-header">
        <img
          src={
            `${imageCategories[NorthSchemas[north.type].category].image}`
            ?? imageCategories.Default.image
          }
          alt="logo"
          height="25px"
        />
        <div
          className="oi-node-title"
          id={`north-connector-title-${north.id}`}
        >
          {`${north.name}`}
        </div>
        <Tooltip
          isOpen={north.id === tooltipOpenedId}
          placement="top"
          target={`north-connector-title-${north.id}`}
          toggle={() => {
            setTooltipOpenedId((oldValue) => (oldValue === north.id ? null : north.id))
          }}
        >
          {`${north.name}`}
        </Tooltip>
        <div className="oi-node-click-item">
          <NorthMenu north={north} />
        </div>
      </div>
      <Link
        to={`/north/${north.id}`}
        className="w-100 text-decoration-none text-muted flex-grow-1"
      >
        <div className="d-flex flex-column h-100 justify-content-center py-2 oi-node-click-item">
          <div>{north.type}</div>
        </div>
      </Link>
      <div className="oi-node-footer">
        <OIbCheckBox
          name={`north.${northIndex}.enabled`}
          defaultValue={false}
          value={north.enabled}
          onChange={onChange}
        />
      </div>
    </div>
  )
}

NorthNode.propTypes = {
  north: PropTypes.object.isRequired,
  northIndex: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
}

export default NorthNode
