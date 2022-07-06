import React from 'react'
import { Spinner } from 'reactstrap'
import { PropTypes } from 'prop-types'
import MonacoEditor from '@monaco-editor/react'

const ConfigJsonRenderer = ({ loading, activeConfig, newConfig, isModified }) => {
  const monacoEditorOptions = {
    selectOnLineNumbers: true,
    minimap: { enabled: false },
    scrollbar: { alwaysConsumeMouseWheel: false },
    readOnly: true,
  }

  return (
    <>
      {loading ? (
        <div className="spinner-container">
          <Spinner color="primary" />
        </div>
      ) : null}
      {activeConfig && !loading && (
        <div>
          <h5>Active configuration</h5>
          <MonacoEditor
            language="javascript"
            theme="vs"
            height="400px"
            value={JSON.stringify(activeConfig, null, 2)}
            options={monacoEditorOptions}
          />
        </div>
      )}
      {newConfig && isModified && !loading && (
        <div>
          <h5>New configuration</h5>
          <MonacoEditor
            language="json"
            theme="vs"
            height="400px"
            value={JSON.stringify(newConfig, null, 2)}
            options={monacoEditorOptions}
          />
        </div>
      )}
    </>
  )
}

ConfigJsonRenderer.propTypes = {
  loading: PropTypes.bool,
  activeConfig: PropTypes.oneOfType([
    PropTypes.object,
    PropTypes.arrayOf(PropTypes.object),
  ]).isRequired,
  newConfig: PropTypes.oneOfType([
    PropTypes.object,
    PropTypes.arrayOf(PropTypes.object),
  ]).isRequired,
  isModified: PropTypes.bool.isRequired,
}

ConfigJsonRenderer.defaultProps = { loading: null }

export default ConfigJsonRenderer
