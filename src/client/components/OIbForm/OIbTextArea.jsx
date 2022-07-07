import React, { useEffect } from 'react'
import PropTypes from 'prop-types'
import { FormFeedback, FormGroup, FormText, Input, Label } from 'reactstrap'
import * as monaco from 'monaco-editor'

const REBOUND_TIMEOUT = 350

const OIbTextArea = ({ label, contentType, help, valid, value, name, onChange, defaultValue }) => {
  React.useEffect(() => {
    if (value === null) onChange(name, defaultValue)
  }, [value])

  useEffect(() => {
    let editor
    let reboundTimeout
    if (contentType) {
      editor = monaco.editor.create(document.getElementById('monaco-editor'), {
        value,
        language: contentType,
        theme: 'vs',
        selectOnLineNumbers: true,
        minimap: { enabled: false },
        scrollbar: { alwaysConsumeMouseWheel: false },
      })
      editor.onDidChangeModelContent(() => {
        if (reboundTimeout) {
          clearTimeout(reboundTimeout)
        }

        reboundTimeout = setTimeout(() => {
          const newRequest = editor.getValue()
          onChange(name, newRequest, valid(newRequest))
        }, REBOUND_TIMEOUT)
      })
    }
    return () => {
      if (reboundTimeout) {
        clearTimeout(reboundTimeout)
        if (editor) {
          const newRequest = editor.getValue()
          onChange(name, newRequest, valid(newRequest))
        }
      }
      if (editor) {
        editor.dispose()
      }
    }
  }, [value, contentType])

  const handleInputChange = (event) => {
    const { target } = event
    const { value: newVal } = target
    onChange(name, newVal, valid(newVal))
  }

  const validCheck = valid(value)
  // if value is null, no need to render
  if (value === null) return null
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
          value={value}
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
OIbTextArea.propTypes = {
  name: PropTypes.string.isRequired,
  label: PropTypes.string,
  contentType: PropTypes.string,
  help: PropTypes.element,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  defaultValue: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  valid: PropTypes.func,
}
OIbTextArea.defaultProps = {
  valid: () => null,
  label: null,
  contentType: null,
  help: null,
  value: null,
  defaultValue: '',
}

export default OIbTextArea
