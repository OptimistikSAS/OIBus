import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { FormFeedback, FormGroup, FormText, Input, Label } from 'reactstrap'
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'

const REBOUND_TIMEOUT = 350

const OibTextArea = ({ label, contentType, help, valid, value, name, onChange, defaultValue }) => {
  const [editor, setEditor] = useState(null)

  React.useEffect(() => {
    if (value === null) {
      onChange(name, defaultValue)
      if (editor) {
        editor.setValue(defaultValue)
      }
    }
  }, [value, defaultValue, editor])

  useEffect(() => {
    let monacoEditor
    let reboundTimeout
    if (contentType) {
      monacoEditor = monaco.editor.create(document.getElementById('monaco-editor'), {
        value: value === null ? defaultValue : value,
        language: contentType,
        theme: 'vs',
        selectOnLineNumbers: true,
        minimap: { enabled: false },
        scrollbar: { alwaysConsumeMouseWheel: false },
      })
      monacoEditor.onDidChangeModelContent(() => {
        if (reboundTimeout) {
          clearTimeout(reboundTimeout)
        }

        reboundTimeout = setTimeout(() => {
          const newRequest = monacoEditor.getValue()
          onChange(name, newRequest, valid(newRequest))
        }, REBOUND_TIMEOUT)
      })
      setEditor(monacoEditor)
    }
    return () => {
      if (reboundTimeout) {
        clearTimeout(reboundTimeout)
        if (monacoEditor) {
          const newRequest = monacoEditor.getValue()
          onChange(name, newRequest, valid(newRequest))
        }
      }
      if (monacoEditor) {
        monacoEditor.dispose()
      }
    }
  }, [contentType])

  const handleInputChange = (event) => {
    const { target } = event
    const { value: newVal } = target
    onChange(name, newVal, valid(newVal))
  }

  const validCheck = valid(value)
  return (
    <FormGroup>
      {label && <Label for={name}>{label}</Label>}
      {!contentType && (
      <>
        <Input
          className="oi-form-input"
          type="textarea"
          id={name}
          name={name}
          invalid={validCheck !== null}
          onChange={handleInputChange}
          value={value || ''}
        />
        <FormFeedback>{validCheck}</FormFeedback>
        {help && <FormText>{help}</FormText>}
      </>
      )}
      {contentType && (
      <>
        <div className="invalid-feedback">{validCheck}</div>
        {help && <div className="mb-2"><FormText>{help}</FormText></div>}
        <div id="monaco-editor" style={{ height: '400px' }} />
      </>
      )}
    </FormGroup>
  )
}
OibTextArea.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  contentType: PropTypes.string,
  help: PropTypes.element,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  defaultValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  valid: PropTypes.func,
}
OibTextArea.defaultProps = {
  valid: () => null,
  label: null,
  contentType: null,
  help: null,
  value: null,
  defaultValue: '',
}

export default OibTextArea
