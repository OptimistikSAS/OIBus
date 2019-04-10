import React from 'react'
import { withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'
import ConfigService from './services/configService'
import Table from './components/table/Table.jsx'

const tableHeaders = ['Equipment ID', 'Enabled', 'Protocol']

const South = ({ history }) => {
  const [configJson, setConfigJson] = React.useState()
  const [tableRows, setTableRows] = React.useState()

  /**
   * Sets the content of the table
   * @param {object} config The configuration json
   * @returns {void} no return value
   */
  const createTableRows = (config) => {
    const array = []
    config.equipments.forEach((equipment) => {
      const { equipmentId, enabled, protocol } = equipment
      array.push([equipmentId, enabled.toString(), protocol])
    })

    setTableRows(array)
  }

  React.useEffect(() => {
    ConfigService.getConfig().then(({ config }) => {
      setConfigJson(config.south)
      createTableRows(config.south)
    })
  }, [])

  /**
   * Gets the config json of a south equipment
   * @param {string} equipmentId ID of an equipment
   * @returns {object} The selected equipment's config
   */
  const getEquipmentData = (equipmentId) => {
    let formData = {}
    configJson.equipments.forEach((equipment) => {
      if (equipment.equipmentId === equipmentId) {
        formData = equipment
      }
    })

    return formData
  }

  /**
   * Handles the click of the table rows and redirects the
   * user to the selected south equipment's configuration page
   * @param {array} equipment Data of the clicked row
   * @return {void}
   */
  const handleClick = (equipment) => {
    const [equipmentId] = equipment
    const formData = getEquipmentData(equipmentId)
    const link = `/south/${formData.protocol}`
    history.push({ pathname: link, formData })
  }

  return (
    <>
      {tableRows && <Table headers={tableHeaders} rows={tableRows} onRowClick={handleClick} />}
      <pre>{configJson && JSON.stringify(configJson, ' ', 2)}</pre>
    </>
  )
}

South.propTypes = { history: PropTypes.object.isRequired }

export default withRouter(South)
