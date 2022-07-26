import React, { useState } from 'react'
import { nanoid } from 'nanoid'
import PropTypes from 'prop-types'
import { Row, Container, Button, Modal, ModalHeader, ModalBody, ModalFooter } from 'reactstrap'
import { useNavigate } from 'react-router-dom'
import { ConfigContext } from '../context/ConfigContext.jsx'
import validationSouth from '../South/Form/South.validation'
import { OIbText } from '../components/OIbForm'
import imageCategories from './imageCategories'

const NewSouth = ({
  openModal,
  toggle,
}) => {
  const {
    newConfig,
    dispatchNewConfig,
    southSchemas,
  } = React.useContext(ConfigContext)
  const [name, setName] = React.useState('')
  const [active, setActive] = useState(false)
  const [protocolError, setProtocolError] = React.useState(null)
  const [nameError, setNameError] = React.useState(null)
  const [protocol, setProtocol] = React.useState(null)
  const dataSources = newConfig?.south?.dataSources ?? []
  const navigate = useNavigate()

  const southCategoryList = southSchemas ? [...new Set(southSchemas.map((e) => e.category))] : []

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
      const myNewId = nanoid()
      dispatchNewConfig({
        type: 'addRow',
        name: 'south.dataSources',
        value: {
          id: myNewId,
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
      navigate(`/south/${myNewId}`)
    }
  }

  return (
    <Modal
      isOpen={openModal}
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
            <Row key={`${category}-south-row`} className="mb-3">
              <div className="d-flex">
                <div>
                  <img
                    src={imageCategories[category]?.image ?? imageCategories.Default.image}
                    alt="logo"
                    style={{ backgroundColor: '#323e48' }}
                    height="20px"
                  />
                </div>
                <div
                  style={{ fontSize: '18px' }}
                  className="ms-2"
                >
                  <b>{imageCategories[category]?.label}</b>
                </div>
              </div>
              <div>
                {southSchemas.filter((e) => e.category === category)
                  .map(({ connectorName }) => (
                    <button
                      id="icon-connector"
                      key={`${category}-${connectorName}-south-icon-connector`}
                      className={`${(protocol === connectorName && active) ? 'connector connector-focus me-2 my-2' : 'connector me-2 my-2'}`}
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
            </Row>
          ))}
        </Container>
        <OIbText
          value={name}
          label="Name"
          name="name"
          onChange={(fieldName, newName) => setName(newName)}
          defaultValue=""
          valid={() => validationSouth.protocol.isValidName(name, dataSources.map((dataSource) => dataSource.name))}
        />
      </ModalBody>

      <ModalFooter className="d-flex d-flex justify-content-end align-items-center">
        <div>
          {protocolError && !protocol ? (
            <span className="oi-error">
              {protocolError}
            </span>
          ) : null}
          {nameError && name === '' ? (
            <span className="oi-error">
              {nameError}
            </span>
          ) : null}
        </div>
        <div>
          <Button
            id="confirm"
            className="mx-1 my-0"
            variant="secondary"
            onClick={() => {
              addDataSource()
            }}
          >
            Add
          </Button>
          <Button
            id="cancel"
            className="mx-1 my-0"
            variant="primary"
            onClick={toggle}
          >
            Cancel
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  )
}

NewSouth.propTypes = {
  openModal: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
}
export default NewSouth
