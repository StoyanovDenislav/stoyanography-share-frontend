"use client";

import { useState, useEffect } from "react";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";

interface Photo {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  shareToken: string;
  shareUrl: string;
  uploadedAt: string;
}

interface PhotoGalleryProps {
  token: string;
}

const API_BASE_URL = "http://localhost:9001/api";

export default function PhotoGallery({ token }: PhotoGalleryProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPhotos = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/photos/my-photos`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.data.success) {
        setPhotos(response.data.photos);
      }
    } catch (error: any) {
      console.error("Fetch photos error:", error);
      const message = error.response?.data?.message || "Failed to load photos";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const deletePhoto = async (photoId: string) => {
    if (!confirm("Are you sure you want to delete this photo?")) {
      return;
    }

    try {
      const response = await axios.delete(`${API_BASE_URL}/photos/${photoId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const message =
        response.data.message ||
        "Photo marked for deletion. It will be permanently deleted in 7 days.";
      toast.success(message);
      setPhotos(photos.filter((photo) => photo.id !== photoId));
    } catch (error: any) {
      console.error("Delete photo error:", error);
      const message = error.response?.data?.message || "Failed to delete photo";
      toast.error(message);
    }
  };

  const copyShareLink = (shareUrl: string) => {
    navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied to clipboard!");
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    fetchPhotos();

    // Listen for photo upload events to refresh the gallery
    const handlePhotoUploaded = () => {
      fetchPhotos();
    };

    window.addEventListener("photoUploaded", handlePhotoUploaded);
    return () =>
      window.removeEventListener("photoUploaded", handlePhotoUploaded);
  }, [token]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <svg
              className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <p className="text-gray-600">Loading your photos...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <Toaster position="top-right" />

      <div className="flex justify-between items-center mb-6">
        <h3 className="text-xl font-bold text-gray-800">Your Photo Gallery</h3>
        <span className="text-sm text-gray-500">
          {photos.length} photo{photos.length !== 1 ? "s" : ""}
        </span>
      </div>

      {photos.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto text-gray-300 mb-4">
            <svg fill="none" stroke="currentColor" viewBox="0 0 48 48">
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h4 className="text-lg font-medium text-gray-600 mb-2">
            No photos yet
          </h4>
          <p className="text-gray-500">
            Upload your first photo to get started!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-square relative bg-gray-100">
                <img
                  src={photo.shareUrl}
                  alt={photo.originalName}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>

              <div className="p-4">
                <h4
                  className="font-medium text-gray-800 mb-2 truncate"
                  title={photo.originalName}
                >
                  {photo.originalName}
                </h4>

                <div className="text-sm text-gray-500 space-y-1 mb-3">
                  <p>Size: {formatFileSize(photo.size)}</p>
                  <p>Uploaded: {formatDate(photo.uploadedAt)}</p>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => copyShareLink(photo.shareUrl)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm py-2 px-3 rounded transition-colors"
                  >
                    📋 Copy Share Link
                  </button>

                  <div className="flex gap-2">
                    <a
                      href={photo.shareUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-2 px-3 rounded text-center transition-colors"
                    >
                      👁️ View
                    </a>

                    <button
                      onClick={() => deletePhoto(photo.id)}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm py-2 px-3 rounded transition-colors"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
