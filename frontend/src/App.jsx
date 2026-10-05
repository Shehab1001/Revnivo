import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import { useAuth } from './contexts/AuthContext'
import Dashboard from './pages/Dashboard'
import Earnings from './pages/Earnings'
import Login from './pages/Login'
import Platforms from './pages/Platforms'
import Payments from './pages/Payments'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import Notes from './pages/Notes'
import Settings from './pages/Settings'
import AdminUsers from './pages/AdminUsers'
import Subscriptions from './pages/Subscriptions'
import SupportChat from './pages/SupportChat'
import Landing from './pages/Landing'
import Jobs from './pages/Jobs'
import Applications from './pages/Applications'
import ApplicationWorkspace from './pages/ApplicationWorkspace'
import ResumeStudio from './pages/ResumeStudio'

function Protected({ children }) {
  const { isAuthenticated, sessionChecked } = useAuth()

  if (!sessionChecked) {
    return null
  }

  return isAuthenticated
    ? children
    : <Navigate to="/login" replace />
}

function AdminOnly({ children }) {
  const { user, sessionChecked } = useAuth()

  if (!sessionChecked) {
    return null
  }

  const isAdmin =
    user?.role === 'admin' ||
    user?.email?.toLowerCase() ===
      'dev.shehabsaid@gmail.com'

  return isAdmin
    ? children
    : <Navigate to="/dashboard" replace />
}

function PublicOnly({ children }) {
  const { isAuthenticated, sessionChecked } = useAuth()

  if (!sessionChecked) {
    return null
  }

  return isAuthenticated
    ? <Navigate to="/dashboard" replace />
    : children
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing/>} />
      <Route path="/login" element={<PublicOnly><Login/></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register/></PublicOnly>} />
      <Route path="/forgot-password" element={<PublicOnly><ForgotPassword/></PublicOnly>} />
      <Route element={<Protected><AppShell/></Protected>}>
        <Route path="/dashboard" element={<Dashboard/>}/>
        <Route path="/platforms" element={<Platforms/>}/>
        <Route path="/earnings" element={<Earnings/>}/>
        <Route path="/payments" element={<Payments/>}/>
        <Route path="/notes" element={<Notes/>}/>
        <Route path="/jobs" element={<Jobs/>}/>
        <Route path="/jobs/applications" element={<Applications/>}/>
        <Route path="/jobs/applications/:applicationId" element={<ApplicationWorkspace/>}/>
        <Route path="/jobs/resume-studio" element={<ResumeStudio/>}/>
        <Route path="/applications" element={<Navigate to="/jobs/applications" replace/>}/>
        <Route path="/applications/:applicationId" element={<ApplicationWorkspace/>}/>
        <Route path="/settings" element={<Settings/>}/>
        <Route path="/admin/users" element={<AdminOnly><AdminUsers/></AdminOnly>}/>
        <Route path="/admin/subscriptions" element={<AdminOnly><Subscriptions/></AdminOnly>}/>
        <Route path="/support-chat" element={<SupportChat/>}/>
      </Route>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
  )
}
