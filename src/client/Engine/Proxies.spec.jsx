import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import testConfig from '../../../tests/testConfig'
import Proxies from './Proxies.jsx'

const mockMath = Object.create(global.Math)
mockMath.random = () => 1
global.Math = mockMath

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('Proxies', () => {
  test('check Proxies', () => {
    act(() => {
      ReactDOM.render(<Proxies
        proxies={testConfig.engine.proxies}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })
})
