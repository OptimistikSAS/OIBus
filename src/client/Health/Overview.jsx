import React from 'react'
import { Row, Col, Container } from 'reactstrap'
import { Link } from 'react-router-dom'
import { ConfigContext } from '../context/configContext.jsx'
import PointsButton from '../South/PointsButton.jsx'

const Overview = () => {
  const { activeConfig } = React.useContext(ConfigContext)
  const applications = activeConfig?.north?.applications
  const dataSources = activeConfig?.south?.dataSources
  const engine = activeConfig?.engine
  return (
    <Container>
      <Row>
        {applications?.map((application) => (
          <Col key={application.applicationId} className={`tight text-${application.enabled ? 'success' : 'muted'}`}>
            <div className="oi-box d-flex align-items-center">
              <Link to={`/north/${application.applicationId}`}>
                <div>{application.applicationId}</div>
                <div>{`(${application.api})`}</div>
              </Link>
            </div>
          </Col>
        ))}
      </Row>
      <Row>
        <Col className="tight">
          <Link to="/engine">
            <div className="oi-box text-success d-flex align-items-center">Engine</div>
          </Link>
        </Col>
        <Col xs={1} className="tight">
          <Link to="/engine">
            <div className={`oi-box d-flex align-items-center text-${engine?.aliveSignal?.enabled ? 'success' : 'muted'}`}>Alive</div>
          </Link>
        </Col>
      </Row>
      <Row>
        {dataSources?.map((dataSource) => (
          <Col key={dataSource.dataSourceId} className={`tight text-${dataSource.enabled ? 'success' : 'muted'}`}>
            <div className="oi-box">
              <Link to={`/south/${dataSource.dataSourceId}`}>
                <div>{dataSource.dataSourceId}</div>
                <div>{`(${dataSource.protocol})`}</div>
              </Link>
              <PointsButton dataSource={dataSource} />
            </div>
          </Col>
        ))}
      </Row>
    </Container>
  )
}

export default Overview
