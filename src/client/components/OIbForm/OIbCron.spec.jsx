/**
 * @jest-environment jsdom
 */
import React from 'react'
import ReactDOM from 'react-dom'
import { act, Simulate } from 'react-dom/test-utils'

import OIbCron from './OIbCron.jsx'

let container
beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  document.body.removeChild(container)
  container = null
})

describe('OIbCron', () => {
  test('check Cron with value="* * * /10"', () => {
    act(() => {
      ReactDOM.render(<OIbCron
        name="name"
        value="* * * /10"
        onChange={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })

  test('check Cron with value="listen"', () => {
    act(() => {
      ReactDOM.render(<OIbCron
        name="name"
        value="listen"
        onChange={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })

  test('check Cron with value="* * w1-5 /3"', () => {
    act(() => {
      ReactDOM.render(<OIbCron
        name="name"
        value="* * w1-5 /3"
        onChange={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })

  test('check Cron with label', () => {
    act(() => {
      ReactDOM.render(<OIbCron
        name="name"
        value="* * * /10"
        onChange={() => (1)}
        label="label"
      />, container)
    })
    expect(container).toMatchSnapshot()
  })

  test('check Cron with no value', () => {
    act(() => {
      ReactDOM.render(<OIbCron
        name="name"
        onChange={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })

  test('check Cron with invalid value', () => {
    act(() => {
      ReactDOM.render(<OIbCron
        name="name"
        value="* * * /invalid"
        onChange={() => (1)}
      />, container)
    })
    expect(container).toMatchSnapshot()
  })

  test('check change cron type to every', () => {
    const onChange = jest.fn()
    act(() => {
      ReactDOM.render(<OIbCron
        name="name"
        value="listen"
        onChange={onChange}
        defaultValue="* * * * * *"
      />, container)
    })
    Simulate.change(document.getElementById('name.type'), { target: { value: 'every', selectedIndex: 0 } })
    expect(onChange).toBeCalledWith('name', '* * * * * *', null)
    expect(container).toMatchSnapshot()
  })

  test('check change cron interval when type is every', () => {
    const onChange = jest.fn()
    act(() => {
      ReactDOM.render(<OIbCron
        name="name"
        value="* * * * * *"
        onChange={onChange}
        defaultValue="* * * * * *"
      />, container)
    })
    Simulate.change(document.getElementById('name.interval'), { target: { value: 'hour', selectedIndex: 3 } })
    expect(onChange).toBeCalledWith('name', '* * * *', null)
    expect(container).toMatchSnapshot()
  })

  test('check change cron type to custom', () => {
    const onChange = jest.fn()
    act(() => {
      ReactDOM.render(<OIbCron
        name="name"
        value="* * * /10"
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('name.type'), { target: { value: 'custom', selectedIndex: 1 } })
    expect(onChange).toBeCalledWith('name', '', null)
    expect(container).toMatchSnapshot()
  })

  test('check change cron type to invalide', () => {
    const onChange = jest.fn()
    act(() => {
      ReactDOM.render(<OIbCron
        name="name"
        value="* * * /10"
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('name.type'), { target: { value: 'invalide' } })
    expect(container).toMatchSnapshot()
  })

  test('check Cron custom value change', () => {
    const onChange = jest.fn()
    act(() => {
      ReactDOM.render(<OIbCron
        name="name"
        value="* * w1-5 /3"
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('name.custom'), { target: { value: '* * w1-5' } })
    expect(onChange).toBeCalledWith('name', '* * w1-5', null)
    expect(container).toMatchSnapshot()
  })

  test('check Cron every value change', () => {
    const onChange = jest.fn()
    act(() => {
      ReactDOM.render(<OIbCron
        name="name"
        value="* * * /10"
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('name.every.value'), { target: { value: '1' } })
    expect(onChange).toBeCalledWith('name', '* * * *', null)
    expect(container).toMatchSnapshot()
  })

  test('check Cron every value change to 0', () => {
    const onChange = jest.fn()
    act(() => {
      ReactDOM.render(<OIbCron
        name="name"
        value="* * * /10"
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('name.every.value'), { target: { value: '0' } })
    expect(container).toMatchSnapshot()
  })

  test('check change cron type to same type', () => {
    const onChange = jest.fn()
    act(() => {
      ReactDOM.render(<OIbCron
        name="name"
        value="custom"
        onChange={onChange}
      />, container)
    })
    Simulate.change(document.getElementById('name.type'), { target: { value: 'custom', selectedIndex: 1 } })
    expect(container).toMatchSnapshot()
  })
})
