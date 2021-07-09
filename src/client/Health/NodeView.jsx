import React from 'react'
import PropTypes from 'prop-types'
import { Row, Container, Button, UncontrolledTooltip } from 'reactstrap'
import { Link } from 'react-router-dom'
import ReactFlow from 'react-flow-renderer'
import { ConfigContext } from '../context/configContext.jsx'
import PointsButton from '../South/PointsButton.jsx'
import Modal from '../components/Modal.jsx'

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
const height = 500
const width = 1240

const NodeView = ({ status, onRestart, onShutdown }) => {
  const { activeConfig } = React.useContext(ConfigContext)
  const applications = activeConfig?.north?.applications
  const dataSources = activeConfig?.south?.dataSources
  const engine = activeConfig?.engine

  const northNodes = applications?.map((application, index) => (
    {
      id: application.applicationId, // unique id of node
      type: 'output', // output node
      targetPosition: 'bottom', // handle is at the bottom
      style: {
        background: colors.background[application.enabled ? 'enabled' : 'disabled'],
        border: colors.border[application.enabled ? 'enabled' : 'disabled'],
        width: '140px',
      },
      data: {
        label: (
          <div id={`north-${index}`} className={`oi-box tight text-${application.enabled ? 'success' : 'muted'}`}>
            <Link to={`/north/${application.applicationId}`}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {application.applicationId}
              </div>
              <UncontrolledTooltip placement="top" target={`north-${index}`} innerClassName="oi-pop">
                {application.applicationId}
              </UncontrolledTooltip>
              <div>{`(${application.api})`}</div>
            </Link>
          </div>),
      },
      // position the node with an offset to center and then an offset for each node
      position: { x: 620 - 75 * applications.length + index * 150, y: 0 },
    }
  )) ?? []
  const northLinks = applications?.map((application) => (
    {
      id: `${application.applicationId}-engine`,
      source: 'engine',
      target: application.applicationId,
      animated: true,
      type: 'default',
      arrowHeadType: 'arrow',
      isHidden: !application.enabled,
    }
  )) ?? []

  const southNodes = dataSources?.map((dataSource, index) => (
    {
      id: dataSource.dataSourceId,
      type: 'input',
      sourcePosition: 'top',
      style: {
        background: colors.background[dataSource.enabled ? 'enabled' : 'disabled'],
        border: colors.border[dataSource.enabled ? 'enabled' : 'disabled'],
        width: '140px',
      },
      data: {
        label: (
          <div id={`south-${index}`} className={`oi-box tight text-${dataSource.enabled ? 'success' : 'muted'}`}>
            <Link to={`/south/${dataSource.dataSourceId}`}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {dataSource.dataSourceId}
              </div>
              <UncontrolledTooltip placement="top" target={`south-${index}`} innerClassName="oi-pop">
                {dataSource.dataSourceId}
              </UncontrolledTooltip>
              <div>{`(${dataSource.protocol})`}</div>
            </Link>
            <PointsButton dataSource={dataSource} />
          </div>
        ),
      },
      // postion the node with an offset to center and then an offset for each node
      // 6 per line max => potentially render on several lines with y
      position: { x: 620 - (75 * Math.min(dataSources.length, 8)) + (index % 8) * 150, y: 250 + 120 * Math.trunc(index / 8) },
    }
  )) ?? []

  const southLinks = dataSources?.map((dataSource) => (
    {
      id: `${dataSource.dataSourceId}-engine`,
      target: 'engine',
      source: dataSource.dataSourceId,
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
          <div className="oi-box">
            <Link to="/engine">
              <div className={`text-${engine?.safeMode ? 'warning oi-safe-mode' : 'success'} center`}>
                {`Engine ${status?.version}${engine?.safeMode ? ' - Safe mode warning' : ''}`}
              </div>
            </Link>
            <Modal show={false} title="Server restart" body="Confirm restart?">
              {(confirm) => (
                <Button
                  className="inline-button autosize oi-restart-button"
                  color={engine?.safeMode ? 'warning' : 'success'}
                  onClick={confirm(onRestart)}
                  size="sm"
                  outline
                >
                  Restart
                </Button>
              )}
            </Modal>
            <Modal show={false} title="Server shutdown" body="Confirm shutdown?">
              {(confirm) => (
                <Button
                  className="inline-button autosize oi-shutdown-button"
                  color={engine?.safeMode ? 'warning' : 'success'}
                  onClick={confirm(onShutdown)}
                  size="sm"
                  outline
                >
                  Shutdown
                </Button>
              )}
            </Modal>
          </div>
        ),
      },
      position: { x: 20, y: 125 },
      targetPosition: 'bottom',
      sourcePosition: 'top',
      style: {
        background: colors.background[engine?.safeMode ? 'warning' : 'success'],
        color: 'black',
        border: colors.border[engine?.safeMode ? 'warning' : 'success'],
        width: 1080,
      },
    },
    {
      id: 'alive',
      type: 'input',
      sourcePosition: 'left',
      data: {
        label: (
          <Link to="/engine">
            <div
              className={`oi-box d-flex align-items-center text-${engine?.aliveSignal?.enabled ? 'success' : 'muted'}`}
            >
              <div className="oi-alive d-flex align-items-center">
                Alive
              </div>
            </div>
          </Link>
        ),
      },
      position: { x: 1100, y: 125 },
      style: {
        background: colors.background[engine?.aliveSignal?.enabled ? 'enabled' : 'disabled'],
        border: colors.border[engine?.aliveSignal?.enabled ? 'enabled' : 'disabled'],
        width: 100,
      },
    },
    ...southNodes,
    ...southLinks,
  ]

  const onLoad = (reactFlowInstance) => {
    reactFlowInstance.setTransform({ y: 0, x: 0, zoom: 0.8 })
  }

  return (
    <Container>
      <Row>
        <div style={{ height, width }}>
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
