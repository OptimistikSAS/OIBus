import React from 'react'
import PropTypes from 'prop-types'
import { Form, Row, Col } from 'reactstrap'
// import { AlertContext } from '../context/AlertContext.jsx'
import { OIbTitle, OIbCheckBox } from '../components/OIbForm'

import Link from '../../north/link/Form.jsx'

const ApiForms = { Link }

const NorthForm = ({ application, onChange }) => {
  // const dataSourceIds = newConfig && newConfig.south.dataSources.map((dataSource) => dataSource.dataSourceId)
  const { api, applicationId } = application
  const ApiForm = ApiForms[api]
  return (
    <Form>
      <OIbTitle title={`${applicationId} parameters (api: ${api})`}>
        <>
          <ul>
            <li>Enabled: allows to enable or disable this application</li>
            <li>applicationId: is the unique name of this application.</li>
            <li>...</li>
          </ul>
        </>
      </OIbTitle>
      <Row form>
        <Col md={2}>
          <OIbCheckBox
            name="application.enabled"
            label="Enabled"
            value={application.enabled}
            help={<div>Enable this application</div>}
            onChange={onChange}
          />
        </Col>
      </Row>
      <Row form>
        <ApiForm />
      </Row>
    </Form>
  )
}

NorthForm.propTypes = { application: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

export default NorthForm
