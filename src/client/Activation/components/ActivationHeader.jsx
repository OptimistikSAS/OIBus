import React from 'react'
import { Breadcrumb, BreadcrumbItem } from 'reactstrap'
import { Link } from 'react-router-dom'
import { OIbTitle } from '../../components/OIbForm'

const ActivationHeader = () => (
  <>
    <Breadcrumb tag="h5">
      <BreadcrumbItem tag={Link} to="/" className="oi-breadcrumb">
        Home
      </BreadcrumbItem>
      <BreadcrumbItem active tag="span">
        Activation
      </BreadcrumbItem>
    </Breadcrumb>
    <OIbTitle label="Modifications">
      <div>
        <p>Modifications requested on the OIBus configuration are listed below</p>
        <p>The ACTIVE configuration is the one currently used by the OIBus server</p>
        <p>It will be replaced with the new configuration if you use the activate button</p>
        <p>The NEW configuration is the one that will be used OIBus server AFTER the activation</p>
      </div>
    </OIbTitle>
  </>
)

export default ActivationHeader
