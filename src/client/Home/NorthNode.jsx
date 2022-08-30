import React from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { Tooltip } from 'reactstrap'
import NorthMenu from './NorthMenu.jsx'
import ApiSchemas from '../North/Apis.jsx'
import imageCategories from './imageCategories'
import OIbCheckBox from '../components/OIbForm/OIbCheckBox.jsx'

const NorthNode = ({ application, indexNorth, onChange }) => {
  const [tooltipOpenedId, setTooltipOpenedId] = React.useState()
  return (
    <div className="d-flex flex-column h-100 w-100">
      <div className="w-100 d-flex flex-row justify-content-between align-items-center p-1 oi-node-header">
        <img
          src={
            `${imageCategories[ApiSchemas[application.api].category].image}`
            ?? imageCategories.Default.image
          }
          alt="logo"
          height="25px"
        />
        <div
          className="oi-node-title"
          id={`north-connector-title-${application.id}`}
        >
          {`${application.name}`}
        </div>
        <Tooltip
          isOpen={application.id === tooltipOpenedId}
          placement="top"
          target={`north-connector-title-${application.id}`}
          toggle={() => {
            setTooltipOpenedId((oldValue) => (oldValue === application.id ? null : application.id))
          }}
        >
          {`${application.name}`}
        </Tooltip>
        <div className="oi-node-click-item">
          <NorthMenu application={application} />
        </div>
      </div>
      <Link
        to={`/north/${application.id}`}
        className="w-100 text-decoration-none text-muted flex-grow-1"
      >
        <div className="d-flex flex-column h-100 justify-content-center py-2 oi-node-click-item">
          <div>{application.api}</div>
        </div>
      </Link>
      <div className="oi-node-footer">
        <OIbCheckBox
          name={`north.applications.${indexNorth}.enabled`}
          defaultValue={false}
          value={application.enabled}
          onChange={onChange}
        />
      </div>
    </div>
  )
}

NorthNode.propTypes = {
  application: PropTypes.object.isRequired,
  indexNorth: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
}

export default NorthNode
