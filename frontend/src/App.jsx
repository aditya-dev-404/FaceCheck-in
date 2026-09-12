import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Enroll from "./pages/Enroll";
import Attendance from "./pages/Attendance";
import AddMember from "./pages/AddMember";
import ManageMembers from "./pages/ManageMembers";
import ManageOrganization from "./pages/ManageOrganization";
import Kiosk from "./pages/Kiosk";
import ProtectedRoute from "./components/ProtectedRoute";
import LandingPage from "./pages/LandingPage";
import PublicLayout from "./components/PublicLayout";
import PublicRoute from "./components/PublicRoute";
import SetPassword from "./pages/SetPassword";

function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        {/* Accessible to both guests and logged-in users */}
        <Route path="/" element={<LandingPage />} />

        {/* Accessible ONLY to unauthenticated guests */}
        <Route element={<PublicRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/set-password/:token" element={<SetPassword />} />
        </Route>
      </Route>

      <Route path="/kiosk" element={<Kiosk />} />

      {/* Accessible ONLY to logged-in users */}
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/enroll" element={<Enroll />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/add-member" element={<AddMember />} />
        <Route path="/manage-members" element={<ManageMembers />} />
        <Route path="/manage-organization" element={<ManageOrganization />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;