import React from 'react'
import { Link, withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'

import { Collapse, Navbar, NavbarToggler, Nav, NavItem, Label } from 'reactstrap'

import { AlertContext } from './context/AlertContext'
import logo from './logo-OIBus.png'

const TopHeader = ({ location }) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const { setAlert } = React.useContext(AlertContext)

  React.useEffect(() => {
    // on location changed, clear alert
    setAlert()
  }, [location])

  const toggle = () => {
    setIsOpen(!isOpen)
  }
  const isActive = (name) => (location.pathname === `/${name}`)
  return (
    <Navbar expand="md" className="oi-navbar oi-navbar-top navbar-fixed-top">
      <NavbarToggler onClick={toggle} />
      <Collapse isOpen={isOpen} navbar>
        <Nav navbar>
          <NavItem className="oi-navicon" tag={Link} to="/">
            <img src={logo} alt="OIBus" height="24px" className="oi-navicon" />
          </NavItem>
          <NavItem className="oi-navitem" active={isActive('engine')} tag={Link} to="/engine">
            Engine
          </NavItem>
          <NavItem className="oi-navitem" active={isActive('north')} tag={Link} to="/north">
            North
          </NavItem>
          <NavItem className="oi-navitem" active={isActive('south')} tag={Link} to="/south">
            South
          </NavItem>
          <NavItem className="oi-navitem" active={isActive('log')} tag={Link} to="/log">
            Logs
          </NavItem>
          <NavItem className="oi-navitem" active={isActive('health')} tag={Link} to="/health">
            Health
          </NavItem>
        </Nav>
      </Collapse>
      <Label className="copyright-label">
        {'(c) Copyright 2019 Optimistik, all rights reserved.'}
      </Label>
    </Navbar>
  )
}
export default withRouter(TopHeader)
TopHeader.propTypes = { location: PropTypes.object.isRequired }
