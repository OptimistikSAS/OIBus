import React, { useState } from 'react'
import { nanoid } from 'nanoid'
import { Button, Col, Form, Popover, PopoverBody, Row } from 'reactstrap'
import { ConfigContext } from '../context/configContext.jsx'
import validationSouth from '../South/Form/South.validation'
import { OIbSelect, OIbText } from '../components/OIbForm'

const NewSouth = () => {
  const { newConfig, dispatchNewConfig, protocolList } = React.useContext(ConfigContext)
  const [openPopover, setOpenPopover] = useState(false)
  const [name, setName] = React.useState('')
  const [protocol, setProtocol] = React.useState(protocolList[0])
  const dataSources = newConfig?.south?.dataSources ?? []

  const handleChange = (attributeName, value) => {
    switch (attributeName) {
      case 'name':
        setName(value)
        break
      case 'protocol':
      default:
        setProtocol(value)
        break
    }
  }

  const togglePopover = () => setOpenPopover(!openPopover)

  const addDataSource = () => {
    if (!validationSouth.protocol.isValidName(name, dataSources?.map((dataSource) => dataSource.name) ?? [])) {
      togglePopover(null)
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
    }
  }

  return (
    <>
      <Button
        id="add-south"
        className="inline-button autosize oi-south-button"
        size="sm"
        outline
      >
        + South
      </Button>
      <Popover
        className="pop-container"
        trigger="legacy"
        placement="right"
        target="add-south"
        isOpen={openPopover}
        toggle={togglePopover}
      >
        <PopoverBody>
          <Form>
            <Row>
              <Col md="7">
                <OIbText
                  label="New DataSource Name"
                  value={name}
                  name="name"
                  onChange={handleChange}
                  defaultValue=""
                  valid={() => validationSouth.protocol.isValidName(name, dataSources?.map((dataSource) => dataSource.name) ?? [])}
                />
              </Col>
              <Col md="5">
                <OIbSelect
                  label="Protocol"
                  value={protocol}
                  name="protocol"
                  options={protocolList}
                  defaultValue={protocolList[0]}
                  onChange={handleChange}
                />
              </Col>
            </Row>
            <br />
            <Col md="2">
              <Button size="sm" className="oi-add-button" color="primary" onClick={addDataSource}>
                Add
              </Button>
            </Col>
          </Form>
        </PopoverBody>
      </Popover>
    </>
  )
}

export default NewSouth
