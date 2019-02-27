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
      <NavbarBrand href="/index.html">OIBus</NavbarBrand>
      <NavbarToggler onClick={toggle} />
      <Collapse isOpen={isOpen} navbar>
        <Nav className="ml-auto" navbar>
          <NavItem>
            <Link to="/engine">Engine</Link>
          </NavItem>
          <NavItem>
            <Link to="/north">North</Link>
          </NavItem>
          <NavItem>
            <Link to="/south">South</Link>
          </NavItem>
        </Nav>
      </Collapse>
    </Navbar>
  )
}
export default TopHeader
