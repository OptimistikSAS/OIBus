import FileIn from './images/file-in.svg'
import FileOut from './images/file-out.svg'
import Optimistik from './images/oi.svg'
import IoT from './images/iot.svg'
import Api from './images/api.svg'
import Debug from './images/debug.svg'
import DatabaseIn from './images/db-in.svg'
import DatabaseOut from './images/db-out.svg'

const imageCategories = {
  DatabaseIn: {
    image: DatabaseIn,
    label: 'Database',
  },
  DatabaseOut: {
    image: DatabaseOut,
    label: 'Database',
  },
  FileIn: {
    image: FileIn,
    label: 'File',
  },
  FileOut: {
    image: FileOut,
    label: 'File',
  },
  Api: {
    image: Api,
    label: 'Api',
  },
  Optimistik: {
    image: Optimistik,
    label: 'Optimistik',
  },
  IoT: {
    image: IoT,
    label: 'IoT',
  },
  Debug: {
    image: Debug,
    label: 'Debug',
  },
  Default: {
    image: Optimistik,
    label: 'Optimistik',
  },
}
export default imageCategories
