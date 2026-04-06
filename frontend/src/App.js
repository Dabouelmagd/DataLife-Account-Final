import { useEffect } from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import axios from "axios";
import LandingPage from "./components/LandingPage";
import DemoPage from "./components/DemoPage";
import LoginPage from "./components/LoginPage";
import CompanyRegistrationPage from "./components/CompanyRegistrationPage";
import RealDashboard from "./components/RealDashboard";
import CompanySettings from "./components/CompanySettings";
import UserManagement from "./components/UserManagement";
import PermissionsManager from "./components/PermissionsManager";
import SubscriptionPage from "./components/SubscriptionPage";
import SubscriptionSuccess from "./components/SubscriptionSuccess";
import AdminDashboard from "./components/AdminDashboard";
import AdminLogin from "./components/AdminLogin";
import CustomerPortal from "./components/CustomerPortal";
import FeaturesPage from "./components/FeaturesPage";
import SupportChatbot from "./components/SupportChatbot";
import NotificationPermissionRequest from "./components/NotificationPermissionRequest";
import JournalEntriesPage from "./pages/JournalEntriesPage";
import GeneralLedgerPage from "./pages/GeneralLedgerPage";
import FinancialReportsPage from "./pages/FinancialReportsPage";
import InvoicesPage from "./pages/InvoicesPage";
import PartiesPage from "./pages/PartiesPage";
import ProductsPage from "./pages/ProductsPage";
import PaymentPage from "./pages/PaymentPage";
import PayPalSimulatePage from "./pages/PayPalSimulatePage";
import { LanguageProvider } from "./contexts/LanguageContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { PermissionsProvider } from "./contexts/PermissionsContext";
import { ThemeProvider } from "./contexts/ThemeContext";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const Home = () => {
  const helloWorldApi = async () => {
    try {
      await axios.get(`${API}/`);
    } catch (e) {
      // API health check failed
    }
  };

  useEffect(() => {
    helloWorldApi();
  }, []);

  return <LandingPage />;
};

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

function App() {
  return (
    <LanguageProvider>
    <ThemeProvider>
      <AuthProvider>
        <PermissionsProvider>
          <div className="App">
            <BrowserRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/demo" element={<DemoPage onClose={() => window.history.back()} />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register-company" element={<CompanyRegistrationPage />} />
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <RealDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/settings" 
                element={
                  <ProtectedRoute>
                    <CompanySettings />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/user-management" 
                element={
                  <ProtectedRoute>
                    <UserManagement />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/permissions/:userId" 
                element={
                  <ProtectedRoute>
                    <PermissionsManager />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/subscription" 
                element={
                  <ProtectedRoute>
                    <SubscriptionPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/subscription/success" 
                element={
                  <ProtectedRoute>
                    <SubscriptionSuccess />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin-login" 
                element={<AdminLogin />} 
              />
              <Route 
                path="/admin" 
                element={
                  <ProtectedRoute>
                    <AdminDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/admin-dashboard" 
                element={
                  <ProtectedRoute>
                    <AdminDashboard />
                  </ProtectedRoute>
                } 
              />
              <Route path="/customer-portal" element={<CustomerPortal />} />
              {/* Accounting Module Routes */}
              <Route 
                path="/journal-entries" 
                element={
                  <ProtectedRoute>
                    <JournalEntriesPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/general-ledger" 
                element={
                  <ProtectedRoute>
                    <GeneralLedgerPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/financial-reports" 
                element={
                  <ProtectedRoute>
                    <FinancialReportsPage />
                  </ProtectedRoute>
                } 
              />
              {/* Invoicing Module Routes */}
              <Route 
                path="/invoices" 
                element={
                  <ProtectedRoute>
                    <InvoicesPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/parties" 
                element={
                  <ProtectedRoute>
                    <PartiesPage />
                  </ProtectedRoute>
                } 
              />
              <Route 
                path="/products" 
                element={
                  <ProtectedRoute>
                    <ProductsPage />
                  </ProtectedRoute>
                } 
              />
              {/* Payment Routes */}
              <Route path="/payment" element={<PaymentPage />} />
              <Route path="/payment/paypal-simulate" element={<PayPalSimulatePage />} />
            </Routes>
            {/* Support Chatbot - appears on all pages */}
            <SupportChatbot />
            {/* Notification Permission Request */}
            <NotificationPermissionRequest />
          </BrowserRouter>
          </div>
        </PermissionsProvider>
      </AuthProvider>
    </ThemeProvider>
    </LanguageProvider>
  );
}

export default App;