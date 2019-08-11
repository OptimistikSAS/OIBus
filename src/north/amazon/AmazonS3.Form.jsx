import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
// import { ConfigContext } from '../context/configContext.jsx'
import { OIbText, OIbPassword, OIbTitle } from '../../client/components/OIbForm'

const AmazonS3Form = ({ application, onChange }) => (
  <>
    <Row>
      <Col md="4">
        <OIbText label="Bucket" onChange={onChange} value={application.AmazonS3.bucket} name="AmazonS3.bucket" help={<div />} />
      </Col>
      <Col md="4">
        <OIbText label="Folder" onChange={onChange} value={application.AmazonS3.folder} name="AmazonS3.folder" help={<div />} />
      </Col>
    </Row>
    <Row>
      <Col>
        <OIbTitle title="Authentication">
          <div>todo</div>
        </OIbTitle>
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbText
          label="Access Key"
          onChange={onChange}
          value={application.AmazonS3.authentication.accessKey}
          name="AmazonS3.authentication.accessKey"
          help={<div />}
        />
      </Col>
      <Col md="4">
        <OIbPassword
          label="Secret Key"
          onChange={onChange}
          value={application.AmazonS3.authentication.secretKey}
          name="AmazonS3.authentication.secretKey"
          help={<div />}
        />
      </Col>
    </Row>
    <Row>
      <Col>
        <OIbTitle title="Network">
          <div>todo</div>
        </OIbTitle>
      </Col>
    </Row>
    <Row>
      <Col md="4">
        <OIbText label="Proxie" onChange={onChange} value={application.AmazonS3.proxy} name="AmazonS3.proxy" help={<div />} />
      </Col>
    </Row>
  </>
)
AmazonS3Form.propTypes = { application: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

export default AmazonS3Form
