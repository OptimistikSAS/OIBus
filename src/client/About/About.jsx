import React from 'react'
import { Container, ListGroup, ListGroupItem } from 'reactstrap'
import apis from '../services/apis'
import utils from '../helpers/utils'
import { AlertContext } from '../context/AlertContext.jsx'
import logo from '../OIBus.png'

/**
 * Display information about OIBus and live metrics about Engine, process,...
 * @constructor
 */
export default () => {
  const [oibusInfo, setOibusInfo] = React.useState({})
  const [oibusStatus, setOibusStatus] = React.useState({})
  const { setAlert } = React.useContext(AlertContext)

  const onEventSourceError = (error) => {
    console.error(error)
  }

  const onEventSourceMessage = (event) => {
    if (event && event.data) {
      const myData = JSON.parse(event.data)
      setOibusStatus(myData)
    }
  }

  /**
   * Fetch static status after render
   * @returns {void}
   */
  React.useEffect(() => {
    apis.getOIBusInfo()
      .then((response) => {
        setOibusInfo(response)
      })
      .catch((error) => {
        console.error(error)
        setAlert({
          text: error.message,
          type: 'danger',
        })
      })
  }, [])

  /**
   * Fetch live status after render
   * @returns {void}
   */
  React.useEffect(() => {
    const source = utils.createEventSource('/engine/sse', onEventSourceMessage, onEventSourceError)
    return () => {
      source.close()
    }
  }, [])

  return (
    <div className="p-3">
      <Container fluid>
        {oibusInfo && (
          <ListGroup>
            <ListGroupItem tag="a" href="https://optimistik.io/oibus">
              <img src={logo} alt="logo" height="100px" />
            </ListGroupItem>
            <ListGroupItem>
              <b className="me-1">Version:</b>
              {oibusInfo.version}
            </ListGroupItem>
            <ListGroupItem>
              <b className="me-1">Current directory:</b>
              {oibusInfo.currentDirectory}
            </ListGroupItem>
            <ListGroupItem>
              <b className="me-1">Executable:</b>
              {oibusInfo.executable}
            </ListGroupItem>
            <ListGroupItem>
              <b className="me-1">Process ID:</b>
              {oibusInfo.processId}
            </ListGroupItem>
            <ListGroupItem>
              <b className="me-1">Node version:</b>
              {oibusInfo.nodeVersion}
            </ListGroupItem>
            <ListGroupItem>
              <b className="me-1">Hostname:</b>
              {oibusInfo.hostname}
            </ListGroupItem>
            <ListGroupItem>
              <b className="me-1">Operating System:</b>
              {oibusInfo.osType}
              {' '}
              {oibusInfo.osRelease}
            </ListGroupItem>
            <ListGroupItem>
              <b className="me-1">Architecture:</b>
              {oibusInfo.architecture}
            </ListGroupItem>
            <ListGroupItem tag="a" href="https://optimistik.io/oibus">
              Official site
            </ListGroupItem>
            <ListGroupItem>
              <b className="me-1">Copyright:</b>
              {oibusInfo.copyright}
            </ListGroupItem>
            <ListGroupItem tag="a" href="https://joinup.ec.europa.eu/sites/default/files/custom-page/attachment/2020-03/EUPL-1.2%20EN.txt">
              Licensed under the EUPL-1.2-or-later
            </ListGroupItem>
            {Object.entries(oibusStatus)
              .map(([key, value]) => (
                <ListGroupItem key={key}>
                  <div key={key}>
                    <b className="me-1">
                      {key}
                      :
                    </b>
                    <span>{value}</span>
                  </div>
                </ListGroupItem>
              ))}
          </ListGroup>
        )}
      </Container>
    </div>
  )
}
