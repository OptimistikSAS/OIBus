import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Container, Spinner } from 'reactstrap'
import { FaArrowLeft } from 'react-icons/fa'
import { AlertContext } from '../context/alert-context.jsx'
import { ConfigContext } from '../context/config-context.jsx'
import utils from '../helpers/utils.js'
import PointsComponent from '../components/points-component.jsx'
import StatusButton from '../components/status-button.jsx'

const ConfigurePoints = () => {
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  const { setAlert } = React.useContext(AlertContext)
  const navigate = useNavigate()

  const { id } = useParams()

  if (!newConfig?.south) {
    return (
      <div className="spinner-container">
        <Spinner color="primary" type="grow" />
        ...loading points from OIBus server...
      </div>
    )
  }
  const southIndex = newConfig.south.findIndex(
    (south) => south.id === id,
  )
  const south = newConfig.south[southIndex]

  const { points: pointsOrdered = [], type } = south

  /**
   * add point
   * @returns {void}
   */
  const handleAdd = () => {
    dispatchNewConfig({ type: 'addRow', name: `south.${southIndex}.points`, value: {} })
  }

  /**
   * Delete point
   * @param {string} index the index of point
   * @returns {void}
   */
  const handleDelete = (index) => {
    dispatchNewConfig({ type: 'deleteRow', name: `south.${southIndex}.points.${index}` })
  }

  /**
   * Delete all points
   * @returns {void}
   */
  const handleDeleteAllPoint = () => {
    dispatchNewConfig({ type: 'deleteAllRows', name: `south.${southIndex}.points` })
  }

  /**
   * Send the imported file content to the backend
   * @param {Object} file the file returned by input
   * @returns {void}
   */
  const handleImportPoints = async (file) => {
    try {
      const text = await utils.readFileContent(file)
      utils
        .parseCSV(text)
        .then((newPoints) => {
          dispatchNewConfig({
            type: 'importPoints',
            name: `south.${southIndex}.points`,
            value: newPoints,
          })
        })
        .catch((error) => {
          console.error(error)
          setAlert({ text: error.message, type: 'danger' })
        })
    } catch (error) {
      console.error(error)
      setAlert({ text: error.message, type: 'danger' })
    }
  }

  const onChange = (name, value, validity) => {
    dispatchNewConfig({
      type: 'update',
      name: `south.${southIndex}.${name}`,
      value,
      validity,
    })
  }

  return (
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
          southId={id}
          southType={type}
          points={pointsOrdered}
          handleAdd={handleAdd}
          handleDelete={handleDelete}
          handleDeleteAllPoint={handleDeleteAllPoint}
          handleImportPoints={handleImportPoints}
          onUpdate={onChange}
        />
      </Container>
    </>
  )
}

export default ConfigurePoints
