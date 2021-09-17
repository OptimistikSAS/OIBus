import React, { useState } from 'react'
import { nanoid } from 'nanoid'
import PropTypes from 'prop-types'
import { Col, Row, Container, Button, Modal, ModalHeader, ModalBody, ModalFooter } from 'reactstrap'
import { ConfigContext } from '../context/configContext.jsx'
import validationSouth from '../South/Form/South.validation'
import { OIbText } from '../components/OIbForm'
import FileIn from './images/file-in.svg'
import FileOut from './images/file-out.svg'
import OI from './images/oi.svg'
import IoT from './images/iot.svg'
import Api from './images/api.svg'
import Debug from './images/debug.svg'
import DatabaseIn from './images/db-in.svg'
import DatabaseOut from './images/db-out.svg'

const imageCategories = {
  DatabaseIn: {
    image: DatabaseIn,
    label: 'Database',
  },
  DatabaseOut: {
    image: DatabaseOut,
    label: 'Database',
  },
  FileIn: {
    image: FileIn,
    label: 'File',
  },
  FileOut: {
    image: FileOut,
    label: 'File',
  },
  Api: {
    image: Api,
    label: 'Api',
  },
  OI: {
    image: OI,
    label: 'OI',
  },
  IoT: {
    image: IoT,
    label: 'IoT',
  },
  Debug: {
    image: Debug,
    label: 'Debug',
  },
  Default: {
    image: OI,
    label: 'OI',
  },
}

const NewSouth = ({ modal, toggle }) => {
  const { newConfig, dispatchNewConfig, protocolList } = React.useContext(ConfigContext)
  const [name, setName] = React.useState('')
  const [active, setActive] = useState(false)
  const [protocolError, setProtocolError] = React.useState(null)
  const [nameError, setNameError] = React.useState(null)
  const [protocol, setProtocol] = React.useState(null)
  const dataSources = newConfig?.south?.dataSources ?? []

  const southCategoryList = protocolList ? [...new Set(protocolList.map((e) => e.category))] : []

  const addDataSource = () => {
    if (protocol === null && name !== '') {
      setProtocolError('A protocol must be selected')
    }
    if (name === '' && protocol !== null) {
      setNameError('A name must be specified')
    }
    if (name === '' && protocol === null) {
      setProtocolError('A name must be specified and a protocol must be selected')
    }
    if (!validationSouth.protocol.isValidName(name, dataSources.map((dataSource) => dataSource.name)) && name !== '' && protocol !== null) {
      dispatchNewConfig({
        type: 'addRow',
        name: 'south.dataSources',
        value: {
          id: nanoid(),
          name,
          protocol,
          enabled: false,
        },
      })
      toggle()
      setProtocol(null)
      setName('')
      setProtocolError(null)
      setNameError(null)
    }
  }

  return (
    <>

      <Modal
        isOpen={modal}
        toggle={toggle}
        aria-labelledby="contained-modal-title-vcenter"
        centered
        size="lg"
      >
        <ModalHeader className="oi-modal-header">
          Select a protocol
        </ModalHeader>

        <ModalBody>
          <Container className="scrollBar">
            {southCategoryList?.map((category) => (
              <Row key={`${category}-south-row`} style={{ margin: '25px 0px 60px 0px' }}>
                <Col xs={6} md={12}>
                  <div className="icon-container">
                    <div className="icon-left-modal">
                      <img src={imageCategories[category]?.image || imageCategories.Default.image} alt="logo" height="24px" />
                    </div>
                    <div style={{ fontSize: '18px' }} className="icon-center-modal ">
                      {imageCategories[category]?.label}
                    </div>
                  </div>
                  <div className="connector-container">
                    {protocolList.filter((e) => e.category === category).map(({ connectorName }) => (
                      <button
                        id="icon-connector"
                        key={`${category}-${connectorName}-south-icon-connector`}
                        className={`${(protocol === connectorName && active) ? 'connector-focus' : 'connector'}`}
                        type="button"
                        onClick={() => {
                          setActive(true)
                          setProtocol(connectorName)
                        }}
                      >
                        {connectorName}
                      </button>
                    ))}
                  </div>
                </Col>
              </Row>
            ))}
            {protocolError && !protocol ? (
              <div className="oi-error">
                {protocolError}
              </div>
            ) : null}
            {nameError && name === '' ? (
              <div className="oi-error">
                {nameError}
              </div>
            ) : null}
          </Container>
        </ModalBody>

        <ModalFooter className="oi-modal-footer">
          <Col className="oi-new-name" md="6">
            <OIbText
              label="New DataSource Name"
              value={name}
              name="name"
              onChange={(fieldName, newName) => setName(newName)}
              defaultValue=""
              valid={() => validationSouth.protocol.isValidName(name, dataSources.map((dataSource) => dataSource.name))}
            />
          </Col>
          <Button
            className="oi-add-button"
            id="icon-confirm"
            variant="secondary"
            onClick={() => { addDataSource() }}
          >
            Add
          </Button>
          <Button
            className="oi-add-button"
            id="cancel-button"
            variant="primary"
            onClick={toggle}
          >
            Cancel
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}

NewSouth.propTypes = {
  modal: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
}
export default NewSouth
