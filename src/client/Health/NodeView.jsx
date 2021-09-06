import React, { useState } from 'react'
import PropTypes from 'prop-types'
import { Container, Row } from 'reactstrap'
import ReactFlow from 'react-flow-renderer'
import { ConfigContext } from '../context/configContext.jsx'
import PointsButton from '../South/PointsButton.jsx'
import ApiSchemas from '../North/Apis.jsx'
import ProtocolSchemas from '../South/Protocols.jsx'
import validationNorth from '../North/Form/North.validation'
import validationSouth from '../South/Form/South.validation'
import EditableIdField from '../components/EditableIdField.jsx'
import NorthSettings from './NorthSettings.jsx'
import SouthSettings from './SouthSettings.jsx'
import EngineSettings from './EngineSettings.jsx'
import NewNorth from './NewNorth.jsx'
import NewSouth from './NewSouth.jsx'

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
  const { newConfig, dispatchNewConfig, apiList, protocolList } = React.useContext(ConfigContext)
  const [renamingConnector, setRenamingConnector] = useState(null)
  const applications = newConfig?.north?.applications ?? []
  const dataSources = newConfig?.south?.dataSources ?? []
  const engine = newConfig?.engine

  const handleConnectorNameChanged = (name) => (oldDataSourceId, newDataSourceId) => {
    setRenamingConnector(null)
    dispatchNewConfig({
      type: 'update',
      name,
      value: newDataSourceId,
    })
  }

  const northNodes = applications?.map((application, indexNorth) => (
    {
      id: application.id, // unique id of node
      type: 'output', // output node
      targetPosition: 'bottom', // handle is at the bottom
      style: {
        background: colors.background.disabled,
        border: colors.border.disabled,
        width: 170,
        height: 130,
      },
      data: {
        label: (
          <div className="box-container">
            <div className="icon-container">
              <div className="icon-left">
                <img src={`${ApiSchemas[application.api].image}`} alt="logo" height="24px" />
              </div>
              <div className="icon-center flex-grow">
                {`${application.api}`}
              </div>
              <div className={`icon-right icon-status-${application.enabled ? 'enabled' : 'disabled'}`} />
            </div>

            <div
              className="oi-box tight text-muted"
            >
              <EditableIdField
                connectorName={application.name}
                editing={renamingConnector === `north-${application.id}`}
                fromList={applications}
                valid={validationNorth.application.isValidName}
                nameChanged={handleConnectorNameChanged(
                  `north.applications.${applications.findIndex(
                    (element) => element.id === application.id,
                  )}.name`,
                )}
              />
            </div>
            <NorthSettings application={application} renamingConnector={setRenamingConnector} />
          </div>),
      },

      // position the node with an offset to center and then an offset for each node
      position: {
        x: 620 - (100 * Math.min(applications.length, 5)) + (indexNorth % 5) * 200,
        y: 150 * Math.trunc(indexNorth / 5),
      },
    }

  )) ?? []
  const northLinks = applications?.map((application) => (
    {
      id: `${application.id}-engine`,
      source: 'engine',
      target: application.id,
      animated: true,
      type: 'default',
      arrowHeadType: 'arrow',
      isHidden: !application.enabled,
    }
  )) ?? []

  const southNodes = dataSources?.map((dataSource, indexSouth) => (
    {
      id: dataSource.id,
      type: 'input',
      sourcePosition: 'top',
      style: {
        background: colors.background.disabled,
        border: colors.border.disabled,
        width: '170px',
        height: '130px',
      },
      data: {
        label: (
          <div className="box-container">
            <div className="icon-container">
              <div className="icon-left">
                <img src={`${ProtocolSchemas[dataSource.protocol].image}`} alt="logo" height="24px" />
              </div>
              <div className="icon-center flex-grow">
                {`${dataSource.protocol}`}
              </div>
              <div className={`icon-right icon-status-${dataSource.enabled ? 'enabled' : 'disabled'}`} />
            </div>

            <div className="oi-box tight text-muted">
              <EditableIdField
                connectorName={dataSource.name}
                editing={renamingConnector === `south-${dataSource.id}`}
                fromList={dataSources}
                valid={validationSouth.protocol.isValidName}
                nameChanged={handleConnectorNameChanged(
                  `south.dataSources.${dataSources.findIndex(
                    (element) => element.id === dataSource.id,
                  )}.name`,
                )}
              />
            </div>
            <div className="oi-points tight text-muted">
              <PointsButton dataSource={dataSource} />
            </div>
            <SouthSettings dataSource={dataSource} renamingConnector={setRenamingConnector} />
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
  )) ?? []

  const southLinks = dataSources?.map((dataSource) => (
    {
      id: `${dataSource.id}-engine`,
      target: 'engine',
      source: dataSource.id,
      animated: true,
      type: 'default',
      arrowHeadType: 'arrow',
      isHidden: !dataSource.enabled,
    }
  )) ?? []

  const elements = [
    ...northNodes,
    ...northLinks,
    {
      id: 'engine',
      data: {
        label: (
          <div className="box-container">
            <div className="icon-container">
              <div className="icon-center icon-left">
                {`Engine ${status?.version}`}
              </div>
              <div className={`icon-right icon-status-${engine?.safeMode ? 'disabled' : 'enabled'}`} />
            </div>
            <EngineSettings onRestart={onRestart} onShutdown={onShutdown} />
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
      },
    },
    {
      id: 'newSouth',
      type: 'input',
      sourcePosition: 'right',
      data: {
        label: (
          protocolList && (
          <>
            <NewSouth />
          </>
          )
        ),
      },
      position: {
        x: 1122,
        y: 125 + 150 * (Math.trunc((applications.length - 1) / 5) + 1),
      },
      style: {
        background: colors.background[engine?.aliveSignal?.enabled ? 'enabled' : 'disabled'],
        border: colors.border[engine?.aliveSignal?.enabled ? 'enabled' : 'disabled'],
        width: 63,
        height: 25,
      },
    },
    {
      id: 'newNorth',
      type: 'input',
      sourcePosition: 'left',
      data: {
        label: (
          apiList && (
          <>
            <NewNorth />
          </>
          )
        ),
      },
      position: {
        x: 38,
        y: 20 + 150 * (Math.trunc((applications.length - 1) / 5) + 1),
      },
      style: {
        background: colors.background[engine?.aliveSignal?.enabled ? 'enabled' : 'disabled'],
        border: colors.border[engine?.aliveSignal?.enabled ? 'enabled' : 'disabled'],
        width: 62,
        height: 25,
      },
    },
    ...southNodes,
    ...southLinks,
  ]

  const onLoad = (reactFlowInstance) => {
    reactFlowInstance.setTransform({ y: 35, x: 0, zoom: 0.9 })
  }

  return (
    <Container>
      <Row>
        <div style={{
          height: 210 + 150 * (Math.trunc((applications.length - 1) / 5) + 1) + 150 * (Math.trunc((dataSources.length - 1) / 5) + 1),
          width: 1240,
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
      </Row>
    </Container>
  )
}

NodeView.propTypes = {
  status: PropTypes.object,
  onRestart: PropTypes.func,
  onShutdown: PropTypes.func,
}
NodeView.defaultProps = {
  status: {},
  onRestart: () => null,
  onShutdown: () => null,
}

export default NodeView
