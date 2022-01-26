import React from 'react'
import PropTypes from 'prop-types'
import { Container } from 'reactstrap'
import ReactFlow from 'react-flow-renderer'
import { ConfigContext } from '../context/ConfigContext.jsx'
import EngineNode from './EngineNode.jsx'
import SouthNode from './SouthNode.jsx'
import NorthNode from './NorthNode.jsx'

const NODE_BACKGROUND_COLOR = '#eaecef5c'
const NODE_BORDER = '1px solid #eaecef'

const NodeView = ({ onRestart, onShutdown }) => {
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  const onChange = (name, value, validity) => {
    dispatchNewConfig({
      type: 'update',
      name,
      value,
      validity,
    })
  }

  const engineName = newConfig?.engine?.engineName ?? ''
  const applications = newConfig?.north?.applications ?? []
  const dataSources = newConfig?.south?.dataSources ?? []

  const northNodes = applications.map((application, indexNorth) => ({
    id: application.id,
    type: 'output',
    targetPosition: 'bottom',
    style: {
      background: NODE_BACKGROUND_COLOR,
      border: NODE_BORDER,
      width: 180,
      height: 130,
      padding: 0,
      borderRadius: 5,
    },
    data: { label: (<NorthNode application={application} indexNorth={indexNorth} onChange={onChange} />) },
    // position the node with an offset to center and then an offset for each node
    position: {
      x: 620 - 100 * Math.min(applications.length, 5) + (indexNorth % 5) * 200,
      y: 150 * Math.trunc(indexNorth / 5),
    },
  }))
  const northLinks = applications.map((application) => ({
    id: `${application.id}-engine`,
    source: 'engine',
    target: application.id,
    animated: true,
    type: 'default',
    arrowHeadType: 'arrow',
    isHidden: !application.enabled,
  }))

  const southNodes = dataSources.map((dataSource, indexSouth) => ({
    id: dataSource.id,
    type: 'input',
    sourcePosition: 'top',
    style: {
      background: NODE_BACKGROUND_COLOR,
      border: NODE_BORDER,
      width: 180,
      height: 130,
      padding: 0,
      borderRadius: 5,
    },
    data: { label: (<SouthNode dataSource={dataSource} onChange={onChange} indexSouth={indexSouth} />) },
    // position the node with an offset to center and then an offset for each node
    // 5 per line max => potentially render on several lines with y
    position: {
      x: 620 - 100 * Math.min(dataSources.length, 5) + (indexSouth % 5) * 200,
      y:
        190
        + 150 * Math.trunc(indexSouth / 5)
        + 150 * (Math.trunc((applications.length - 1) / 5) + 1),
    },
  }))
  const southLinks = dataSources.map((dataSource) => ({
    id: `${dataSource.id}-engine`,
    target: 'engine',
    source: dataSource.id,
    animated: true,
    type: 'default',
    arrowHeadType: 'arrow',
    isHidden: !dataSource.enabled,
  }))

  const nodes = [
    ...northNodes,
    {
      id: 'engine',
      data: {
        label: (
          <EngineNode
            engineName={engineName}
            onRestart={onRestart}
            onShutdown={onShutdown}
          />
        ),
      },
      position: {
        x: 100,
        y: 20 + 150 * (Math.trunc((applications.length - 1) / 5) + 1),
      },
      targetPosition: 'bottom',
      sourcePosition: 'top',
      style: {
        background: NODE_BACKGROUND_COLOR,
        border: NODE_BORDER,
        width: 1020,
        height: 130,
        padding: 0,
        borderRadius: 5,
      },
    },
    ...southNodes,
  ]
  const edges = [
    ...northLinks,
    ...southLinks,
  ]
  return (
    <Container>
      <div
        style={{
          height:
            410
            + 150 * (Math.trunc((northNodes.length - 1) / 5) + 1)
            + 150 * (Math.trunc((southNodes.length - 1) / 5) + 1),
          width: '100%',
        }}
      >
        <ReactFlow
          fitViewOnInit
          defaultNodes={nodes}
          defaultEdges={edges}
          zoomOnScroll={false}
          zoomOnDoubleClick={false}
          selectNodesOnDrag={false}
          paneMoveable={false}
          preventScrolling={false}
          nodesConnectable={false}
          elementsSelectable
          nodesDraggable={false}
        />
      </div>
    </Container>
  )
}

NodeView.propTypes = {
  onRestart: PropTypes.func.isRequired,
  onShutdown: PropTypes.func.isRequired,
}

export default NodeView
