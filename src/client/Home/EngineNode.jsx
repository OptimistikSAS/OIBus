import React from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { Badge } from 'reactstrap'
import EngineMenu from './EngineMenu.jsx'
import utils from '../helpers/utils'

const EngineNode = ({ engineName, safeMode, onRestart, onShutdown }) => {
  const [oibusEngineData, setOibusEngineData] = React.useState({})

  const onEventSourceError = (error) => {
    console.error(error)
  }

  const onEventSourceMessage = (event) => {
    if (event && event.data) {
      const myData = JSON.parse(event.data)
      setOibusEngineData(myData)
    }
  }

  React.useEffect(() => {
    const source = utils.createEventSource('/engine/sse', onEventSourceMessage, onEventSourceError)
    return () => {
      source.close()
    }
  }, [])

  return (
    <div className="d-flex flex-column h-100 w-100">
      <div className="w-100 d-flex flex-row justify-content-between align-items-center p-1 oi-node-header">
        <div />
        <div className="oi-node-title">
          <span className="me-2">{`Engine ${engineName}`}</span>
          {safeMode ? <span><Badge color="warning" pill>safe mode</Badge></span> : null}
        </div>
        <div className="oi-node-click-item">
          <EngineMenu onRestart={onRestart} onShutdown={onShutdown} />
        </div>
      </div>
      <Link
        to="/engine"
        className="w-100 text-decoration-none text-muted flex-grow-1"
      >
        <div className="d-flex flex-column h-100 justify-content-between py-2 oi-node-click-item">
          {Object.entries(oibusEngineData)
            .filter(
              ([key]) => key === 'Up time'
                || key === 'OS free memory'
                || key === 'CPU usage',
            )
            .map(([key, value]) => (
              <div key={key}>
                <b className="me-1">
                  {key}
                  :
                </b>
                <span>{value}</span>
              </div>
            ))}
        </div>
      </Link>
    </div>
  )
}

EngineNode.propTypes = {
  onRestart: PropTypes.func.isRequired,
  onShutdown: PropTypes.func.isRequired,
  engineName: PropTypes.string.isRequired,
  safeMode: PropTypes.bool.isRequired,
}

export default EngineNode
