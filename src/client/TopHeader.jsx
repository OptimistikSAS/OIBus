import React from 'react'
import { Link, useLocation } from 'react-router-dom'

import { Collapse, Navbar, NavbarBrand, NavbarToggler, Nav, NavItem, Badge } from 'reactstrap'
import { FaNetworkWired } from 'react-icons/fa'
import apis from './services/apis'
import { ConfigContext } from './context/configContext.jsx'
import { AlertContext } from './context/AlertContext.jsx'
import logo from './logo-OIBus.png'

const TopHeader = () => {
  const { newConfig, activeConfig } = React.useContext(ConfigContext)
  const [isOpen, setIsOpen] = React.useState(false)
  const { setAlert } = React.useContext(AlertContext)
  const [status, setStatus] = React.useState({})
  const location = useLocation()

  React.useEffect(() => {
    // on location changed, clear alert
    setAlert()
  }, [location])

  const toggle = () => {
    setIsOpen(!isOpen)
  }
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

  const isActive = (name) => (location.pathname === `/${name}`)
  const configModified = JSON.stringify(newConfig) !== JSON.stringify(activeConfig)
  const engine = activeConfig?.engine
  return (
    <Navbar expand="md" className="oi-navbar oi-navbar-top" fixed="top" dark>
      <NavbarBrand tag={Link} to="/" className="mr-auto">
        <img src={logo} alt="OIBus" height="20px" className="oi-navicon" />
      </NavbarBrand>
      <NavbarToggler onClick={toggle} />
      <Collapse isOpen={isOpen} navbar>
        <Nav navbar>
          <NavItem className="oi-navitem" active={isActive('engine')} tag={Link} to="/engine">
            {'Engine '}
            {engine?.safeMode ? <Badge className="oi-safe-mode" color="warning" pill>Safe mode</Badge> : null}
            {!engine?.password ? <Badge className="oi-safe-mode" color="warning" pill>Change password</Badge> : null}
          </NavItem>
          <NavItem className="oi-navitem" active={isActive('log')} tag={Link} to="/log">
            Logs
          </NavItem>
          <NavItem className="oi-navitem" active={isActive('activation')} tag={Link} to="/activation">
            {'Activation '}
            {configModified ? <Badge color="warning" pill>new</Badge> : null}
          </NavItem>
          <NavItem className="oi-navitem" active={isActive('about')} tag={Link} to="/about">
            About
          </NavItem>
          <NavItem className="oi-navname">
            <FaNetworkWired />
            {` ${status.version}`}
          </NavItem>
        </Nav>
      </Collapse>
    </Navbar>
  )
}
export default TopHeader
