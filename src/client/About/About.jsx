import React from 'react'
import { Container, ListGroup, ListGroupItem } from 'reactstrap'
import apis from '../services/apis.js'
import { AlertContext } from '../context/AlertContext.jsx'
import { ConfigContext } from '../context/ConfigContext.jsx'
import logo from '../OIBus.png'

const About = () => {
  const [oibusInfo, setOibusInfo] = React.useState({})
  const [oibusStatus, setOibusStatus] = React.useState({})
  const { setAlert } = React.useContext(AlertContext)
  const { activeConfig } = React.useContext(ConfigContext)

  /**
   * Retrieve OIBus info
   * @returns {void}
   */
  const fetchOIBusInfo = () => {
    apis
      .getOIBusInfo()
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
  }

  /**
   * Fetch static status after render
   * @returns {void}
   */
  React.useEffect(() => {
    fetchOIBusInfo()
  }, [])

  /**
   * Fetch live status after render
   * @returns {void}
   */
  React.useEffect(() => {
    const source = new EventSource('/engine/sse')
    source.onerror = (error) => {
      setAlert({
        text: error.message,
        type: 'danger',
      })
    }
    source.onmessage = (event) => {
      if (event && event.data) {
        const myData = JSON.parse(event.data)
        setOibusStatus(myData)
      }
    }
    return () => {
      source.close()
    }
  }, [activeConfig])

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
              <b className="me-1">Architecture:</b>
              {oibusInfo.architecture}
            </ListGroupItem>
            <ListGroupItem>
              <b className="me-1">Configuration directory:</b>
              {oibusInfo.configurationDirectory}
            </ListGroupItem>
            <ListGroupItem>
              <b className="me-1">Node version:</b>
              {oibusInfo.nodeVersion}
            </ListGroupItem>
            <ListGroupItem>
              <b className="me-1">Executable:</b>
              {oibusInfo.executable}
            </ListGroupItem>
            <ListGroupItem>
              <b className="me-1">Configuration File:</b>
              {oibusInfo.configurationFile}
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
            <ListGroupItem tag="a" href="https://optimistik.io/oibus">
              Official site
            </ListGroupItem>
            <ListGroupItem>
              Copyright:
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
export default About
