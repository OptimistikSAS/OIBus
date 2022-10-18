import React, { useState } from 'react'
import { nanoid } from 'nanoid'
import PropTypes from 'prop-types'
import { Row, Container, Button, Modal, ModalHeader, ModalBody, ModalFooter } from 'reactstrap'
import { useNavigate } from 'react-router-dom'
import { ConfigContext } from '../context/config-context.jsx'
import validationSouth from '../south/form/south.validation'
import { OibText } from '../components/oib-form'
import imageCategories from './image-categories'

const NewSouth = ({
  modal,
  toggle,
}) => {
  const {
    newConfig,
    dispatchNewConfig,
    southTypes,
  } = React.useContext(ConfigContext)
  const [name, setName] = React.useState('')
  const [active, setActive] = useState(false)
  const [southTypeError, setSouthTypeError] = React.useState(null)
  const [nameError, setNameError] = React.useState(null)
  const [southType, setSouthType] = React.useState(null)
  const southConnectors = newConfig?.south ?? []
  const navigate = useNavigate()

  const southCategoryList = southTypes ? [...new Set(southTypes.map((e) => e.category))] : []

  const addSouth = () => {
    if (southType === null && name !== '') {
      setSouthTypeError('A South type must be selected')
    }
    if (name === '' && southType !== null) {
      setNameError('A name must be specified')
    }
    if (name === '' && southType === null) {
      setSouthTypeError('A name must be specified and a South type must be selected')
    }
    if (!validationSouth.south.isValidName(name, southConnectors.map((south) => south.name)) && name !== '' && southType !== null) {
      const myNewId = nanoid()
      dispatchNewConfig({
        type: 'addRow',
        name: 'south',
        value: {
          id: myNewId,
          name,
          type: southType,
          enabled: false,
        },
      })
      toggle()
      setSouthType(null)
      setName('')
      setSouthTypeError(null)
      setNameError(null)
      navigate(`/south/${myNewId}`)
    }
  }

  return (
    <Modal
      isOpen={modal}
      toggle={toggle}
      aria-labelledby="contained-modal-title-vcenter"
      centered
      size="lg"
    >
      <ModalHeader className="oi-modal-header">
        Select a South type
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
                {southTypes.filter((e) => e.category === category)
                  .map(({ connectorName }) => (
                    <button
                      id="icon-connector"
                      key={`${category}-${connectorName}-south-icon-connector`}
                      className={`${(southType === connectorName && active) ? 'connector connector-focus me-2 my-2' : 'connector me-2 my-2'}`}
                      type="button"
                      onClick={() => {
                        setActive(true)
                        setSouthType(connectorName)
                      }}
                    >
                      {connectorName}
                    </button>
                  ))}
              </div>
            </Row>
          ))}
        </Container>
        <OibText
          value={name}
          label="Name"
          name="name"
          onChange={(fieldName, newName) => setName(newName)}
          defaultValue=""
          valid={() => validationSouth.south.isValidName(name, southConnectors.map((south) => south.name))}
        />
      </ModalBody>

      <ModalFooter className="d-flex d-flex justify-content-end align-items-center">
        <div>
          {southTypeError && !southType ? (
            <span className="oi-error">
              {southTypeError}
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
              addSouth()
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
  modal: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
}
export default NewSouth
