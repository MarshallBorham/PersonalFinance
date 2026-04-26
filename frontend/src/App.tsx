import { Routes, Route, Navigate } from "react-router";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import OnboardingPage from "./pages/OnboardingPage";
import DashboardPage from "./pages/DashboardPage";
import RetirementPage from "./pages/RetirementPage";
import BudgetPage from "./pages/BudgetPage";
import NetWorthPage from "./pages/NetWorthPage";
import GoalsPage from "./pages/GoalsPage";
import PortfolioPage from "./pages/PortfolioPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, onboardingComplete } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (!onboardingComplete) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function OnboardingRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, onboardingComplete } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (onboardingComplete) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login"      element={<LoginPage />} />
      <Route path="/register"   element={<RegisterPage />} />
      <Route path="/onboarding" element={<OnboardingRoute><OnboardingPage /></OnboardingRoute>} />
      <Route path="/"           element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
      <Route path="/retirement" element={<ProtectedRoute><RetirementPage /></ProtectedRoute>} />
      <Route path="/budget"     element={<ProtectedRoute><BudgetPage /></ProtectedRoute>} />
      <Route path="/networth"   element={<ProtectedRoute><NetWorthPage /></ProtectedRoute>} />
      <Route path="/goals"      element={<ProtectedRoute><GoalsPage /></ProtectedRoute>} />
      <Route path="/portfolio"  element={<ProtectedRoute><PortfolioPage /></ProtectedRoute>} />
      <Route path="*"           element={<Navigate to="/" replace />} />
    </Routes>
  );
}
