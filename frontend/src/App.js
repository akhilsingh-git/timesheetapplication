import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/AppLayout";
import Login from "./pages/Login";
import TimesheetPage from "./pages/TimesheetPage";
import ApprovalsPage from "./pages/ApprovalsPage";
import AdminPage from "./pages/AdminPage";
import { AuthProvider, useAuth } from "./context/AuthContext";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  return user ? children : <Navigate to="/login" />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      
      <Route path="/" element={
        <PrivateRoute>
          <AppLayout />
        </PrivateRoute>
      }>
        <Route index element={<TimesheetPage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="admin" element={<AdminPage />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
