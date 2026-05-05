import { Routes, Route, Navigate } from "react-router";
import { useAuth } from "@/hooks/useAuth";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import TradeForm from "./pages/TradeForm";
import FriendView from "./pages/FriendView";
import { Toaster } from "sonner";

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[hsl(0,0%,6%)] flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "hsl(0, 0%, 12%)",
            color: "white",
            border: "1px solid hsl(0, 0%, 20%)",
          },
        }}
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <AuthGuard>
              <Dashboard />
            </AuthGuard>
          }
        />
        <Route
          path="/dashboard"
          element={
            <AuthGuard>
              <Dashboard />
            </AuthGuard>
          }
        />
        <Route
          path="/trades/new"
          element={
            <AuthGuard>
              <TradeForm />
            </AuthGuard>
          }
        />
        <Route path="/friend/:shareToken" element={<FriendView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
