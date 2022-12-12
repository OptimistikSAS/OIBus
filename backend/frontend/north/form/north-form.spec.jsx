/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import { testConfig } from '../../../tests/test-config.js'
import NorthForm from './north-form.jsx'

const mockNavigate = jest.fn()

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: jest.fn().mockReturnValue({ id: 'north-id' }),
}))

React.useContext = jest.fn().mockReturnValue({ newConfig: testConfig })

const mockMath = Object.create(global.Math)
mockMath.random = () => 1
global.Math = mockMath

let container
let root
// eslint-disable-next-line no-undef
globalThis.IS_REACT_ACT_ENVIRONMENT = true
beforeEach(() => {
  container = document.createElement('div')
  root = ReactDOMClient.createRoot(container)
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
  root = null
})

describe('NorthForm', () => {
  testConfig.north.forEach((north) => {
    test(`check NorthForm with North connector: ${north.name}`, () => {
      act(() => {
        root.render(
          <NorthForm north={north} northIndex={0} onChange={() => 1} />,
        )
      })
      expect(container).toMatchSnapshot()
    })
  })

  test('check NorthForm with empty North connector', () => {
    act(() => {
      root.render(
        <NorthForm north={{ type: 'Console', name: 'emptyNorth', settings: {} }} northIndex={0} onChange={() => 1} />,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
