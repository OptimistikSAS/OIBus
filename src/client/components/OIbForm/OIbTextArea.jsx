import React from 'react'
import PropTypes from 'prop-types'
import { FormFeedback, FormGroup, FormText, Input, Label } from 'reactstrap'
import MonacoEditor from '@monaco-editor/react'

const OIbTextArea = ({ label, contentType, help, valid, value, name, onChange, defaultValue }) => {
  React.useEffect(() => {
    if (value === null) onChange(name, defaultValue)
  }, [value])
  const handleInputChange = (event) => {
    const { target } = event
    const { value: newVal } = target
    onChange(name, newVal, valid(newVal))
  }

  const handleMonacoEditorChange = (newRequest) => {
    onChange(name, newRequest, valid(newRequest))
  }

  const monacoEditorOptions = {
    selectOnLineNumbers: true,
    minimap: { enabled: false },
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
        <MonacoEditor
          language={contentType}
          theme="vs"
          height="400px"
          value={value}
          options={monacoEditorOptions}
          onChange={handleMonacoEditorChange}
        />
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
