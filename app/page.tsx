"use client";

import { useAuth } from "./context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import UnifiedLogin from "./components/UnifiedLogin";
import AdminDashboard from "./components/AdminDashboard";
import PhotographerDashboard from "./components/PhotographerDashboard";
import ClientDashboard from "./components/ClientDashboard";
import GuestDashboard from "./components/GuestDashboard";

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Check if user must change password
    if (user && typeof window !== "undefined") {
      const mustChangePassword = localStorage.getItem("mustChangePassword");
      if (mustChangePassword === "true") {
        router.push("/change-password");
      }
    }
  }, [user, router]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">
            Loading Stoyanography Share...
          </p>
        </div>
      </div>
    );
  }

  // Show login if not authenticated
  if (!user) {
    return <UnifiedLogin />;
  }

  // Route to appropriate dashboard based on user role
  switch (user.role) {
    case "admin":
      return <AdminDashboard />;
    case "photographer":
      return <PhotographerDashboard />;
    case "client":
      return <ClientDashboard />;
    case "guest":
      return <GuestDashboard />;
    default:
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Unknown Role
            </h2>
            <p className="text-gray-600 mb-6">
              Your account role is not recognized.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-md transition duration-200"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
  }
}
