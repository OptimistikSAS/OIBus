import React from 'react'
import { ListGroup, ListGroupItem, Row, Container } from 'reactstrap'
import apis from '../services/apis'
import OIbTitle from '../components/OIbForm/OIbTitle.jsx'
import { AlertContext } from '../context/AlertContext.jsx'
import { ConfigContext } from '../context/ConfigContext.jsx'
import logo from './OIBus.png'

const About = () => {
  const [staticStatus, setstaticStatus] = React.useState({})
  const [dynamicStatus, setdynamicStatus] = React.useState({})
  const { setAlert } = React.useContext(AlertContext)
  const { activeConfig } = React.useContext(ConfigContext)

  /**
   * Acquire the status
   * @returns {void}
   */
  const fetchStatus = () => {
    apis
      .getStatus()
      .then((response) => {
        setstaticStatus(response)
      })
      .catch((error) => {
        console.error(error)
        setAlert({ text: error.message, type: 'danger' })
      })
  }

  /**
   * Fetch static status after render
   * @returns {void}
   */
  React.useEffect(() => {
    fetchStatus()
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
        setdynamicStatus(myData)
      }
    }
    return (() => source.close())
  }, [activeConfig])

  return (
    <>

      <Row>
        <Container fluid>
          {staticStatus && (
          <ListGroup>
            <ListGroupItem tag="a" href="https://optimistik.io/oibus">
              <img src={logo} alt="logo" height="100px" />
            </ListGroupItem>
            <ListGroupItem>
              <b className="mr-2">Version:</b>
              {staticStatus.version}
            </ListGroupItem>
            <ListGroupItem>
              <b className="mr-2">Architecture:</b>
              {staticStatus.architecture}
            </ListGroupItem>
            <ListGroupItem>
              <b className="mr-2">currentDirectory:</b>
              {staticStatus.currentDirectory}
            </ListGroupItem>
            <ListGroupItem>
              <b className="mr-2">nodeVersion:</b>
              {staticStatus.nodeVersion}
            </ListGroupItem>
            <ListGroupItem>
              <b className="mr-2">Executable:</b>
              {staticStatus.executable}
            </ListGroupItem>
            <ListGroupItem>
              <b className="mr-2">ConfigurationFile:</b>
              {staticStatus.configurationFile}
            </ListGroupItem>
            <ListGroupItem>
              <b className="mr-2">Hostname:</b>
              {staticStatus.hostname}
            </ListGroupItem>
            <ListGroupItem>
              <b className="mr-2">Operating System:</b>
              {staticStatus.osType}
              {' '}
              {staticStatus.osRelease}
            </ListGroupItem>
            <ListGroupItem tag="a" href="https://optimistik.io/oibus">
              Official site
            </ListGroupItem>
            <ListGroupItem>
              Copyright:
              {staticStatus.copyright}
            </ListGroupItem>
            <ListGroupItem tag="a" href="https://joinup.ec.europa.eu/sites/default/files/custom-page/attachment/2020-03/EUPL-1.2%20EN.txt">
              Licensed under the EUPL-1.2-or-later
            </ListGroupItem>
          </ListGroup>
          )}
        </Container>
      </Row>
      <br />
      <OIbTitle label="Monitoring" />
      <Container fluid>
        <div className="d-flex flex-wrap justify-content-between">
          <ListGroup>
            {Object.entries(dynamicStatus)
              .map(([key, value]) => (
                <ListGroupItem key={key}>
                  <div key={key}>
                    <b className="mr-2">
                      {key}
                      :
                    </b>
                    <span>{value}</span>
                  </div>
                </ListGroupItem>
              ))}
          </ListGroup>
        </div>
      </Container>
    </>
  )
}
export default About
