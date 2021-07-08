import React from 'react'
import PropTypes from 'prop-types'
import { Link, useHistory } from 'react-router-dom'
import { Form, Row, Col, Breadcrumb, BreadcrumbItem } from 'reactstrap'
import { OIbTitle, OIbCheckBox, OIbScanMode, OIbLogLevel } from '../../components/OIbForm'
import OIbForm from '../../components/OIbForm/OIbForm.jsx'
import ProtocolSchemas from '../Protocols.jsx'
import PointsButton from '../PointsButton.jsx'
import StatusButton from '../StatusButton.jsx'

const SouthForm = ({ dataSource, dataSourceIndex, onChange }) => {
  const { protocol, dataSourceId } = dataSource
  const history = useHistory()
  // Create the sections for the protocol (for example dataSource.Modbus) for dataSource not yet initialized
  if (!dataSource[protocol]) dataSource[protocol] = {}
  if (!dataSource.points) {
    dataSource.points = []
  }
  // load the proper schema based on the protocol name.
  // in case of SQLDbToFile protocol load schema based on selected driver
  const schema = protocol === 'SQLDbToFile'
    ? ProtocolSchemas.SQLDbToFile.withDriver(dataSource.SQLDbToFile.driver)
    : ProtocolSchemas[protocol]
  const prefix = `south.dataSources.${dataSourceIndex}`

  /**
   * Redirects the user to the datasource's live page
   * @return {void}
   */
  const handleStatus = () => {
    const pathname = `/south/${dataSourceId}/live`
    history.push({ pathname })
  }

  return (
    <Form>
      <Row>
        <Col md={5}>
          <Breadcrumb tag="h5">
            <BreadcrumbItem tag={Link} to="/" className="oi-breadcrumb">
              Home
            </BreadcrumbItem>
            <BreadcrumbItem tag={Link} to="/south" className="oi-breadcrumb">
              South
            </BreadcrumbItem>
            <BreadcrumbItem active tag="span">
              {dataSourceId}
            </BreadcrumbItem>
          </Breadcrumb>
        </Col>
        <Col md={2}>
          <StatusButton handler={handleStatus} enabled={dataSource.enabled} />
          <PointsButton dataSource={dataSource} />
        </Col>
      </Row>
      <OIbTitle label="General settings">
        <>
          <ul>
            <li>This form allows to configure protocol-specific parameters.</li>
            <li>You need to activate the protocol with the enabled checkbox.</li>
          </ul>
        </>
      </OIbTitle>
      <Row>
        <Col md={4}>
          <OIbCheckBox
            name={`${prefix}.enabled`}
            label={dataSource.enabled ? 'Enabled' : 'Disabled'}
            defaultValue={false}
            value={dataSource.enabled}
            help={<div>Enable this application</div>}
            onChange={onChange}
            switchButton
          />
        </Col>
        {!schema.points && (
          <Col md={4}>
            <OIbScanMode name={`${prefix}.scanMode`} value={dataSource.scanMode} onChange={onChange} />
          </Col>
        )}
      </Row>
      <OIbLogLevel
        name={`${prefix}.logParameters`}
        value={dataSource.logParameters}
        onChange={onChange}
      />
      <OIbForm onChange={onChange} schema={schema} name={`${prefix}.${protocol}`} values={dataSource[protocol]} />
    </Form>
  )
}

SouthForm.propTypes = {
  dataSource: PropTypes.object.isRequired,
  dataSourceIndex: PropTypes.number.isRequired,
  onChange: PropTypes.func.isRequired,
}

export default SouthForm
