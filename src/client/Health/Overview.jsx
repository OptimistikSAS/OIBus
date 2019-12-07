import React from 'react'
import { Row, Col, Container } from 'reactstrap'
import { Link } from 'react-router-dom'
import { ConfigContext } from '../context/configContext.jsx'

const Overview = () => {
  const { newConfig } = React.useContext(ConfigContext)
  const applications = newConfig && newConfig.north && newConfig.north.applications
  const dataSources = newConfig && newConfig.south && newConfig.south.dataSources
  return (
    <Container style={{ marginBottom: '5px' }}>
      <Row>
        {applications && applications.map((application) => (
          <Col key={application.applicationId} className={`tight text-${application.enabled ? 'success' : 'muted'}`}>
            <div className="oi-box">
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
            <div className="oi-box text-success">Engine</div>
          </Link>
        </Col>
      </Row>
      <Row>
        {dataSources && dataSources.map((dataSource) => (
          <Col key={dataSource.dataSourceId} className={`tight text-${dataSource.enabled ? 'success' : 'muted'}`}>
            <div className="oi-box">
              <Link to={`/south/${dataSource.dataSourceId}`}>
                <div>{dataSource.dataSourceId}</div>
                <div>{`(${dataSource.protocol})`}</div>
              </Link>
            </div>
          </Col>
        ))}
      </Row>
    </Container>
  )
}

export default Overview
