import React from 'react'
import PropTypes from 'prop-types'
import { Row, Col } from 'reactstrap'
import { OIbText, OIbAuthentication, OIbTitle, OIbProxy } from '../../client/components/OIbForm'
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
        />
      </Col>
      <Col md="4">
        <OIbText
          label="Folder"
          onChange={onChange}
          value={application.AmazonS3.folder}
          valid={validation.AmazonS3.folder}
          name="AmazonS3.folder"
        />
      </Col>
    </Row>
    <OIbAuthentication
      authentication={application.AliveSignalauthentication}
      validation={validation.AmazonS3.authentication}
      onChange={onChange}
      name="AmazonS3.authentication"
      mode="accessKey"
    />
    <OIbTitle title="Network">
      <>
        <p>Please specify here the proxy name to use</p>
        <p>(proxy names are defined in the Engine page)</p>
      </>
    </OIbTitle>
    <Row>
      <Col md="4">
        <OIbProxy
          label="Proxy"
          name="AmazonS3.proxy"
          proxy={application.AmazonS3.proxy}
          onChange={onChange}
        />
      </Col>
    </Row>
  </>
)
AmazonS3Form.propTypes = { application: PropTypes.object.isRequired, onChange: PropTypes.func.isRequired }

export default AmazonS3Form
