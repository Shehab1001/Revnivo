import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import { useAuth } from './contexts/AuthContext'
import Dashboard from './pages/Dashboard'
import Earnings from './pages/Earnings'
import Login from './pages/Login'
import Platforms from './pages/Platforms'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import Notes from './pages/Notes'
import Settings from './pages/Settings'
import AdminUsers from './pages/AdminUsers'
import Subscriptions from './pages/Subscriptions'
import SupportChat from './pages/SupportChat'

function Protected({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

function PublicOnly({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <Navigate to="/" replace /> : children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login/></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register/></PublicOnly>} />
      <Route path="/forgot-password" element={<PublicOnly><ForgotPassword/></PublicOnly>} />
      <Route element={<Protected><AppShell/></Protected>}>
        <Route path="/" element={<Dashboard/>}/>
        <Route path="/platforms" element={<Platforms/>}/>
        <Route path="/earnings" element={<Earnings/>}/>
        <Route path="/notes" element={<Notes/>}/>
        <Route path="/settings" element={<Settings/>}/>
        <Route path="/admin/users" element={<AdminUsers/>}/>
        <Route path="/admin/subscriptions" element={<Subscriptions/>}/>
        <Route path="/support-chat" element={<SupportChat/>}/>
      </Route>
      <Route path="*" element={<Navigate to="/" replace/>}/>
    </Routes>
  )
}
