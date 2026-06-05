import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppProviders } from "./components/providers";
import { AppLayout } from "./components/AppSidebar";
import AnchorPage from "./pages/anchors";
import ImportPage from "./pages/import/index";
import NotFoundPage from "./pages/not-found";
import LoginPage from "./pages/login";
import { getToken } from "@/lib/auth";
import "./app.css";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = getToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter basename={import.meta.env.VITE_BASE}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="*"
            element={
              <AuthGuard>
                <AppLayout>
                  <Routes>
                    <Route path="/" element={<AnchorPage />} />
                    <Route path="/anchors" element={<AnchorPage />} />
                    <Route path="/import" element={<ImportPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Routes>
                </AppLayout>
              </AuthGuard>
            }
          />
        </Routes>
      </BrowserRouter>
    </AppProviders>
  );
}
