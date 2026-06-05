import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppProviders } from "./components/providers";
import { AppLayout } from "./components/AppSidebar";
import AnchorPage from "./pages/anchors";
import ImportPage from "./pages/import/index";
import NotFoundPage from "./pages/not-found";
import { getToken, redirectToLogin } from "@/lib/auth";
import "./app.css";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = getToken();
  if (!token) {
    redirectToLogin();
    return null;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AppProviders>
      <BrowserRouter basename={import.meta.env.VITE_BASE}>
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
      </BrowserRouter>
    </AppProviders>
  );
}
