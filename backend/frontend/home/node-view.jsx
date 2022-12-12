import React from 'react'
import PropTypes from 'prop-types'
import { Button, Col, Container, Input, Label, Row, UncontrolledCollapse } from 'reactstrap'
import ReactFlow from 'react-flow-renderer'
import { FaFilter } from 'react-icons/fa'
import { ConfigContext } from '../context/config-context.jsx'
import EngineNode from './engine-node.jsx'
import SouthNode from './south-node.jsx'
import NorthNode from './north-node.jsx'

const NODE_BACKGROUND_COLOR = '#f7f8f9'
const NODE_BORDER = '1px solid #eaecef'

const NodeView = ({ onRestart, onShutdown }) => {
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  const [southFilter, setSouthFilter] = React.useState('')
  const [northFilter, setNorthFilter] = React.useState('')
  const onChange = (name, value, validity) => {
    dispatchNewConfig({
      type: 'update',
      name,
      value,
      validity,
    })
  }

  const resetFilters = () => {
    setNorthFilter('')
    setSouthFilter('')
  }

  const oibusName = newConfig?.engine?.name ?? ''
  const safeMode = newConfig?.engine?.safeMode ?? false
  const northConnectors = newConfig?.north?.filter((north) => north.name.toLowerCase().includes(northFilter.toLowerCase())) ?? []
  const southConnectors = newConfig?.south?.filter((south) => south.name.toLowerCase().includes(southFilter.toLowerCase())) ?? []
  const globalZIndex = southConnectors.length + northConnectors.length + 1
  const northNodes = northConnectors.map((north, indexNorth) => ({
    id: north.id,
    type: 'output',
    targetPosition: 'bottom',
    style: {
      background: NODE_BACKGROUND_COLOR,
      border: NODE_BORDER,
      width: 180,
      height: 130,
      padding: 0,
      borderRadius: 5,
      zIndex: globalZIndex - indexNorth,
    },
    data: { label: (<NorthNode north={north} northIndex={indexNorth} onChange={onChange} />) },
    // position the node with an offset to center and then an offset for each node
    position: {
      x: 620 - 100 * Math.min(northConnectors.length, 5) + (indexNorth % 5) * 200,
      y: 150 * Math.trunc(indexNorth / 5),
    },
  }))
  const northLinks = northConnectors.map((north) => ({
    id: `${north.id}-engine`,
    source: 'engine',
    target: north.id,
    animated: true,
    type: 'default',
    arrowHeadType: 'arrow',
    hidden: !north.enabled,
  }))
  const southNodes = southConnectors.map((south, indexSouth) => ({
    id: south.id,
    type: 'input',
    sourcePosition: 'top',
    style: {
      background: NODE_BACKGROUND_COLOR,
      border: NODE_BORDER,
      width: 180,
      height: 130,
      padding: 0,
      borderRadius: 5,
      zIndex: globalZIndex - northConnectors.length - indexSouth - 1,
    },
    data: { label: (<SouthNode south={south} onChange={onChange} southIndex={indexSouth} />) },
    // position the node with an offset to center and then an offset for each node
    // 5 per line max => potentially render on several lines with y
    position: {
      x: 620 - 100 * Math.min(southConnectors.length, 5) + (indexSouth % 5) * 200,
      y:
        190
        + 150 * Math.trunc(indexSouth / 5)
        + 150 * (Math.trunc((northConnectors.length - 1) / 5) + 1),
    },
  }))
  const southLinks = southConnectors.map((south) => ({
    id: `${south.id}-engine`,
    target: 'engine',
    source: south.id,
    animated: true,
    type: 'default',
    arrowHeadType: 'arrow',
    hidden: !south.enabled,
  }))

  const nodes = [
    ...northNodes,
    {
      id: 'engine',
      data: {
        label: (
          <EngineNode
            name={oibusName}
            safeMode={safeMode}
            onRestart={onRestart}
            onShutdown={onShutdown}
          />
        ),
      },
      position: {
        x: 100,
        y: 20 + 150 * (Math.trunc((northConnectors.length - 1) / 5) + 1),
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
        zIndex: globalZIndex - northConnectors.length,
      },
    },
    ...southNodes,
  ]
  const edges = [
    ...northLinks,
    ...southLinks,
  ]

  const id = 'filter-toggler-id'

  return (
    <Container>
      {(southConnectors.length > 5 || northConnectors.length > 5 || northFilter || southFilter)
      && (
      <>
        <Row>
          <h5>
            <Button color="link" id={id} className="util-button mt-1" onClick={resetFilters}>
              <FaFilter
                className="oi-filter"
                size={18}
              />
            </Button>
          </h5>
        </Row>
        <UncontrolledCollapse toggler={id}>
          <Row style={{ marginBottom: '15px' }}>
            {(southConnectors.length > 5 || southFilter !== '')
            && (
            <Col md={3}>
              <Label for="southFilter">Filter south by name:</Label>
              <Input
                name="southFilter"
                className="oi-form-input"
                type="text"
                id="southFilter"
                onChange={(event) => setSouthFilter(event.target.value)}
                value={southFilter}
              />
            </Col>
            )}
            {(northConnectors.length > 5 || northFilter !== '')
            && (
            <Col md={3}>
              <Label for="northFilter">Filter north by name:</Label>
              <Input
                name="northFilter"
                className="oi-form-input"
                type="text"
                id="northFilter"
                onChange={(event) => setNorthFilter(event.target.value)}
                value={northFilter}
              />
            </Col>
            )}
          </Row>
        </UncontrolledCollapse>
      </>
      )}
      <div
        style={{
          height:
            410
            + 150 * (Math.trunc((northNodes.length - 1) / 5) + 1)
            + 150 * (Math.trunc((southNodes.length - 1) / 5) + 1),
          width: '100%',
          paddingTop: '2rem',
        }}
      >
        <ReactFlow
          defaultNodes={nodes}
          defaultEdges={edges}
          zoomOnScroll={false}
          zoomOnDoubleClick={false}
          selectNodesOnDrag={false}
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
