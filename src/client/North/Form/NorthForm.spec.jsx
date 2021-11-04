/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import newConfig from '../../../../tests/testConfig'
import NorthForm from './NorthForm.jsx'

React.useContext = jest.fn().mockReturnValue({ newConfig })

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

describe('NorthForm', () => {
  newConfig.north.applications.forEach((application) => {
    test(`check NorthForm with application: ${application.name}`, () => {
      act(() => {
        ReactDOM.render(
          <NorthForm application={application} applicationIndex={0} onChange={() => 1} />,
          container,
        )
      })
      expect(container).toMatchSnapshot()
    })
  })

  test('check NorthForm with empty application', () => {
    act(() => {
      ReactDOM.render(
        <NorthForm application={{ api: 'Console', name: 'emptyApplication' }} applicationIndex={0} onChange={() => 1} />,
        container,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
