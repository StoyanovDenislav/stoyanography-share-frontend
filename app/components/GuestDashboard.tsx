"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { useSSE } from "../hooks/useSSE";

interface Photo {
  id: string;
  filename: string;
  originalName: string;
  thumbnailDataB64: string;
  photoDataB64: string;
  uploadedAt: string;
  size: number;
  mimetype: string;
}

const GuestDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:6002/api";

  // Server-Sent Events for real-time updates
  useSSE({
    onPhotoEvent: () => {
      fetchPhotos();
    },
    onConnected: () => {
      console.log("✅ Guest real-time updates connected");
    },
  });

  useEffect(() => {
    fetchPhotos();
  }, []);

  // Fallback polling every 15 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      console.log("🔄 Periodic refresh (15min fallback)...");
      fetchPhotos();
    }, 15 * 60 * 1000); // 15 minutes

    return () => clearInterval(interval);
  }, []);

  const fetchPhotos = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/guest/photos`);
      if (response.data.success) {
        setPhotos(response.data.photos);
      }
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to fetch photos");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadPhoto = async (photo: Photo) => {
    try {
      // Convert base64 to blob
      const byteCharacters = atob(photo.photoDataB64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: photo.mimetype });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = photo.originalName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
      setError("Failed to download photo");
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatTimeLeft = () => {
    if (!user?.expiresAt) return "No expiration";

    const now = new Date();
    const expiry = new Date(user.expiresAt);
    const diff = expiry.getTime() - now.getTime();

    if (diff <= 0) return "Access expired";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) return `${days} day(s), ${hours} hour(s) left`;
    if (hours > 0) return `${hours} hour(s), ${minutes} minute(s) left`;
    return `${minutes} minute(s) left`;
  };

  const isExpired = () => {
    if (!user?.expiresAt) return false;
    return new Date() > new Date(user.expiresAt);
  };

  if (isExpired()) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="text-red-500 text-6xl mb-4">⏰</div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Access Expired
            </h2>
            <p className="text-gray-600 mb-6">
              Your temporary access to these photos has expired.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Please contact the person who shared these photos with you if you
              need extended access.
            </p>
            <button
              onClick={logout}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-md transition duration-200"
            >
              Return to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                👥 Guest Access
              </h1>
              <p className="text-gray-600">
                Welcome {user?.guestName} - View your shared photos
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm text-gray-600">Access expires in:</p>
                <p className="text-sm font-semibold text-orange-600">
                  {formatTimeLeft()}
                </p>
              </div>
              <button
                onClick={logout}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition duration-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {/* Info Banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
          <div className="flex items-center">
            <div className="text-blue-500 text-xl mr-3">ℹ️</div>
            <div>
              <h3 className="text-blue-800 font-semibold">Temporary Access</h3>
              <p className="text-blue-700 text-sm">
                You have temporary access to {photos.length} photo(s). You can
                view and download them before your access expires.
              </p>
            </div>
          </div>
        </div>

        {/* Photo Gallery */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">
              📷 Shared Photos ({photos.length})
            </h2>
          </div>

          <div className="px-6 py-4">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
              </div>
            ) : photos.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No photos available. The client hasn't shared any photos with
                you yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {photos.map((photo) => (
                  <div key={photo.id} className="group relative">
                    <div
                      className="aspect-square bg-gray-200 rounded-lg overflow-hidden cursor-pointer"
                      onClick={() => setSelectedPhoto(photo)}
                    >
                      <img
                        src={`data:image/jpeg;base64,${photo.thumbnailDataB64}`}
                        alt={photo.originalName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    </div>

                    {/* Overlay with download button */}
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity duration-200 rounded-lg flex items-center justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadPhoto(photo);
                        }}
                        className="opacity-0 group-hover:opacity-100 bg-white text-gray-800 px-3 py-2 rounded-md text-sm font-medium transition-opacity duration-200 hover:bg-gray-100"
                      >
                        📥 Download
                      </button>
                    </div>

                    <div className="mt-2">
                      <p
                        className="text-xs text-gray-600 truncate"
                        title={photo.originalName}
                      >
                        {photo.originalName}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatFileSize(photo.size)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Photo Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="max-w-4xl max-h-full bg-white rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {selectedPhoto.originalName}
                </h3>
                <p className="text-sm text-gray-500">
                  {formatFileSize(selectedPhoto.size)} •{" "}
                  {new Date(selectedPhoto.uploadedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadPhoto(selectedPhoto);
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition duration-200"
                >
                  📥 Download
                </button>
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition duration-200"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            <div className="p-4 max-h-96 overflow-auto">
              <img
                src={`data:${selectedPhoto.mimetype};base64,${selectedPhoto.photoDataB64}`}
                alt={selectedPhoto.originalName}
                className="max-w-full h-auto mx-auto"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuestDashboard;
