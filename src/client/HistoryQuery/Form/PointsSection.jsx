import React from 'react'
import { Spinner } from 'reactstrap'

import PropTypes from 'prop-types'
import { AlertContext } from '../../context/AlertContext.jsx'
import { ConfigContext } from '../../context/ConfigContext.jsx'
import utils from '../../helpers/utils'
import PointsComponent from '../../components/PointsComponent.jsx'

const PointsSection = ({ query, handleAddPoint }) => {
  const { newConfig } = React.useContext(ConfigContext)

  const { setAlert } = React.useContext(AlertContext)

  if (!newConfig?.south) {
    return (
      <div className="spinner-container">
        <Spinner color="primary" type="grow" />
        ...loading points from OIBus server...
      </div>
    )
  }
  const dataSourceIndex = newConfig.south.dataSources.findIndex(
    (dataSource) => dataSource.id === query.southId,
  )
  const dataSource = newConfig.south.dataSources[dataSourceIndex]

  const { protocol } = dataSource
  const { points: pointsOrdered = [] } = query.settings

  /**
   * add point
   * @returns {void}
   */
  const handleAdd = async () => {
    // dispatchNewHistoryConfig({ type: 'addRow', name: `${queryIndex}.points`, value: {} })
    handleAddPoint()
  }

  /**
   * Delete point
   * @param {string} _index the index of point
   * @returns {void}
   */
  const handleDelete = (_index) => {
    // dispatchNewHistoryConfig({ type: 'deleteRow', name: `${queryIndex}.points.${index}` })
  }

  /**
   * Delete all points
   * @returns {void}
   */
  const handleDeleteAllPoint = () => {
    // dispatchNewHistoryConfig({ type: 'deleteAllRows', name: `${queryIndex}.points` })
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
        .then((_newPoints) => {
          // dispatchNewHistoryConfig({
          //   type: 'importPoints',
          //   name: `${queryIndex}.points`,
          //   value: newPoints,
          // })
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

  const onChange = (_name, _value, _validity) => {
    // dispatchNewHistoryConfig({
    //   type: 'update',
    //   name: `${queryIndex}.${name}`,
    //   value,
    //   validity,
    // })
  }

  return (
    <PointsComponent
      southId={query.southId}
      protocol={protocol}
      points={pointsOrdered}
      handleAdd={handleAdd}
      handleDelete={handleDelete}
      handleDeleteAllPoint={handleDeleteAllPoint}
      handleImportPoints={handleImportPoints}
      onUpdate={onChange}
    />
  )
}

PointsSection.propTypes = {
  query: PropTypes.object.isRequired,
  handleAddPoint: PropTypes.func.isRequired,
}

export default PointsSection
