import React from 'react'
import PropTypes from 'prop-types'
import { Button, Col, Container, Input, Label, Row, UncontrolledCollapse } from 'reactstrap'
import ReactFlow from 'react-flow-renderer'
import { FaFilter } from 'react-icons/fa'
import { ConfigContext } from '../context/ConfigContext.jsx'
import EngineNode from './EngineNode.jsx'
import SouthNode from './SouthNode.jsx'
import NorthNode from './NorthNode.jsx'

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

  const engineName = newConfig?.engine?.engineName ?? ''
  const safeMode = newConfig?.engine?.safeMode ?? false
  const applications = newConfig?.north?.filter(
    (application) => application.name.toLowerCase().includes(northFilter.toLowerCase()),
  ) ?? []
  const dataSources = newConfig?.south?.filter((dataSource) => dataSource.name.toLowerCase().includes(southFilter.toLowerCase())) ?? []
  const globalZIndex = dataSources.length + applications.length + 1
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
      zIndex: globalZIndex - indexNorth,
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
    hidden: !application.enabled,
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
      zIndex: globalZIndex - applications.length - indexSouth - 1,
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
    hidden: !dataSource.enabled,
  }))

  const nodes = [
    ...northNodes,
    {
      id: 'engine',
      data: {
        label: (
          <EngineNode
            engineName={engineName}
            safeMode={safeMode}
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
        zIndex: globalZIndex - applications.length,
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
      {(dataSources.length > 5 || applications.length > 5 || northFilter || southFilter)
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
            {(dataSources.length > 5 || southFilter !== '')
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
            {(applications.length > 5 || northFilter !== '')
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
