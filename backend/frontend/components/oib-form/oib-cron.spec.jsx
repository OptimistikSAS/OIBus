/**
 * @jest-environment jsdom
 */
import React from 'react'
import { act, Simulate } from 'react-dom/test-utils'

import * as ReactDOMClient from 'react-dom/client'
import OibCron from './oib-cron.jsx'

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

describe('OIbCron', () => {
  test('check Cron with value="* * * /10"', () => {
    act(() => {
      root.render(<OibCron
        name="name"
        value="* * * /10"
        onChange={() => (1)}
      />)
    })
    expect(container).toMatchSnapshot()
  })

  test('check Cron with value="listen"', () => {
    act(() => {
      root.render(<OibCron
        name="name"
        value="listen"
        onChange={() => (1)}
      />)
    })
    expect(container).toMatchSnapshot()
  })

  test('check Cron with value="* * w1-5 /3"', () => {
    act(() => {
      root.render(<OibCron
        name="name"
        value="* * w1-5 /3"
        onChange={() => (1)}
      />)
    })
    expect(container).toMatchSnapshot()
  })

  test('check Cron with label', () => {
    act(() => {
      root.render(<OibCron
        name="name"
        value="* * * /10"
        onChange={() => (1)}
        label="label"
      />)
    })
    expect(container).toMatchSnapshot()
  })

  test('check Cron with no value', () => {
    act(() => {
      root.render(<OibCron
        name="name"
        onChange={() => (1)}
      />)
    })
    expect(container).toMatchSnapshot()
  })

  test('check Cron with invalid value', () => {
    act(() => {
      root.render(<OibCron
        name="name"
        value="* * * /invalid"
        onChange={() => (1)}
      />)
    })
    expect(container).toMatchSnapshot()
  })

  test('check change cron type to every', () => {
    const onChange = jest.fn()
    act(() => {
      root.render(<OibCron
        name="name"
        value="listen"
        onChange={onChange}
        defaultValue="* * * * * *"
      />)
    })
    act(() => {
      Simulate.change(document.getElementById('name.type'), { target: { value: 'every', selectedIndex: 0 } })
    })

    expect(onChange).toBeCalledWith('name', '* * * * * *', null)
    expect(container).toMatchSnapshot()
  })

  test('check change cron interval when type is every', () => {
    const onChange = jest.fn()
    act(() => {
      root.render(<OibCron
        name="name"
        value="* * * * * *"
        onChange={onChange}
        defaultValue="* * * * * *"
      />)
    })
    act(() => {
      Simulate.change(document.getElementById('name.interval'), { target: { value: 'hour', selectedIndex: 3 } })
    })
    expect(onChange).toBeCalledWith('name', '* * * *', null)
    expect(container).toMatchSnapshot()
  })

  test('check change cron type to custom', () => {
    const onChange = jest.fn()
    act(() => {
      root.render(<OibCron
        name="name"
        value="* * * /10"
        onChange={onChange}
      />)
    })
    act(() => {
      Simulate.change(document.getElementById('name.type'), { target: { value: 'custom', selectedIndex: 1 } })
    })

    expect(onChange).toBeCalledWith('name', '', null)
    expect(container).toMatchSnapshot()
  })

  test('check change cron type to invalide', () => {
    const onChange = jest.fn()
    act(() => {
      root.render(<OibCron
        name="name"
        value="* * * /10"
        onChange={onChange}
      />)
    })
    act(() => {
      Simulate.change(document.getElementById('name.type'), { target: { value: 'invalide' } })
    })

    expect(container).toMatchSnapshot()
  })

  test('check Cron custom value change', () => {
    const onChange = jest.fn()
    act(() => {
      root.render(<OibCron
        name="name"
        value="* * w1-5 /3"
        onChange={onChange}
      />)
    })
    act(() => {
      Simulate.change(document.getElementById('name.custom'), { target: { value: '* * w1-5' } })
    })

    expect(onChange).toBeCalledWith('name', '* * w1-5', null)
    expect(container).toMatchSnapshot()
  })

  test('check Cron every value change', () => {
    const onChange = jest.fn()
    act(() => {
      root.render(<OibCron
        name="name"
        value="* * * /10"
        onChange={onChange}
      />)
    })
    act(() => {
      Simulate.change(document.getElementById('name.every.value'), { target: { value: '1' } })
    })

    expect(onChange).toBeCalledWith('name', '* * * *', null)
    expect(container).toMatchSnapshot()
  })

  test('check Cron every value change to 0', () => {
    const onChange = jest.fn()
    act(() => {
      root.render(<OibCron
        name="name"
        value="* * * /10"
        onChange={onChange}
      />)
    })
    act(() => {
      Simulate.change(document.getElementById('name.every.value'), { target: { value: '0' } })
    })

    expect(container).toMatchSnapshot()
  })

  test('check change cron type to same type', () => {
    const onChange = jest.fn()
    act(() => {
      root.render(<OibCron
        name="name"
        value="custom"
        onChange={onChange}
      />)
    })
    act(() => {
      Simulate.change(document.getElementById('name.type'), { target: { value: 'custom', selectedIndex: 1 } })
    })

    expect(container).toMatchSnapshot()
  })
})
