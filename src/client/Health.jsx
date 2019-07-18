import React from 'react'
import { Label } from 'reactstrap'

import packageJson from '../../package.json'

const Health = () => {
  React.useEffect(() => {
  }, [])

  return (
    <div>
      <Label>{`Version ${packageJson.version}`}</Label>
    </div>
  )
}
export default Health
