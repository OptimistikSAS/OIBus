import React from 'react'
import { Spinner } from 'reactstrap'
import ReactJson from 'react-json-view'
import { PropTypes } from 'prop-types'

const ConfigJsonRenderer = ({ loading, activeConfig, newConfig, isModified }) => (
  <>
    {loading ? (
      <div className="spinner-container">
        <Spinner color="primary" />
      </div>
    ) : null}
    {activeConfig && (
    <ReactJson
      src={activeConfig}
      name="Active configuration"
      collapsed
      displayObjectSize={false}
      displayDataTypes={false}
      enableClipboard
      collapseStringsAfterLength={100}
      style={{ marginBottom: '15px' }}
    />
    )}
    {newConfig && isModified && (
    <ReactJson
      src={newConfig}
      name="New configuration"
      collapsed
      displayObjectSize={false}
      displayDataTypes={false}
      enableClipboard
      collapseStringsAfterLength={100}
      style={{ marginBottom: '15px' }}
    />
    )}
  </>
)

ConfigJsonRenderer.propTypes = {
  loading: PropTypes.bool,
  activeConfig: PropTypes.object.isRequired,
  newConfig: PropTypes.object.isRequired,
  isModified: PropTypes.bool.isRequired,
}

ConfigJsonRenderer.defaultProps = { loading: null }

export default ConfigJsonRenderer
