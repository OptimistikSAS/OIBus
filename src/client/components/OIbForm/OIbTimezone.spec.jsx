import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import OIbTimezone from './OIbTimezone.jsx'
import { notEmpty } from '../../../services/validation.service'

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('OIbTimezone', () => {
  test('check Select with value="Europe/Paris"', () => {
    act(() => {
      ReactDOM.render(<OIbTimezone
        name="name"
        label="label"
        onChange={() => (1)}
        value="Europe/Paris"
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check OIbTimezone with value="Europe/Paris" and no label', () => {
    act(() => {
      ReactDOM.render(<OIbTimezone
        name="name"
        onChange={() => (1)}
        value="Europe/Paris"
        defaultValue="default text"
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check OIbTimezone with value="Europe/Paris" and help', () => {
    act(() => {
      ReactDOM.render(<OIbTimezone
        name="name"
        label="label"
        help={<div>helpt text</div>}
        onChange={() => (1)}
        value="Europe/Paris"
        defaultValue="default text"
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check OIbTimezone with value="" and valid funtion', () => {
    act(() => {
      ReactDOM.render(<OIbTimezone
        name="name"
        label="label"
        onChange={() => (1)}
        value=""
        valid={notEmpty()}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
  test('check change', () => {
    const onChange = jest.fn()
    act(() => {
      ReactDOM.render(<OIbTimezone
        name="name"
        label="label"
        onChange={onChange}
        value=""
        valid={notEmpty()}
      />, container)
    })
    Simulate.change(document.querySelector('select'), { target: { value: 'new_value' } })
    expect(onChange).toBeCalled()
    expect(container).toMatchSnapshot()
  })
})
