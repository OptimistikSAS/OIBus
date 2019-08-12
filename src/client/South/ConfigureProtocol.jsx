import React from 'react'
import { withRouter } from 'react-router-dom'
import { Spinner } from 'reactstrap'
import PropTypes from 'prop-types'
import { ConfigContext } from '../context/configContext.jsx'
import SouthForm from './Form/SouthForm.jsx'

const ConfigureProtocol = ({ match }) => {
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  const dataSources = newConfig && newConfig.south.dataSources // array of all defined dataSources
  const { dataSourceId } = match.params // the dataSourceId passed in the url
  const dataSourceIndex = dataSources && dataSources.findIndex((dataSource) => dataSource.dataSourceId === dataSourceId)

  const onChange = (name, value, validity) => {
    // add the proper index
    dispatchNewConfig({ type: 'update', name: `south.dataSources.${dataSourceIndex}.${name}`, value, validity })
  }

  return dataSources ? (
    <SouthForm dataSource={dataSources[dataSourceIndex]} onChange={onChange} />
  ) : (
    <div className="spinner-container">
      <Spinner color="primary" type="grow" />
      ...loading configuration from OIBus server...
    </div>
  )
}

ConfigureProtocol.propTypes = { match: PropTypes.object.isRequired }
export default withRouter(ConfigureProtocol)
