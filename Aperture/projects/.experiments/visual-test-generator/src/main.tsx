import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { RepairReview } from './components/RepairReview'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RepairReview />} />
        <Route path="/repairs" element={<RepairReview />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)
