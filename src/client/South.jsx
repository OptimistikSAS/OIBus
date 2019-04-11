import React from 'react'
import { withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'
import ConfigService from './services/configService'
import Table from './components/table/Table.jsx'
import Select from './components/Select.jsx'
import Input from './components/Input.jsx'

const tableHeaders = ['Equipment ID', 'Enabled', 'Protocol']

const South = ({ history }) => {
  const [configJson, setConfigJson] = React.useState()
  const [tableRows, setTableRows] = React.useState()
  const [newRowData, setNewRowData] = React.useState({})
  const [protocolList, setProtocolList] = React.useState()
  const buttonRef = React.useRef()

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

  React.useEffect(() => {
    ConfigService.getSouthProtocols().then((protocols) => {
      setProtocolList(protocols)
      setNewRowData({ equipmentId: '', enabled: false, protocol: protocols[0] })
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
   * Update the equipment's state if any value changed
   * @param {object} event The event object of the change
   * @returns {void}
   */
  const handleChange = (event) => {
    const {
      target,
      target: { type, name },
    } = event
    let value

    //  set the value field based on the event's type
    switch (type) {
      case 'checkbox':
        value = target.checked
        break
      default:
        ({ value } = target)
        break
    }

    //  update the new equipment's state
    setNewRowData(prevState => ({ ...prevState, [name]: value }))
  }

  /**
   * @returns {array} An array with the needed components
   */
  const createNewRow = () => [
    <Input name="equipmentId" type="text" onChange={handleChange} />,
    <Input name="enabled" type="checkbox" onChange={handleChange} />,
    <Select name="protocol" options={protocolList} onChange={handleChange} />,
  ]

  /**
   * Handles the click of the table rows and redirects the
   * user to the selected south equipment's configuration page
   * @param {array} equipment Data of the clicked row
   * @return {void}
   */
  const handleRowClick = (equipment) => {
    const [equipmentId] = equipment
    let formData
    if (typeof equipmentId === 'string') {
      formData = getEquipmentData(equipmentId)
    } else {
      formData = { ...newRowData }
    }

    // return if no id is provided
    if (formData.equipmentId.length < 1) return
    const link = `/south/${formData.protocol}`
    history.push({ pathname: link, formData })
  }

  /**
   * A new row is added and the button will become disabled
   * @returns {void}
   */
  const handleButtonClick = () => {
    const newRows = [...tableRows]
    const newRow = createNewRow()
    newRows.push(newRow)
    setTableRows(newRows)
    buttonRef.current.setAttribute('disabled', 'disabled')
  }

  return (
    <>
      {tableRows && <Table headers={tableHeaders} rows={tableRows} onRowClick={handleRowClick} />}
      <button ref={buttonRef} type="button" className="btn btn-primary" onClick={handleButtonClick}>
        Add equipment
      </button>
      <pre>{configJson && JSON.stringify(configJson, ' ', 2)}</pre>
    </>
  )
}

South.propTypes = { history: PropTypes.object.isRequired }

export default withRouter(South)
