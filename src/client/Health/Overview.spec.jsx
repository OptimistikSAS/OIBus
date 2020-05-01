import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

// need BrowserRouter so Link component is not complaining
import { BrowserRouter } from 'react-router-dom'

import Overview from './Overview.jsx'

import activeConfig from '../../../tests/testConfig'

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

React.useContext = jest.fn().mockReturnValue({ activeConfig })

describe('Overview', () => {
  test('display overview based on config', () => {
    act(() => {
      ReactDOM.render(<BrowserRouter><Overview status={{ version: 'xxx' }} /></BrowserRouter>, container)
    })
    expect(container).toMatchSnapshot()
  })
})
