import { Navigate, Route, Routes } from 'react-router-dom'
import Gallery from './Gallery.jsx'
import FounderHome from './founder/FounderHome.jsx'
import { Shell } from './shell/index.jsx'

export default function V2App() {
  return (
    <Routes>
      <Route index element={<Navigate to="home" replace />} />
      <Route path="gallery" element={<Gallery />} />
      <Route path="founder" element={<FounderHome />} />
      <Route path=":module" element={<Shell />} />
      <Route path="*" element={<Navigate to="home" replace />} />
    </Routes>
  )
}
