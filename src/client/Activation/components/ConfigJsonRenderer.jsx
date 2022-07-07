import React, { useEffect } from 'react'
import { Spinner } from 'reactstrap'
import { PropTypes } from 'prop-types'
import * as monaco from 'monaco-editor'

const ConfigJsonRenderer = ({ loading, activeConfig, newConfig, isModified }) => {
  useEffect(() => {
    let editor
    if (activeConfig && !loading) {
      editor = monaco.editor.create(document.getElementById('active-config'), {
        value: JSON.stringify(activeConfig, null, 2),
        language: 'json',
        theme: 'vs',
        selectOnLineNumbers: true,
        minimap: { enabled: false },
        scrollbar: { alwaysConsumeMouseWheel: false },
        readOnly: true,
      })
    }
    return () => {
      if (editor) {
        editor.dispose()
      }
    }
  }, [activeConfig, loading])

  useEffect(() => {
    let editor
    if (newConfig && isModified && !loading) {
      editor = monaco.editor.create(document.getElementById('new-config'), {
        value: JSON.stringify(newConfig, null, 2),
        language: 'json',
        theme: 'vs',
        selectOnLineNumbers: true,
        minimap: { enabled: false },
        scrollbar: { alwaysConsumeMouseWheel: false },
        readOnly: true,
      })
    }
    return () => {
      if (editor) {
        editor.dispose()
      }
    }
  }, [newConfig, loading, isModified])

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
          <div id="active-config" style={{ height: '400px' }} />
        </div>
      )}
      {newConfig && isModified && !loading && (
        <div>
          <h5>New configuration</h5>
          <div id="new-config" style={{ height: '400px' }} />
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
