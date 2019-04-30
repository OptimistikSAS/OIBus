import React from 'react'
import { Link } from 'react-router-dom'

import { Collapse, Navbar, NavbarToggler, NavbarBrand, Nav, NavItem } from 'reactstrap'

const TopHeader = () => {
  const [isOpen, setIsOpen] = React.useState(false)
  const toggle = () => {
    setIsOpen(!isOpen)
  }
  return (
    <Navbar expand="md" className="oi-navbar oi-navbar-top navbar-fixed-top">
      <NavbarBrand className="oi-icone-oi" tag={Link} to="/">
        OIBus
      </NavbarBrand>
      <NavbarToggler onClick={toggle} />
      <Collapse isOpen={isOpen} navbar>
        <Nav className="ml-auto" navbar>
          <NavItem tag={Link} to="/engine">
            Engine
          </NavItem>
          <NavItem tag={Link} to="/north">
            North
          </NavItem>
          <NavItem tag={Link} to="/south">
            South
          </NavItem>
          <NavItem tag={Link} to="/activatenewconfig">
            Activate new configuration
          </NavItem>
        </Nav>
      </Collapse>
    </Navbar>
  )
}
export default TopHeader
