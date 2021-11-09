import React from 'react'
import { Spinner } from 'reactstrap'

import PropTypes from 'prop-types'
import { AlertContext } from '../../context/AlertContext.jsx'
import { ConfigContext } from '../../context/configContext.jsx'
import utils from '../../helpers/utils'
import { HistoryConfigContext } from '../../context/historyContext.jsx'
import PointsComponent from '../../components/PointsComponent.jsx'

const PointsSection = ({ query, queryIndex }) => {
  const { newConfig } = React.useContext(ConfigContext)
  const { dispatchNewHistoryConfig } = React.useContext(HistoryConfigContext)

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
  const { points: pointsOrdered = [] } = query

  /**
   * add point
   * @returns {void}
   */
  const handleAdd = () => {
    dispatchNewHistoryConfig({ type: 'addRow', name: `${queryIndex}.points`, value: {} })
  }

  /**
   * Delete point
   * @param {string} index the index of point
   * @returns {void}
   */
  const handleDelete = (index) => {
    dispatchNewHistoryConfig({ type: 'deleteRow', name: `${queryIndex}.points.${index}` })
  }

  /**
   * Delete all points
   * @returns {void}
   */
  const handleDeleteAllPoint = () => {
    dispatchNewHistoryConfig({ type: 'deleteAllRows', name: `${queryIndex}.points` })
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
          dispatchNewHistoryConfig({
            type: 'importPoints',
            name: `${queryIndex}.points`,
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
    dispatchNewHistoryConfig({
      type: 'update',
      name: `${queryIndex}.${name}`,
      value,
      validity,
    })
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
  queryIndex: PropTypes.number.isRequired,
  query: PropTypes.object.isRequired,
}

export default PointsSection
