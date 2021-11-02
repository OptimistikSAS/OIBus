import React from 'react'
import PropTypes from 'prop-types'
import { Container } from 'reactstrap'
import ReactFlow from 'react-flow-renderer'
import { Link } from 'react-router-dom'
import { ConfigContext } from '../context/configContext.jsx'
import PointsButton from '../South/PointsButton.jsx'
import ApiSchemas from '../North/Apis.jsx'
import ProtocolSchemas from '../South/Protocols.jsx'
import OIbCheckBox from '../components/OIbForm/OIbCheckBox.jsx'
import NorthMenu from './NorthMenu.jsx'
import SouthMenu from './SouthMenu.jsx'
import EngineMenu from './EngineMenu.jsx'
import imageCategories from './imageCategories'

const colors = {
  border: {
    enabled: '1px solid #2ea948',
    disabled: '1px solid #eaecef',
    warning: '1px solid #ffc107',
    success: '1px solid #2ea948',
  },
  background: {
    enabled: '#e1ffe15c',
    disabled: '#eaecef5c',
    warning: '#eaecef5c',
    success: '#e1ffe15c',
  },
}

const NodeView = ({ status, onRestart, onShutdown }) => {
  const { newConfig, dispatchNewConfig, activeConfig } = React.useContext(ConfigContext)
  const applications = newConfig?.north?.applications ?? []
  const dataSources = newConfig?.south?.dataSources ?? []
  const engineName = activeConfig ? activeConfig.engine.engineName : ''
  const onLoad = (reactFlowInstance) => {
    reactFlowInstance.setTransform({ y: 35, x: 0, zoom: 0.9 })
  }
  const onChange = (name, value, validity) => {
    dispatchNewConfig({ type: 'update', name, value, validity })
  }

  const northNodes = applications.map((application, indexNorth) => (
    {
      id: application.id,
      type: 'output',
      targetPosition: 'bottom',
      style: {
        background: colors.background.disabled,
        border: colors.border.disabled,
        width: 180,
        height: 130,
        borderRadius: 5,
      },
      data: {
        label: (
          <div className="d-flex flex-column">
            <div className="d-flex flex-row justify-content-between align-items-center p-1 oi-node-header">
              <img
                src={`${imageCategories[ApiSchemas[application.api].category].image}` ?? imageCategories.Default.image}
                alt="logo"
                height="25px"
              />
              <div className="oi-node-title">
                {`${application.name}`}
              </div>
              <div>
                <NorthMenu application={application} />
              </div>
            </div>
            <div
              className="p-1 text-muted text-center justify-content-center"
            >
              <Link
                to={`/north/${application.id}`}
                className="text-decoration-none text-muted"
              >
                {application.api}
              </Link>
            </div>
            <div className="oi-node-footer">
              <OIbCheckBox
                name={`${`north.applications.${applications.findIndex(
                  (element) => element.id === application.id,
                )}`
                }.enabled`}
                defaultValue={false}
                value={application.enabled}
                onChange={onChange}
                switchButton
              />
            </div>
          </div>),
      },

      // position the node with an offset to center and then an offset for each node
      position: {
        x: 620 - (100 * Math.min(applications.length, 5)) + (indexNorth % 5) * 200,
        y: 150 * Math.trunc(indexNorth / 5),
      },
    }
  ))
  const northLinks = applications.map((application) => (
    {
      id: `${application.id}-engine`,
      source: 'engine',
      target: application.id,
      animated: true,
      type: 'default',
      arrowHeadType: 'arrow',
      isHidden: !application.enabled,
    }
  ))

  const southNodes = dataSources.map((dataSource, indexSouth) => (
    {
      id: dataSource.id,
      type: 'input',
      sourcePosition: 'top',
      style: {
        background: colors.background.disabled,
        border: colors.border.disabled,
        width: 180,
        height: 130,
        borderRadius: 5,
      },
      data: {
        label: (
          <div className="d-flex flex-column">
            <div className="d-flex flex-row justify-content-between align-items-center p-1 oi-node-header">
              <img
                src={`${imageCategories[ProtocolSchemas[dataSource.protocol].category].image}` ?? imageCategories.Default.image}
                alt="logo"
                height="25px"
              />
              <div className="oi-node-title">
                {`${dataSource.name}`}
              </div>
              <div>
                <SouthMenu dataSource={dataSource} />
              </div>
            </div>
            <div className="p-1 text-muted text-center justify-content-center">
              <div>
                <Link
                  to={`/south/${dataSource.id}`}
                  className="text-decoration-none text-muted"
                >
                  {dataSource.protocol}
                </Link>
              </div>
              <PointsButton dataSource={dataSource} />
            </div>
            <div className="oi-node-footer">
              <OIbCheckBox
                name={`${`south.dataSources.${dataSources.findIndex(
                  (element) => element.id === dataSource.id,
                )}`
                }.enabled`}
                defaultValue={false}
                value={dataSource.enabled}
                onChange={onChange}
                switchButton
              />
            </div>
          </div>
        ),
      },
      // postion the node with an offset to center and then an offset for each node
      // 5 per line max => potentially render on several lines with y
      position: {
        x: 620 - (100 * Math.min(dataSources.length, 5)) + (indexSouth % 5) * 200,
        y: 190 + 150 * Math.trunc(indexSouth / 5) + 150 * (Math.trunc((applications.length - 1) / 5) + 1),
      },
    }
  ))
  const southLinks = dataSources.map((dataSource) => (
    {
      id: `${dataSource.id}-engine`,
      target: 'engine',
      source: dataSource.id,
      animated: true,
      type: 'default',
      arrowHeadType: 'arrow',
      isHidden: !dataSource.enabled,
    }
  ))

  const elements = [
    ...northNodes,
    ...northLinks,
    {
      id: 'engine',
      data: {
        label: (
          <div className="d-flex flex-column">
            <div className="d-flex flex-row justify-content-between align-items-center p-1 oi-node-header">
              <div />
              <div className="oi-node-title">
                {`Engine ${engineName}`}
              </div>
              <div>
                <EngineMenu onRestart={onRestart} onShutdown={onShutdown} />
              </div>
            </div>

            <Link
              to="/engine"
              className="text-decoration-none text-muted"
            >
              <div>
                <b>Uptime: </b>
                {status.uptime}
              </div>
              <div>
                <b>Hostname: </b>
                {status.hostname}
              </div>
              <div>
                <b>CurrentDirectory: </b>
                {status.currentDirectory}
              </div>
              <div>
                <b>ConfigurationFile: </b>
                {status.configurationFile}
              </div>
            </Link>
          </div>
        ),
      },
      position: {
        x: 100,
        y: 20 + 150 * (Math.trunc((applications.length - 1) / 5) + 1),
      },
      targetPosition: 'bottom',
      sourcePosition: 'top',
      style: {
        background: colors.background.warning,
        color: 'black',
        border: colors.border.disabled,
        width: 1020,
        height: 130,
        borderRadius: 5,
      },
    },
    ...southNodes,
    ...southLinks,
  ]

  return (
    <Container>
      <div style={{
        height: 410 + 150 * (Math.trunc((applications.length - 1) / 5) + 1) + 150 * (Math.trunc((dataSources.length - 1) / 5) + 1),
        width: '100%',
      }}
      >
        <ReactFlow
          elements={elements}
          zoomOnScroll={false}
          nodesConnectable={false}
          elementsSelectable
          nodesDraggable={false}
          onLoad={onLoad}
        />
      </div>
    </Container>
  )
}

NodeView.propTypes = {
  status: PropTypes.object.isRequired,
  onRestart: PropTypes.func.isRequired,
  onShutdown: PropTypes.func.isRequired,
}

export default NodeView
