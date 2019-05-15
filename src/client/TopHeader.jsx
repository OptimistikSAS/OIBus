import React from 'react'
import { Link } from 'react-router-dom'

import { Collapse, Navbar, NavbarToggler, Nav, NavItem } from 'reactstrap'

import logo from './logo-OIBus.png'

const TopHeader = () => {
  const [isOpen, setIsOpen] = React.useState(false)
  const toggle = () => {
    setIsOpen(!isOpen)
  }
  return (
    <Navbar expand="md" className="oi-navbar oi-navbar-top navbar-fixed-top">
      <NavbarToggler onClick={toggle} />
      <Collapse isOpen={isOpen} navbar>
        <Nav navbar>
          <NavItem className="oi-navicon" tag={Link} to="/">
            <img src={logo} alt="OIBus" height="24px" className="oi-navicon" />
          </NavItem>
          <NavItem className="oi-navitem" tag={Link} to="/engine">
            Engine
          </NavItem>
          <NavItem className="oi-navitem" tag={Link} to="/north">
            North
          </NavItem>
          <NavItem className="oi-navitem" tag={Link} to="/south">
            South
          </NavItem>
        </Nav>
      </Collapse>
    </Navbar>
  )
}
export default TopHeader
