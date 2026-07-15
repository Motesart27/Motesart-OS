import { Navigate, Route, Routes } from 'react-router-dom'
import Gallery from './Gallery.jsx'
import { Shell } from './shell/index.jsx'

export default function V2App() {
  return (
    <Routes>
      <Route index element={<Navigate to="home" replace />} />
      <Route path="gallery" element={<Gallery />} />
      <Route path=":module" element={<Shell />} />
      <Route path="*" element={<Navigate to="home" replace />} />
    </Routes>
  )
}
