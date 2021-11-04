import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { Spinner, Breadcrumb, BreadcrumbItem } from 'reactstrap'

import { AlertContext } from '../context/AlertContext.jsx'
import { ConfigContext } from '../context/configContext.jsx'
import utils from '../helpers/utils'
import PointsComponent from '../components/PointsComponent.jsx'

const ConfigurePoints = () => {
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  const { setAlert } = React.useContext(AlertContext)
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
    <div className="points">
      <Breadcrumb tag="h5">
        <BreadcrumbItem tag={Link} to="/" className="oi-breadcrumb">
          Home
        </BreadcrumbItem>
        <BreadcrumbItem tag={Link} to="/south" className="oi-breadcrumb">
          South
        </BreadcrumbItem>
        <BreadcrumbItem tag={Link} to={`/south/${id}`} className="oi-breadcrumb">
          {dataSource.name}
        </BreadcrumbItem>
        <BreadcrumbItem active tag="span">
          Points
        </BreadcrumbItem>
      </Breadcrumb>
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
    </div>
  )
}

export default ConfigurePoints
