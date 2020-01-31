import React from 'react'
import ReactDOM from 'react-dom'
import { act } from 'react-dom/test-utils'

import Modal from './Modal.jsx'

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('Modal', () => {
  test('check Modal', () => {
    act(() => {
      ReactDOM.render(
        <Modal
          show
          title="title"
          body="body content"
          acceptLabel="accept"
          denyLabel="deny"
        >
          {() => (1)}
        </Modal>, container,
      )
    })
    expect(container).toMatchSnapshot()
  })
})
