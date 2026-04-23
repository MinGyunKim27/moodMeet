import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { MeetingPage } from './pages/MeetingPage'
import { DemoPage } from './pages/DemoPage'
import { MyMeetingsPage } from './pages/MyMeetingsPage'
import { SummaryPage } from './pages/SummaryPage'
import { SettingsPage } from './pages/SettingsPage'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/demo" element={<DemoPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/my-meetings" element={<MyMeetingsPage />} />
        <Route path="/meeting/:meetingId" element={<MeetingPage />} />
        <Route path="/meeting/:meetingId/summary" element={<SummaryPage />} />
      </Routes>
    </BrowserRouter>
  )
}
