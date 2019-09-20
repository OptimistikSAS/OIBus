import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import { OIbText, OIbPassword, OIbTitle, OIbProxy } from '../../client/components/OIbForm'
import validation from './AmazonS3.validation'

const AmazonS3Form = ({ application, onChange }) => (
  <>
    <Row>
      <Col md="4">
        <OIbText
          label="Bucket"
          onChange={onChange}
          value={application.AmazonS3.bucket}
          valid={validation.AmazonS3.bucket}
          name="AmazonS3.bucket"
          help={<div />}
        />
      </Col>
      <Col md="4">
        <OIbText
          label="Folder"
          onChange={onChange}
          value={application.AmazonS3.folder}
          valid={validation.AmazonS3.folder}
          name="AmazonS3.folder"
          help={<div />}
        />
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
          valid={validation.AmazonS3.authentication.accessKey}
          name="AmazonS3.authentication.accessKey"
          help={<div />}
        />
      </Col>
      <Col md="4">
        <OIbPassword
          label="Secret Key"
          onChange={onChange}
          value={application.AmazonS3.authentication.secretKey}
          valid={validation.AmazonS3.authentication.secretKey}
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
        <OIbProxy
          label="Proxie"
          name="AmazonS3.proxy"
          proxy={application.AmazonS3.proxy}
          onChange={onChange}
          help={<div />}
        />
      </Col>
    </Row>
  </>
)
AmazonS3Form.propTypes = { application: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

export default AmazonS3Form
