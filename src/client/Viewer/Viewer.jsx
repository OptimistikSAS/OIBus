import React from 'react'
import { Link } from 'react-router-dom'
import { List, Breadcrumb, BreadcrumbItem } from 'reactstrap'
import { AlertContext } from '../context/AlertContext.jsx'

const Viewer = () => {
  const [messages, setMessages] = React.useState([])
  const { setAlert } = React.useContext(AlertContext)
  React.useEffect(() => {
    const source = new EventSource('sse')
    source.onerror = (error) => {
      setAlert(error)
    }
    source.onmessage = (event) => {
      setMessages((prevMessages) => [...prevMessages, event.data])
    }
    return (() => source.close())
  }, [])

  return (
    <>
      <Breadcrumb tag="h5">
        <BreadcrumbItem tag={Link} to="/" className="oi-breadcrumb">
          Home
        </BreadcrumbItem>
        <BreadcrumbItem active tag="span">
          Viewer
        </BreadcrumbItem>
      </Breadcrumb>
      <List>
        {messages.map((message) => <li key={message}>{message}</li>)}
      </List>
    </>
  )
}
export default Viewer
