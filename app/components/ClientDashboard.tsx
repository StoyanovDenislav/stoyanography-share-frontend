"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import MasonryPhotoGrid from "./MasonryPhotoGrid";
import CountdownTimer from "./CountdownTimer";

interface Photo {
  id: string;
  filename: string;
  originalName: string;
  shareToken: string;
  thumbnailDataB64: string;
  uploadedAt: string;
  size: number;
  selected?: boolean;
}

interface Guest {
  id: string;
  username: string;
  guestName: string;
  isActive: boolean;
  expiresAt: string;
  sharedPhotoCount: number;
}

interface Collection {
  collectionId: string;
  name: string;
  description: string;
  createdAt: string;
  photoCount?: number;
  thumbnailDataB64?: string | null;
  autoDeleteAt: string;
  daysRemaining: number;
}

const ClientDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<"collections" | "guests">(
    "collections"
  );
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(
    null
  );
  const [showCreateGuestForm, setShowCreateGuestForm] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Guest form state
  const [guestEmail, setGuestEmail] = useState("");
  const [guestName, setGuestName] = useState("");
  const [expirationDays, setExpirationDays] = useState(7);

  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:9001/api";

  // Initial data load on mount
  useEffect(() => {
    fetchCollections();
    fetchGuests();
  }, []); // Run once on mount

  // Fetch data when tab changes
  useEffect(() => {
    if (activeTab === "collections") {
      fetchCollections();
    } else if (activeTab === "guests") {
      fetchGuests();
    }
  }, [activeTab]);

  // Auto-refresh every 10 seconds to catch expiring collections
  useEffect(() => {
    const interval = setInterval(() => {
      console.log("🔄 Auto-refreshing client data...");
      if (activeTab === "collections") {
        fetchCollections();
      } else if (activeTab === "guests") {
        fetchGuests();
      }
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [activeTab]);

  const fetchPhotos = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/client/photos`);
      if (response.data.success) {
        setPhotos(
          response.data.photos.map((photo: Photo) => ({
            ...photo,
            selected: false,
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching photos:", error);
    }
  };

  const fetchGuests = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/client/guests`);
      if (response.data.success) {
        setGuests(response.data.guests);
      }
    } catch (error) {
      console.error("Error fetching guests:", error);
    }
  };

  const fetchCollections = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/client/collections`);
      if (response.data.success) {
        setCollections(response.data.collections);
      }
    } catch (error) {
      console.error("Error fetching collections:", error);
    }
  };

  // Refresh all data
  const refreshAll = async () => {
    console.log("🔄 Refreshing all client data...");
    await Promise.all([fetchPhotos(), fetchGuests(), fetchCollections()]);
    console.log("✅ Refresh complete");
  };

  const viewCollectionPhotos = async (collectionId: string) => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/client/collections/${collectionId}/photos`
      );
      if (response.data.success) {
        setPhotos(
          response.data.photos.map((photo: Photo) => ({
            ...photo,
            selected: false,
          }))
        );
        setSelectedCollection(collectionId);
        // Stay on collections tab, just show the collection's photos
      }
    } catch (error) {
      console.error("Error fetching collection photos:", error);
    }
  };

  const togglePhotoSelection = (photoId: string) => {
    setPhotos(
      photos.map((photo) =>
        photo.id === photoId ? { ...photo, selected: !photo.selected } : photo
      )
    );

    // Find the photo to get its shareToken
    const photo = photos.find((p) => p.id === photoId);
    if (!photo) return;

    setSelectedPhotos((prev) =>
      prev.includes(photo.shareToken)
        ? prev.filter((token) => token !== photo.shareToken)
        : [...prev, photo.shareToken]
    );
  };

  const selectAllPhotos = () => {
    const allSelected = selectedPhotos.length === photos.length;
    setPhotos(photos.map((photo) => ({ ...photo, selected: !allSelected })));
    setSelectedPhotos(
      allSelected ? [] : photos.map((photo) => photo.shareToken)
    );
  };

  const handleCreateGuest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedPhotos.length === 0) {
      setError("Please select at least one photo to share");
      return;
    }

    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/client/create-guest`, {
        email: guestEmail,
        guestName: guestName,
        photoIds: selectedPhotos,
        expirationDays: expirationDays,
      });

      if (response.data.success) {
        setSuccess(
          `Guest created successfully! Credentials sent to ${guestEmail}`
        );
        setGuestEmail("");
        setGuestName("");
        setSelectedPhotos([]);
        setPhotos(photos.map((photo) => ({ ...photo, selected: false })));
        setShowCreateGuestForm(false);
        await refreshAll(); // Refresh everything after creating guest
      }
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to create guest");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleGuestAccess = async (
    guestId: string,
    currentStatus: boolean
  ) => {
    try {
      setIsLoading(true);
      console.log("Toggling guest access:", { guestId, currentStatus });

      const response = await axios.patch(
        `${API_BASE_URL}/client/guests/${encodeURIComponent(
          guestId
        )}/toggle-access`
      );

      if (response.data.success) {
        setSuccess(
          `Guest access ${currentStatus ? "disabled" : "enabled"} successfully`
        );
        await refreshAll(); // Refresh everything after toggling access
      }
    } catch (error: any) {
      console.error("Toggle guest access error:", error);
      console.error("Error response:", error.response);
      setError(
        error.response?.data?.message || "Failed to toggle guest access"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadSelected = async () => {
    if (selectedPhotos.length === 0) {
      setError("Please select at least one photo to download");
      return;
    }

    try {
      setIsLoading(true);

      if (selectedPhotos.length === 1) {
        // Download single photo - selectedPhotos contains shareTokens
        const photo = photos.find((p) => p.shareToken === selectedPhotos[0]);
        if (!photo) return;

        const response = await axios.get(
          `${API_BASE_URL}/client/photos/${photo.shareToken}/download`,
          { responseType: "blob" }
        );

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", photo.originalName || "photo.jpg");
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        setSuccess("Photo downloaded successfully!");
      } else {
        // Download multiple photos as ZIP
        // selectedPhotos already contains shareTokens
        const response = await axios.post(
          `${API_BASE_URL}/client/photos/download-zip`,
          { photoTokens: selectedPhotos },
          { responseType: "blob" }
        );

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `photos-${Date.now()}.zip`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        setSuccess(`${selectedPhotos.length} photos downloaded successfully!`);
      }

      // Clear selection
      setSelectedPhotos([]);
      setPhotos(photos.map((p) => ({ ...p, selected: false })));
    } catch (error: any) {
      console.error("Download error:", error);
      setError(error.response?.data?.message || "Failed to download photos");
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatTimeLeft = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();

    if (diff <= 0) return "Expired";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) return `${days} day(s) left`;
    return `${hours} hour(s) left`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                👤 Client Portal
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Welcome {user?.clientName} - Share your photos with guests
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-4 py-3 rounded-md">
            {success}
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-md">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex">
              <button
                onClick={() => setActiveTab("collections")}
                className={`py-4 px-6 border-b-2 font-medium text-sm ${
                  activeTab === "collections"
                    ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                📁 Collections ({collections.length})
              </button>
              <button
                onClick={() => setActiveTab("guests")}
                className={`py-4 px-6 border-b-2 font-medium text-sm ${
                  activeTab === "guests"
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                👥 Shared with Guests ({guests.length})
              </button>
            </nav>
          </div>

          {/* Collections Tab */}
          {activeTab === "collections" && (
            <div>
              {selectedCollection ? (
                /* Viewing a specific collection's photos */
                <>
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h2 className="text-xl font-semibold text-gray-800">
                            Collection Photos
                          </h2>
                          <button
                            onClick={() => {
                              setSelectedCollection(null);
                              setPhotos([]);
                              setSelectedPhotos([]);
                            }}
                            className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                          >
                            ← Back to Collections
                          </button>
                        </div>
                        {selectedPhotos.length > 0 && (
                          <p className="text-sm text-indigo-600 mt-1">
                            {selectedPhotos.length} photo(s) selected
                          </p>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        {photos.length > 0 && (
                          <button
                            onClick={selectAllPhotos}
                            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition duration-200"
                          >
                            {photos.every((photo) => photo.selected)
                              ? "Deselect All"
                              : "Select All"}
                          </button>
                        )}
                        {selectedPhotos.length > 0 && (
                          <>
                            <button
                              onClick={handleDownloadSelected}
                              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition duration-200 flex items-center space-x-2"
                              disabled={isLoading}
                            >
                              <span>⬇️</span>
                              <span>
                                Download{" "}
                                {selectedPhotos.length > 1 ? "ZIP" : ""}
                              </span>
                            </button>
                            <button
                              onClick={() => {
                                alert(
                                  "This feature is coming very soon, I am working very hard ;3"
                                );
                              }}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition duration-200"
                            >
                              Share with Guest
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-4">
                    {photos.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">
                        No photos in this collection.
                      </p>
                    ) : (
                      <MasonryPhotoGrid
                        photos={photos}
                        onPhotoSelect={togglePhotoSelection}
                        selectable={true}
                        showDeleteButton={false}
                        userRole="client"
                      />
                    )}
                  </div>
                </>
              ) : (
                /* Viewing all collections */
                <>
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-800">
                      Shared Collections
                    </h2>
                    <p className="text-sm text-gray-600 mt-1">
                      View photo collections shared with you by your
                      photographer
                    </p>
                  </div>

                  <div className="px-6 py-4">
                    {collections.length === 0 ? (
                      <p className="text-gray-500 text-center py-8">
                        No collections shared yet. Your photographer will share
                        collections with you here.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {collections.map((collection) => (
                          <div
                            key={collection.collectionId}
                            className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer fade-in"
                            onClick={() =>
                              viewCollectionPhotos(collection.collectionId)
                            }
                          >
                            {/* Collection Thumbnail */}
                            <div className="w-full h-48 bg-gray-100 flex items-center justify-center">
                              {collection.thumbnailDataB64 ? (
                                <img
                                  src={`data:image/jpeg;base64,${collection.thumbnailDataB64}`}
                                  alt={collection.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="text-gray-400 text-center">
                                  <div className="text-4xl mb-2">📁</div>
                                  <div className="text-sm">No photos yet</div>
                                </div>
                              )}
                            </div>

                            <div className="p-6">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                  <h3 className="text-lg font-semibold text-gray-900">
                                    {collection.name}
                                  </h3>
                                  {collection.description && (
                                    <p className="text-sm text-gray-600 mt-1">
                                      {collection.description}
                                    </p>
                                  )}
                                </div>
                                {/* Auto-delete countdown timer */}
                                <CountdownTimer
                                  targetDate={collection.autoDeleteAt}
                                  className="ml-2"
                                />
                              </div>

                              <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                                <span className="flex items-center">
                                  📷 {collection.photoCount} photo(s)
                                </span>
                                <span className="text-xs">
                                  {new Date(
                                    collection.createdAt
                                  ).toLocaleDateString()}
                                </span>
                              </div>

                              <div>
                                <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition-medium transform-smooth hover:-translate-y-0.5 text-sm">
                                  View Photos
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Guests Tab */}
          {activeTab === "guests" && (
            <div>
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">
                  Guest Access Management
                </h2>
              </div>

              <div className="px-6 py-4">
                {guests.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No guests created yet. Select photos and share them with
                    guests!
                  </p>
                ) : (
                  <div className="space-y-4">
                    {guests.map((guest) => (
                      <div
                        key={guest.id}
                        className={`bg-gray-50 rounded-lg p-4 flex justify-between items-center border-2 ${
                          guest.isActive
                            ? "border-green-200"
                            : "border-gray-300 opacity-60"
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">
                              {guest.guestName}
                            </h3>
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                guest.isActive
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {guest.isActive ? "Active" : "Disabled"}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            Username:{" "}
                            <span className="font-mono">{guest.username}</span>
                          </p>
                          <p className="text-sm text-gray-600">
                            Shared {guest.sharedPhotoCount} photo(s)
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Expires:{" "}
                            {new Date(guest.expiresAt).toLocaleDateString()}
                            {guest.isActive &&
                              ` (${formatTimeLeft(guest.expiresAt)})`}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              handleToggleGuestAccess(guest.id, guest.isActive)
                            }
                            disabled={isLoading}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition duration-200 ${
                              guest.isActive
                                ? "bg-red-600 hover:bg-red-700 text-white"
                                : "bg-green-600 hover:bg-green-700 text-white"
                            } disabled:opacity-50`}
                            title={
                              guest.isActive
                                ? "Revoke access"
                                : "Restore access"
                            }
                          >
                            {guest.isActive
                              ? "🚫 Revoke Access"
                              : "✅ Restore Access"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create Guest Modal */}
      {showCreateGuestForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Share Photos with Guest
            </h3>

            <form onSubmit={handleCreateGuest} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Guest Email
                </label>
                <input
                  type="email"
                  value={guestEmail}
                  onChange={(e) => setGuestEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="guest@example.com"
                  required
                  disabled={isLoading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Credentials will be sent here (email not stored for privacy)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Guest Name
                </label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Guest Name"
                  required
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Access Duration
                </label>
                <select
                  value={expirationDays}
                  onChange={(e) => setExpirationDays(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={isLoading}
                >
                  <option value={1}>1 day</option>
                  <option value={3}>3 days</option>
                  <option value={7}>1 week</option>
                  <option value={14}>2 weeks</option>
                  <option value={30}>1 month</option>
                </select>
              </div>

              <div className="bg-blue-50 p-3 rounded-md">
                <p className="text-sm text-blue-800">
                  Sharing {selectedPhotos.length} photo(s) with temporary access
                </p>
              </div>

              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowCreateGuestForm(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition duration-200"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-md disabled:opacity-50 transition duration-200"
                >
                  {isLoading ? "Creating..." : "Share Photos"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientDashboard;
