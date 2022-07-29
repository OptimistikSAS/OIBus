import React from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { Tooltip } from 'reactstrap'
import SouthMenu from './SouthMenu.jsx'
import imageCategories from './imageCategories'
import OIbCheckBox from '../components/OIbForm/OIbCheckBox.jsx'
import { SchemaContext } from '../context/SchemaContext.jsx'

const SouthNode = ({ dataSource, indexSouth, onChange }) => {
  const { southSchemas } = React.useContext(SchemaContext)
  const [tooltipOpenedId, setTooltipOpenedId] = React.useState()
  console.log(southSchemas)
  if (!southSchemas[dataSource.protocol]) return <p>loading</p>
  return (
    <div className="d-flex flex-column h-100 w-100">
      <div className="w-100 d-flex flex-row justify-content-between align-items-center p-1 oi-node-header">
        <img
          src={
            `${
              imageCategories[southSchemas[dataSource.protocol].category]
                .image
            }` ?? imageCategories.Default.image
          }
          alt="logo"
          height="25px"
        />
        <div
          className="oi-node-title"
          id={`south-connector-title-${dataSource.id}`}
        >
          {`${dataSource.name}`}
        </div>
        <Tooltip
          isOpen={dataSource.id === tooltipOpenedId}
          placement="top"
          target={`south-connector-title-${dataSource.id}`}
          toggle={() => {
            setTooltipOpenedId((oldValue) => (oldValue === dataSource.id ? null : dataSource.id))
          }}
        >
          {`${dataSource.name}`}
        </Tooltip>
        <div className="oi-node-click-item">
          <SouthMenu dataSource={dataSource} />
        </div>
      </div>
      <Link
        to={`/south/${dataSource.id}`}
        className="w-100 text-decoration-none text-muted flex-grow-1"
      >
        <div className="d-flex flex-column h-100 justify-content-center py-2 oi-node-click-item">
          <div>{dataSource.protocol}</div>
          {dataSource.points?.length > 0 ? (
            <div>{`Points (${dataSource.points.length})`}</div>
          ) : null}
        </div>
      </Link>
      <div className="oi-node-footer">
        <OIbCheckBox
          name={`south.dataSources.${indexSouth}.enabled`}
          defaultValue={false}
          value={dataSource.enabled}
          onChange={onChange}
          switchButton
        />
      </div>
    </div>
  )
}

SouthNode.propTypes = {
  dataSource: PropTypes.object.isRequired,
  indexSouth: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
}

export default SouthNode
