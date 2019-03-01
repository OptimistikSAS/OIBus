import React from 'react'
import { Link } from 'react-router-dom'

import { Collapse, Navbar, NavbarToggler, NavbarBrand, Nav, NavItem } from 'reactstrap'

const TopHeader = () => {
  const [isOpen, setIsOpen] = React.useState(false)
  const toggle = () => {
    setIsOpen(!isOpen)
  }
  return (
    <Navbar color="dark" dark expand="md">
      <NavbarBrand tag={Link} to="/">
        OIBus
      </NavbarBrand>
      <NavbarToggler onClick={toggle} />
      <Collapse isOpen={isOpen} navbar>
        <Nav navbar>
          <NavItem tag={Link} to="/engine">
            Engine
          </NavItem>
          <NavItem tag={Link} to="/north">
            North
          </NavItem>
          <NavItem tag={Link} to="/south">
            South
          </NavItem>
        </Nav>
      </Collapse>
    </Navbar>
  )
}
export default TopHeader
