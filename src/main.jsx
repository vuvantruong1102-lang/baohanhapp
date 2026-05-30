import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import WarrantyPage from './pages/WarrantyPage.jsx'
import AdminPage from './pages/AdminPage.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/tamayoko" replace />} />
        <Route path="/:brand" element={<WarrantyPage />} />
        <Route path="/admin/import" element={<AdminPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
