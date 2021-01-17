import React from 'react'
import { Link } from 'react-router-dom'
import { ListGroup, ListGroupItem, Row, Breadcrumb, BreadcrumbItem, Container } from 'reactstrap'
import apis from '../services/apis'
import { AlertContext } from '../context/AlertContext.jsx'
import logo from './OIBus.png'

const About = () => {
  const [status, setStatus] = React.useState({})
  const { setAlert } = React.useContext(AlertContext)

  /**
   * Acquire the status
   * @returns {void}
   */
  const fetchStatus = () => {
    apis
      .getStatus()
      .then((response) => {
        setStatus(response)
      })
      .catch((error) => {
        console.error(error)
        setAlert({ text: error.message, type: 'danger' })
      })
  }

  /**
   * Fetch status after render
   * @returns {void}
   */
  React.useEffect(() => {
    fetchStatus()
  }, [])

  return (
    <>
      <Breadcrumb tag="h5">
        <BreadcrumbItem tag={Link} to="/" className="oi-breadcrumb">
          Home
        </BreadcrumbItem>
        <BreadcrumbItem active tag="span">
          About
        </BreadcrumbItem>
      </Breadcrumb>
      <Row>
        <Container fluid>
          {status && (
          <ListGroup>
            <ListGroupItem tag="a" href="https://optimistik.io/oibus">
              <img src={logo} alt="logo" height="100px" />
            </ListGroupItem>
            <ListGroupItem>
              Version:
              {status.version}
            </ListGroupItem>
            <ListGroupItem tag="a" href="https://optimistik.io/oibus">
              Official site
            </ListGroupItem>
            <ListGroupItem>
              Copyright:
              {status.copyright}
            </ListGroupItem>
            <ListGroupItem tag="a" href="https://joinup.ec.europa.eu/sites/default/files/custom-page/attachment/2020-03/EUPL-1.2%20EN.txt">
              Licensed under the EUPL-1.2-or-later
            </ListGroupItem>
          </ListGroup>
          )}
        </Container>
      </Row>
    </>
  )
}
export default About
