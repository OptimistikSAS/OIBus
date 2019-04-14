import React from 'react'
import { withRouter } from 'react-router-dom'
import PropTypes from 'prop-types'
import ReactJson from 'react-json-view'
import ConfigService from './services/configService'
import Table from './components/table/Table.jsx'
import Select from './components/Select.jsx'
import Input from './components/Input.jsx'

const tableHeaders = ['Application ID', 'Enabled', 'API']

const North = ({ history }) => {
  const [configJson, setConfigJson] = React.useState()
  const [tableRows, setTableRows] = React.useState()
  const [newRowData, setNewRowData] = React.useState({})
  const [apiList, setApiList] = React.useState()
  const buttonRef = React.useRef()

  /**
   * Sets the content of the table
   * @param {object} config The configuration json
   * @returns {void} no return value
   */
  const createTableRows = (config) => {
    const array = []
    config.applications.forEach((application) => {
      const { applicationId, enabled, api } = application
      array.push([applicationId, enabled.toString(), api])
    })

    setTableRows(array)
  }

  React.useEffect(() => {
    ConfigService.getConfig().then(({ config }) => {
      setConfigJson(config.north)
      createTableRows(config.north)
    })
  }, [])

  React.useEffect(() => {
    ConfigService.getNorthApis().then((apis) => {
      setApiList(apis)
      setNewRowData({ applicationId: '', enabled: false, api: apis[0] })
    })
  }, [])

  /**
   * Gets the config json of a north application
   * @param {string} applicationId ID of an application
   * @returns {object} The selected application's config
   */
  const getApplicationData = (applicationId) => {
    let formData = {}
    configJson.applications.forEach((application) => {
      if (application.applicationId === applicationId) {
        formData = application
      }
    })

    return formData
  }

  /**
   * Update the applications's state if any value changed
   * @param {object} event The event object of the change
   * @returns {void}
   */
  const handleChange = (event) => {
    const {
      target,
      target: { type, name },
    } = event

    const value = (type === 'checkbox') ? target.checked : target.value

    //  update the new application's state
    setNewRowData(prevState => ({ ...prevState, [name]: value }))
  }

  /**
   * @returns {array} An array with the needed components
   */
  const createNewRow = () => [
    <Input name="applicationId" type="text" onChange={handleChange} />,
    <Input name="enabled" type="checkbox" onChange={handleChange} />,
    <Select name="api" options={apiList} onChange={handleChange} />,
  ]

  /**
   * Handles the click of the table rows and redirects the
   * user to the selected north application's configuration page
   * @param {array} application Data of the clicked row
   * @return {void}
   */
  const handleRowClick = (application) => {
    const [applicationId] = application
    let formData
    if (typeof equipmentId === 'string') {
      formData = getApplicationData(applicationId)
    } else {
      formData = { ...newRowData }
    }

    // return if no id is provided
    if (formData.equipmentId.length < 1) return
    const link = `/north/${formData.api}`
    history.push({ pathname: link, formData })
  }

  /**
   * Handles the click of the table rows and redirects the
   * user to the selected north application's configuration page
   * @param {array} equipment Data of the clicked row
   * @return {void}
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
        Add application
      </button>
      <ReactJson src={configJson} name={null} collapsed displayObjectSize={false} displayDataTypes={false} enableClipboard={false} />
    </>
  )
}
North.propTypes = { history: PropTypes.object.isRequired }

export default withRouter(North)
