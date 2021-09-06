import React, { useState } from 'react'
import { Button, Col, Form, Popover, PopoverBody, Row } from 'reactstrap'
import { nanoid } from 'nanoid'
import { ConfigContext } from '../context/configContext.jsx'
import validationNorth from '../North/Form/North.validation'
import { OIbSelect, OIbText } from '../components/OIbForm'

const NewNorth = () => {
  const { newConfig, dispatchNewConfig, apiList } = React.useContext(ConfigContext)
  const [name, setName] = React.useState('')
  const [api, setApi] = React.useState(apiList[0])

  const [openPopover, setOpenPopover] = useState(false)
  const applications = newConfig?.north?.applications ?? []

  const togglePopover = () => setOpenPopover(!openPopover)

  const addApplication = () => {
    if (!validationNorth.application.isValidName(name, applications?.map((application) => application.name) ?? [])) {
      togglePopover(false)
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
    }
  }

  const handleChange = (attributeName, value) => {
    switch (attributeName) {
      case 'name':
        setName(value)
        break
      case 'api':
      default:
        setApi(value)
        break
    }
  }

  return (
    <>
      <Button
        id="add-north"
        className="inline-button autosize oi-north-button"
        size="sm"
        outline
      >
        + North
      </Button>
      <Popover
        className="pop-container"
        trigger="legacy"
        placement="left"
        target="add-north"
        isOpen={openPopover}
        toggle={togglePopover}
      >
        <PopoverBody>
          <Form>
            <Row>
              <Col md="7">
                <OIbText
                  label="Application Name"
                  value={name}
                  name="name"
                  onChange={handleChange}
                  defaultValue=""
                  valid={() => validationNorth.application.isValidName(name, applications?.map((application) => application.name) ?? [])}
                />
              </Col>
              <Col md="5">
                <OIbSelect label="API" value={api} name="api" options={apiList} defaultValue={apiList[0]} onChange={handleChange} />
              </Col>
            </Row>
            <br />
            <Col md="2">
              <Button size="sm" id="icon-add" className="oi-add-button" color="primary" onClick={addApplication}>
                Add
              </Button>
            </Col>
          </Form>
        </PopoverBody>
      </Popover>
    </>

  )
}

export default NewNorth
