import React from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { AlertContext } from '../context/AlertContext.jsx'
import EngineMenu from './EngineMenu.jsx'

const EngineNode = ({ engineName, onRestart, onShutdown }) => {
  const [connectorData, setConnectorData] = React.useState({})

  const { setAlert } = React.useContext(AlertContext)

  React.useEffect(() => {
    const source = new EventSource('/engine/sse')
    source.onerror = error => {
      setAlert({
        text: error.message,
        type: 'danger'
      })
    }
    source.onmessage = event => {
      if (event && event.data) {
        const myData = JSON.parse(event.data)
        setConnectorData(myData)
      }
    }

    return () => {
      source?.close()
    }
  }, [])
  return (
    <div className='d-flex flex-column h-100 w-100'>
      <div className='w-100 d-flex flex-row justify-content-between align-items-center p-1 oi-node-header'>
        <div />
        <div className='oi-node-title'>{`Engine ${engineName}`}</div>
        <div className='oi-node-click-item'>
          <EngineMenu onRestart={onRestart} onShutdown={onShutdown} />
        </div>
      </div>
      <Link
        to='/engine'
        className='w-100 text-decoration-none text-muted flex-grow-1'
      >
        <div className='d-flex flex-column h-100 justify-content-between py-2 oi-node-click-item'>
          {Object.entries(connectorData)
            .filter(
              ([key]) =>
                key === 'Up time' ||
                key === 'Global memory usage' ||
                key === 'CPU usage'
            )
            .map(([key, value]) => (
              <div key={key}>
                <b className='mr-2'>{key}:</b>
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
  engineName: PropTypes.string.isRequired
}

export default EngineNode
