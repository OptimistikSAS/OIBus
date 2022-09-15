import React, { useState } from 'react'
import { nanoid } from 'nanoid'
import PropTypes from 'prop-types'
import { Button, Container, Row, Modal, ModalHeader, ModalBody, ModalFooter } from 'reactstrap'
import { useNavigate } from 'react-router-dom'
import { ConfigContext } from '../context/ConfigContext.jsx'
import validationNorth from '../North/Form/North.validation'
import { OIbText } from '../components/OIbForm'
import imageCategories from './imageCategories'

const NewNorth = ({
  modal,
  toggle,
}) => {
  const {
    newConfig,
    dispatchNewConfig,
    apiList,
  } = React.useContext(ConfigContext)
  const [name, setName] = React.useState('')
  const [active, setActive] = useState(false)
  const [apiError, setApiError] = React.useState(null)
  const [nameError, setNameError] = React.useState(null)
  const [api, setApi] = React.useState(null)
  const applications = newConfig?.north ?? []
  const navigate = useNavigate()

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
      const myNewId = nanoid()

      dispatchNewConfig({
        type: 'addRow',
        name: 'north',
        value: {
          id: myNewId,
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
        Select an application
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
                {apiList.filter((e) => e.category === category)
                  .map(({ connectorName }) => (
                    <button
                      id="icon-connector"
                      key={`${category}-${connectorName}-north-icon-connector`}
                      className={`${(api === connectorName && active) ? 'connector me-2 my-2 connector-focus' : 'connector me-2 my-2'}`}
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
            </Row>
          ))}
        </Container>
        <OIbText
          value={name}
          label="Name"
          name="name"
          onChange={(fieldName, newName) => setName(newName)}
          defaultValue=""
          valid={() => validationNorth.application.isValidName(name, applications.map((application) => application.name))}
        />
      </ModalBody>

      <ModalFooter className="d-flex justify-content-end align-items-center">
        <div>
          {apiError && !api ? (
            <span className="oi-error">
              {apiError}
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
              addApplication()
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
