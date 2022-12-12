import React, { useContext, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Container, Spinner } from 'reactstrap'
import { FaArrowLeft } from 'react-icons/fa'
import { ConfigContext } from '../context/config-context.jsx'
import PointsComponent from '../components/points-component.jsx'
import StatusButton from '../components/status-button.jsx'
import SouthSchemas from './south-types.jsx'

const ConfigurePoints = () => {
  const { newConfig, dispatchNewConfig } = useContext(ConfigContext)

  const { id } = useParams()
  const navigate = useNavigate()

  const [south, setSouth] = useState(null)
  const [southIndex, setSouthIndex] = useState(null)

  useEffect(() => {
    if (newConfig?.south && south?.id !== id) {
      const index = newConfig.south.findIndex(
        (connector) => connector.id === id,
      )
      setSouthIndex(index)
      setSouth(newConfig.south[index])
    }
  }, [newConfig])

  const onChange = (name, value, validity) => {
    dispatchNewConfig({
      type: 'update',
      name,
      value,
      validity,
    })
  }

  return south ? (
    <>
      <div className="d-flex align-items-center w-100 oi-sub-nav">
        <h6 className="text-muted d-flex align-items-center ps-3 pt-2 pb-2 mb-0">
          <Button
            id="oi-navigate"
            outline
            onClick={() => {
              navigate(-1)
            }}
            className="util-button p-0 m-0"
          >
            <FaArrowLeft className="oi-back-icon" />
          </Button>
          <span className="mx-2">|</span>
          <span>{south.name}</span>
        </h6>
        <div className="pull-right me-3">
          <StatusButton
            handler={() => {
              navigate(`/south/${id}/live`)
            }}
            enabled={south.enabled}
          />
        </div>
      </div>
      <Container fluid>
        <PointsComponent
          prefix={`south.${southIndex}.points`}
          points={south.points}
          schema={SouthSchemas[south.type]}
          onChange={onChange}
        />
      </Container>
    </>
  ) : (
    <div className="spinner-container">
      <Spinner color="primary" type="grow" />
      ...loading points from OIBus server...
    </div>
  )
}

export default ConfigurePoints
