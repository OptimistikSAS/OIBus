import React from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { Tooltip } from 'reactstrap'
import SouthMenu from './SouthMenu.jsx'
import imageCategories from './imageCategories'
import OIbCheckBox from '../components/OIbForm/OIbCheckBox.jsx'
import SouthSchemas from '../South/SouthTypes.jsx'

const SouthNode = ({ south, southIndex, onChange }) => {
  const [tooltipOpenedId, setTooltipOpenedId] = React.useState()
  return (
    <div className="d-flex flex-column h-100 w-100">
      <div className="w-100 d-flex flex-row justify-content-between align-items-center p-1 oi-node-header">
        <img
          src={
            `${
              imageCategories[SouthSchemas[south.type].category]
                .image
            }` ?? imageCategories.Default.image
          }
          alt="logo"
          height="25px"
        />
        <div
          className="oi-node-title"
          id={`south-connector-title-${south.id}`}
        >
          {`${south.name}`}
        </div>
        <Tooltip
          isOpen={south.id === tooltipOpenedId}
          placement="top"
          target={`south-connector-title-${south.id}`}
          toggle={() => {
            setTooltipOpenedId((oldValue) => (oldValue === south.id ? null : south.id))
          }}
        >
          {`${south.name}`}
        </Tooltip>
        <div className="oi-node-click-item">
          <SouthMenu south={south} />
        </div>
      </div>
      <Link
        to={`/south/${south.id}`}
        className="w-100 text-decoration-none text-muted flex-grow-1"
      >
        <div className="d-flex flex-column h-100 justify-content-center py-2 oi-node-click-item">
          <div>{south.type}</div>
          {south.points?.length > 0 ? (
            <div>{`Points (${south.points.length})`}</div>
          ) : null}
        </div>
      </Link>
      <div className="oi-node-footer">
        <OIbCheckBox
          name={`south.${southIndex}.enabled`}
          defaultValue={false}
          value={south.enabled}
          onChange={onChange}
        />
      </div>
    </div>
  )
}

SouthNode.propTypes = {
  south: PropTypes.object.isRequired,
  southIndex: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
}

export default SouthNode
