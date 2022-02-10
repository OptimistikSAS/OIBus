import React from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, Container, Spinner } from 'reactstrap'
import { FaArrowLeft } from 'react-icons/fa'
import { AlertContext } from '../context/AlertContext.jsx'
import { ConfigContext } from '../context/ConfigContext.jsx'
import utils from '../helpers/utils'
import PointsComponent from '../components/PointsComponent.jsx'
import StatusButton from '../StatusButton.jsx'

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
  const dataSourceIndex = newConfig.south.dataSources.findIndex(
    (dataSource) => dataSource.id === id,
  )
  const dataSource = newConfig.south.dataSources[dataSourceIndex]

  const { points: pointsOrdered = [], protocol } = dataSource

  /**
   * add point
   * @returns {void}
   */
  const handleAdd = () => {
    dispatchNewConfig({ type: 'addRow', name: `south.dataSources.${dataSourceIndex}.points`, value: {} })
  }

  /**
   * Delete point
   * @param {string} index the index of point
   * @returns {void}
   */
  const handleDelete = (index) => {
    dispatchNewConfig({ type: 'deleteRow', name: `south.dataSources.${dataSourceIndex}.points.${index}` })
  }

  /**
   * Delete all points
   * @returns {void}
   */
  const handleDeleteAllPoint = () => {
    dispatchNewConfig({ type: 'deleteAllRows', name: `south.dataSources.${dataSourceIndex}.points` })
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
            name: `south.dataSources.${dataSourceIndex}.points`,
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
      name: `south.dataSources.${dataSourceIndex}.${name}`,
      value,
      validity,
    })
  }

  return (
    <>
      <div className="d-flex align-items-center w-100 oi-sub-nav">
        <h6 className="text-muted d-flex align-items-center pl-3 pt-1">
          <Button
            id="oi-navigate"
            outline
            onClick={() => {
              navigate(-1)
            }}
            className="util-button"
          >
            <FaArrowLeft className="oi-back-icon mr-2" />
          </Button>
          {`| ${dataSource.name}`}
        </h6>
        <div className="pull-right mr-3">
          <StatusButton
            handler={() => {
              navigate(`/south/${id}/live`)
            }}
            enabled={dataSource.enabled}
          />
        </div>
      </div>
      <Container fluid>
        <PointsComponent
          southId={id}
          protocol={protocol}
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
