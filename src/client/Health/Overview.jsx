import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col, Container, Button } from 'reactstrap'
import { Link } from 'react-router-dom'
import { ConfigContext } from '../context/configContext.jsx'
import PointsButton from '../South/PointsButton.jsx'
import Modal from '../components/Modal.jsx'

const Overview = ({ status, onRestart, onShutdown }) => {
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
          <div className="oi-box text-success">
            <Link to="/engine">
              <div className="text-success center">
                {`Engine ${status?.version}`}
              </div>
            </Link>
            <Modal show={false} title="Server restart" body="Confirm restart?">
              {(confirm) => (
                <Button
                  className="inline-button autosize oi-restart-button"
                  color="success"
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
                  color="success"
                  onClick={confirm(onShutdown)}
                  size="sm"
                  outline
                >
                  Shutdown
                </Button>
              )}
            </Modal>
          </div>
        </Col>
        <Col xs={1} className="tight">
          <Link to="/engine">
            <div
              className={`oi-box d-flex align-items-center text-${engine?.aliveSignal?.enabled ? 'success' : 'muted'}`}
            >
              <div className="oi-alive d-flex align-items-center">
                Alive
              </div>
            </div>
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

Overview.propTypes = {
  status: PropTypes.object,
  onRestart: PropTypes.func,
  onShutdown: PropTypes.func,
}
Overview.defaultProps = {
  status: {},
  onRestart: () => null,
  onShutdown: () => null,
}

export default Overview
