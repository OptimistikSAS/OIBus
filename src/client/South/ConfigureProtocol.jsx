import React from 'react'
import { withRouter } from 'react-router-dom'
import { Spinner } from 'reactstrap'
import PropTypes from 'prop-types'
import { ConfigContext } from '../context/configContext.jsx'
import SouthForm from './Form/SouthForm.jsx'

const ConfigureProtocol = ({ match, history }) => {
  const { newConfig, dispatchNewConfig } = React.useContext(ConfigContext)
  const dataSources = newConfig && newConfig.south.dataSources // array of all defined dataSources
  const { dataSourceId, index } = match.params // the dataSourceId passed in the url or index passed
  const dataSourceIndex = index
    ? Number(index) : dataSources && dataSources.findIndex((dataSource) => dataSource.dataSourceId === dataSourceId)
  // create list with other datasource name, for rename error
  const otherDataSources = dataSources.filter((e, i) => i !== dataSourceIndex).map((dataSource) => dataSource.dataSourceId)

  const onChange = (name, value, validity) => {
    if (name === 'dataSourceId') {
      const link = `/south/dataSourceIndex/${dataSourceIndex}`
      history.push({ pathname: link })
    }

    dispatchNewConfig({ type: 'update', name: `south.dataSources.${dataSourceIndex}.${name}`, value, validity })
  }

  return dataSources ? (
    <SouthForm
      otherDataSources={otherDataSources}
      dataSource={dataSources[dataSourceIndex]}
      dataSourceIndex={dataSourceIndex}
      onChange={onChange}
    />
  ) : (
    <div className="spinner-container">
      <Spinner color="primary" type="grow" />
      ...loading configuration from OIBus server...
    </div>
  )
}

ConfigureProtocol.propTypes = { match: PropTypes.object.isRequired, history: PropTypes.object.isRequired }
export default withRouter(ConfigureProtocol)
