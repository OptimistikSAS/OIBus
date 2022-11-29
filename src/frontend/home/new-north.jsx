import React, { useState } from 'react'
import { nanoid } from 'nanoid'
import PropTypes from 'prop-types'
import { Button, Container, Row, Modal, ModalHeader, ModalBody, ModalFooter } from 'reactstrap'
import { useNavigate } from 'react-router-dom'
import { ConfigContext } from '../context/config-context.jsx'
import validationNorth from '../north/form/north.validation.js'
import { OibText } from '../components/oib-form/index.js'
import imageCategories from './image-categories.js'

const NewNorth = ({
  modal,
  toggle,
}) => {
  const {
    newConfig,
    dispatchNewConfig,
    northTypes,
  } = React.useContext(ConfigContext)
  const [name, setName] = React.useState('')
  const [active, setActive] = useState(false)
  const [northTypeError, setNorthTypeError] = React.useState(null)
  const [nameError, setNameError] = React.useState(null)
  const [northType, setNorthType] = React.useState(null)
  const northConnectors = newConfig?.north ?? []
  const navigate = useNavigate()

  const northCategoryList = northTypes ? [...new Set(northTypes.map((e) => e.category))] : []

  const addNorth = () => {
    if (northType === null && name !== '') {
      setNorthTypeError('A North type must be selected')
    }
    if (name === '' && northType !== null) {
      setNameError('A name must be specified')
    }
    if (name === '' && northType === null) {
      setNorthTypeError('A name must be specified and a North type must be selected')
    }

    if (!validationNorth.north.isValidName(name, northConnectors.map((north) => north.name)) && name !== '' && northType !== null) {
      const myNewId = nanoid()

      dispatchNewConfig({
        type: 'addRow',
        name: 'north',
        value: {
          id: myNewId,
          name,
          type: northType,
          enabled: false,
        },
      })

      toggle()
      setNorthType(null)
      setName('')
      setNorthTypeError(null)
      setNameError(null)
      navigate(`/north/${myNewId}`)
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
        Select a a North type
      </ModalHeader>

      <ModalBody>
        <Container className="scrollBar">
          {northCategoryList?.map((category) => (
            <Row key={`${category}-north-row`} className="mb-3">
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
                {northTypes.filter((e) => e.category === category)
                  .map(({ connectorName }) => (
                    <button
                      id="icon-connector"
                      key={`${category}-${connectorName}-north-icon-connector`}
                      className={`${(northType === connectorName && active) ? 'connector me-2 my-2 connector-focus' : 'connector me-2 my-2'}`}
                      type="button"
                      onClick={() => {
                        setActive(true)
                        setNorthType(connectorName)
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
          valid={() => validationNorth.north.isValidName(name, northConnectors.map((north) => north.name))}
        />
      </ModalBody>

      <ModalFooter className="d-flex justify-content-end align-items-center">
        <div>
          {northTypeError && !northType ? (
            <span className="oi-error">
              {northTypeError}
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
              addNorth()
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

NewNorth.propTypes = {
  modal: PropTypes.bool.isRequired,
  toggle: PropTypes.func.isRequired,
}
export default NewNorth
