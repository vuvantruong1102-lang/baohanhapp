import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import WarrantyPage from './pages/WarrantyPage.jsx'
import AdminPage from './pages/AdminPage.jsx'
import Dashboard from './pages/Dashboard.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/tamayoko" replace />} />
        <Route path="/admin" element={<Dashboard />} />
        <Route path="/admin/import" element={<AdminPage />} />
        <Route path="/:brand" element={<WarrantyPage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
