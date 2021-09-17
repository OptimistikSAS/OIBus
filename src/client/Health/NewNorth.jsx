import React, { useState } from 'react'
import { nanoid } from 'nanoid'
import PropTypes from 'prop-types'
import { Button, Col, Container, Row, Modal, ModalHeader, ModalBody, ModalFooter } from 'reactstrap'
import { ConfigContext } from '../context/configContext.jsx'
import validationNorth from '../North/Form/North.validation'
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
const NewNorth = ({ modal, toggle }) => {
  const { newConfig, dispatchNewConfig, apiList } = React.useContext(ConfigContext)
  const [name, setName] = React.useState('')
  const [active, setActive] = useState(false)
  const [apiError, setApiError] = React.useState(null)
  const [nameError, setNameError] = React.useState(null)
  const [api, setApi] = React.useState(null)
  const applications = newConfig?.north?.applications ?? []

  const northCategoryList = apiList ? [...new Set(apiList.map((e) => e.category))] : []

  const addApplication = () => {
    if (api === null && name !== '') {
      setApiError('An application must be selected')
    }
    if (name === '' && api !== null) {
      setNameError('A name must be specified')
    }
    if (name === '' && api === null) {
      setApiError('A name must be specified and an application must be selected')
    }

    if (!validationNorth.application.isValidName(name, applications.map((application) => application.name)) && name !== '' && api !== null) {
      dispatchNewConfig({
        type: 'addRow',
        name: 'north.applications',
        value: {
          id: nanoid(),
          name,
          api,
          enabled: false,
        },
      })
      toggle()
      setApi(null)
      setName('')
      setApiError(null)
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
          Select an application
        </ModalHeader>

        <ModalBody>
          <Container className="scrollBar">
            {northCategoryList?.map((category) => (
              <Row key={`${category}-south-row`} style={{ margin: '25px 0px 60px 0px' }}>
                <Col xs={6} md={12}>
                  <div className="icon-container">
                    <div className="icon-left-modal">
                      <img src={imageCategories[category]?.image || imageCategories.Default.image} alt="logo" height="24px" />
                    </div>
                    <div style={{ fontSize: '18px', paddingRight: '75px' }} className="icon-center-modal ">
                      {imageCategories[category]?.label}
                    </div>
                  </div>
                  <div className="connector-container">
                    {apiList.filter((e) => e.category === category).map(({ connectorName }) => (
                      <button
                        id="icon-connector"
                        key={`${category}-${connectorName}-north-icon-connector`}
                        className={`${(api === connectorName && active) ? 'connector-focus' : 'connector'}`}
                        type="button"
                        onClick={() => {
                          setActive(true)
                          setApi(connectorName)
                        }}
                      >
                        {connectorName}
                      </button>
                    ))}
                  </div>
                </Col>
              </Row>
            ))}
            {apiError && !api ? (
              <div className="oi-error">
                {apiError}
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
              label="Application Name"
              value={name}
              name="name"
              onChange={(fieldName, newName) => setName(newName)}
              defaultValue=""
              valid={() => validationNorth.application.isValidName(name, applications.map((application) => application.name))}
            />
          </Col>
          <Button
            className="oi-add-button"
            id="icon-confirm"
            variant="secondary"
            onClick={() => { addApplication() }}
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

NewNorth.propTypes = {
  modal: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
}
export default NewNorth
