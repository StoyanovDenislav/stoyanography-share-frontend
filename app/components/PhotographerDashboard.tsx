"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import MasonryPhotoGrid from "./MasonryPhotoGrid";
import DarkModeToggle from "./DarkModeToggle";
import CountdownTimer from "./CountdownTimer";
import { useSSE } from "../hooks/useSSE";

interface Client {
  id: string;
  username: string;
  clientName: string;
  isActive: boolean;
  createdAt: string;
}

interface Photo {
  id: string;
  filename: string;
  originalName: string;
  shareToken: string;
  uploadedAt: string;
  size: number;
  thumbnailDataB64: string;
  collectionId?: string;
  selected?: boolean;
}

interface Collection {
  collectionId: string;
  name: string;
  description: string;
  createdAt: string;
  photoCount: number;
  thumbnailDataB64?: string | null;
  autoDeleteAt: string;
  daysRemaining: number;
}

const PhotographerDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<
    "clients" | "photos" | "collections"
  >("clients");
  const [clients, setClients] = useState<Client[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedCollection, setSelectedCollection] = useState<string | null>(
    null
  );
  const [showCreateClientForm, setShowCreateClientForm] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showCreateCollectionForm, setShowCreateCollectionForm] =
    useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showUploadShareModal, setShowUploadShareModal] = useState(false);
  const [collectionToShare, setCollectionToShare] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Client form state
  const [clientEmail, setClientEmail] = useState("");
  const [clientName, setClientName] = useState("");

  // Photo upload state
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadToCollection, setUploadToCollection] = useState<string>("");
  const [shareWithClients, setShareWithClients] = useState<string[]>([]);
  const [expiryMinutes, setExpiryMinutes] = useState<number>(0); // 0 = 30 seconds default

  // Collection form state
  const [collectionName, setCollectionName] = useState("");
  const [collectionDescription, setCollectionDescription] = useState("");

  // Photo selection state for downloading
  const [selectedPhotosForDownload, setSelectedPhotosForDownload] = useState<
    string[]
  >([]);

  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:6002/api";

  // Server-Sent Events for real-time updates
  useSSE({
    onPhotoEvent: (event) => {
      console.log("📸 Photo event:", event.type);
      fetchPhotos();
      fetchCollections(); // Photos affect collection counts
    },
    onCollectionEvent: (event) => {
      console.log("📁 Collection event:", event.type);
      fetchCollections();
      if (event.type === "collection.deleted" || event.type === "collection.expired") {
        fetchPhotos(); // Collection deletion affects photos
      }
    },
    onClientEvent: (event) => {
      console.log("👤 Client event:", event.type);
      fetchClients();
    },
    onConnected: () => {
      console.log("✅ Real-time updates connected");
    },
  });

  // Initial data load on mount
  useEffect(() => {
    fetchClients();
    fetchPhotos();
    fetchCollections();
  }, []); // Run once on mount

  // Fetch data when tab or collection filter changes
  useEffect(() => {
    if (activeTab === "clients") {
      fetchClients();
    } else if (activeTab === "photos") {
      fetchPhotos();
    } else if (activeTab === "collections") {
      fetchCollections();
    }
  }, [activeTab, selectedCollection]);

  // Fallback polling every 15 minutes (in case SSE connection drops)
  useEffect(() => {
    const interval = setInterval(() => {
      console.log("🔄 Periodic refresh (15min fallback)...");
      if (activeTab === "photos") {
        fetchPhotos();
      }
      if (activeTab === "clients") {
        fetchClients();
      }
      fetchCollections();
    }, 15 * 60 * 1000); // 15 minutes

    return () => clearInterval(interval);
  }, [activeTab, selectedCollection]);

  const fetchClients = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/photographer/clients`);
      if (response.data.success) {
        setClients(response.data.clients);
      }
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

  const fetchPhotos = async () => {
    try {
      let url;
      if (selectedCollection && selectedCollection !== "uncategorized") {
        // Fetch photos for a specific collection
        url = `${API_BASE_URL}/photographer/collections/${encodeURIComponent(
          selectedCollection
        )}/photos`;
      } else {
        // Fetch all photos (we'll filter on the frontend for uncategorized)
        url = `${API_BASE_URL}/photographer/photos`;
      }

      const response = await axios.get(url);
      if (response.data.success) {
        setPhotos(response.data.photos);
      }
    } catch (error) {
      console.error("Error fetching photos:", error);
    }
  };

  const fetchCollections = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/photographer/collections`
      );
      if (response.data.success) {
        setCollections(response.data.collections);
      }
    } catch (error) {
      console.error("Error fetching collections:", error);
    }
  };

  // Refresh all data
  const refreshAll = async () => {
    console.log("🔄 Refreshing all data...");
    await Promise.all([fetchClients(), fetchPhotos(), fetchCollections()]);
    console.log("✅ Refresh complete");
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/photographer/create-client`,
        {
          email: clientEmail,
          clientName: clientName,
        }
      );

      if (response.data.success) {
        setSuccess(
          `Client created successfully! Credentials sent to ${clientEmail}`
        );
        setClientEmail("");
        setClientName("");
        setShowCreateClientForm(false);
        await refreshAll(); // Refresh everything after creating client
      }
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to create client");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhotoUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFiles || selectedFiles.length === 0) {
      setError("Please select at least one photo");
      return;
    }

    setError("");
    setSuccess("");
    setIsLoading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      Array.from(selectedFiles).forEach((file) => {
        formData.append("photos", file);
      });

      if (uploadToCollection) {
        formData.append("collectionId", uploadToCollection);
      }

      // Add expiry duration
      if (expiryMinutes > 0) {
        formData.append("expiryMinutes", expiryMinutes.toString());
        console.log("⏱️ Setting expiry:", expiryMinutes, "minutes");
      } else {
        console.log("⏱️ Using default expiry (30 seconds)");
      }

      if (shareWithClients.length > 0) {
        formData.append("clientIds", JSON.stringify(shareWithClients));
        console.log("📤 Uploading with clients:", shareWithClients);
        console.log("📤 Client IDs JSON:", JSON.stringify(shareWithClients));
      } else {
        console.log("📤 No clients selected for sharing");
      }

      console.log("📤 Collection ID:", uploadToCollection);
      console.log("📤 Files count:", selectedFiles.length);

      const response = await axios.post(
        `${API_BASE_URL}/photographer/upload-photos`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            const progress = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total!
            );
            setUploadProgress(progress);
          },
        }
      );

      if (response.data.success) {
        const clientsShared = shareWithClients.length;
        let successMessage = `${selectedFiles.length} photo(s) uploaded successfully!`;

        // Share collection with selected clients using the same endpoint as the Share button
        if (clientsShared > 0 && uploadToCollection) {
          console.log(
            `🔗 Sharing collection ${uploadToCollection} with ${clientsShared} client(s)`
          );

          for (const clientId of shareWithClients) {
            try {
              // Find client username from ID
              const client = clients.find((c) => c.id === clientId);
              if (client) {
                console.log(`🔗 Sharing with client: ${client.username}`);
                const encodedCollectionId =
                  encodeURIComponent(uploadToCollection);
                const shareUrl = `${API_BASE_URL}/photographer/collections/${encodedCollectionId}/share`;

                await axios.post(shareUrl, { clientUsername: client.username });
                console.log(`✅ Shared collection with ${client.username}`);
              }
            } catch (shareError: any) {
              console.error(`❌ Failed to share with client:`, shareError);
              // Don't fail the whole upload if sharing fails
            }
          }

          successMessage += ` Collection shared with ${clientsShared} client${
            clientsShared !== 1 ? "s" : ""
          }.`;
        }

        setSuccess(successMessage);
        setSelectedFiles(null);
        setUploadToCollection("");
        setShareWithClients([]);
        setShowUploadForm(false);
        await refreshAll(); // Refresh everything after upload
      }
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to upload photos");
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    // Check if there are selected photos - if so, delete all selected instead
    const selectedPhotos = photos.filter((p) => p.selected);

    if (selectedPhotos.length > 1) {
      return handleBulkDeletePhotos();
    }

    if (
      !confirm(
        "Are you sure you want to delete this photo? It will be marked for deletion and removed after 7 days."
      )
    ) {
      return;
    }

    try {
      const response = await axios.delete(
        `${API_BASE_URL}/photographer/photos/${encodeURIComponent(photoId)}`
      );

      if (response.data.success) {
        const message =
          response.data.message ||
          "Photo marked for deletion. It will be permanently deleted in 7 days.";
        setSuccess(message);
        await refreshAll(); // Refresh everything after delete
      }
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to delete photo");
    }
  };

  const handleBulkDeletePhotos = async () => {
    const selectedPhotos = photos.filter((p) => p.selected);

    if (selectedPhotos.length === 0) {
      setError("Please select at least one photo to delete");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to delete ${selectedPhotos.length} photo(s)? They will be marked for deletion and removed after 7 days.`
      )
    ) {
      return;
    }

    try {
      setIsLoading(true);
      setError("");
      setSuccess("");

      console.log(
        `🗑️ Bulk deleting ${selectedPhotos.length} photos:`,
        selectedPhotos.map((p) => p.id)
      );

      // Delete all selected photos
      const deletePromises = selectedPhotos.map((photo) => {
        console.log(`Deleting photo ID: ${photo.id}`);
        return axios.delete(
          `${API_BASE_URL}/photographer/photos/${encodeURIComponent(photo.id)}`
        );
      });

      const results = await Promise.all(deletePromises);

      console.log(`✅ Successfully deleted ${results.length} photos`);

      setSuccess(
        `${selectedPhotos.length} photo(s) marked for deletion. They will be permanently deleted in 7 days.`
      );

      // Clear selections
      setSelectedPhotosForDownload([]);
      setPhotos(photos.map((p) => ({ ...p, selected: false })));

      // Refresh data
      await refreshAll(); // Refresh everything after bulk delete
    } catch (error: any) {
      console.error("❌ Bulk delete error:", error);
      setError(error.response?.data?.message || "Failed to delete photos");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/photographer/collections`,
        {
          name: collectionName,
          description: collectionDescription,
        }
      );

      if (response.data.success) {
        setSuccess("Collection created successfully!");
        setCollectionName("");
        setCollectionDescription("");
        setShowCreateCollectionForm(false);
        await refreshAll(); // Refresh everything after creating collection
      }
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to create collection");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this collection? The collection and all its photos will be marked for deletion and removed after 7 days."
      )
    ) {
      return;
    }

    try {
      const response = await axios.delete(
        `${API_BASE_URL}/photographer/collections/${encodeURIComponent(
          collectionId
        )}`
      );

      if (response.data.success) {
        const message =
          response.data.message ||
          "Collection and photos marked for deletion. They will be permanently deleted in 7 days.";
        setSuccess(message);
        if (selectedCollection === collectionId) {
          setSelectedCollection(null);
        }
        await refreshAll(); // Refresh everything after deleting collection
      }
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to delete collection");
    }
  };

  const handleShareCollection = async (clientUsername: string) => {
    if (!collectionToShare) {
      console.error("No collection selected!");
      return;
    }

    try {
      console.log("=== Share Collection Debug ===");
      console.log("Collection ID (raw):", collectionToShare);
      console.log("Client Username:", clientUsername);
      console.log("API_BASE_URL:", API_BASE_URL);

      const encodedCollectionId = encodeURIComponent(collectionToShare);
      console.log("Encoded Collection ID:", encodedCollectionId);

      const url = `${API_BASE_URL}/photographer/collections/${encodedCollectionId}/share`;
      console.log("Full URL:", url);
      console.log("Request body:", { clientUsername });

      const response = await axios.post(url, { clientUsername });
      console.log("Response:", response.data);

      if (response.data.success) {
        setSuccess("Collection shared with client successfully!");
        setShowShareModal(false);
        setCollectionToShare(null);
        await refreshAll(); // Refresh everything after sharing
      }
    } catch (error: any) {
      console.error("=== Share Collection Error ===");
      console.error("Error:", error);
      console.error("Error message:", error.message);
      console.error("Error response:", error.response);
      console.error("Error response data:", error.response?.data);
      console.error("Error response status:", error.response?.status);
      setError(error.response?.data?.message || "Failed to share collection");
    }
  };

  const togglePhotoSelection = (photoId: string) => {
    setPhotos(
      photos.map((photo) =>
        photo.id === photoId ? { ...photo, selected: !photo.selected } : photo
      )
    );

    setSelectedPhotosForDownload((prev) =>
      prev.includes(photoId)
        ? prev.filter((id) => id !== photoId)
        : [...prev, photoId]
    );
  };

  const selectAllPhotos = () => {
    const allSelected = photos.every((photo) => photo.selected);
    setPhotos(photos.map((photo) => ({ ...photo, selected: !allSelected })));
    setSelectedPhotosForDownload(
      allSelected ? [] : photos.map((photo) => photo.id)
    );
  };

  const toggleClientForUpload = (clientId: string) => {
    setShareWithClients((prev) =>
      prev.includes(clientId)
        ? prev.filter((id) => id !== clientId)
        : [...prev, clientId]
    );
  };

  const handleDownloadSelected = async () => {
    if (selectedPhotosForDownload.length === 0) {
      setError("Please select at least one photo to download");
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      if (selectedPhotosForDownload.length === 1) {
        // Download single photo
        const photo = photos.find((p) => p.id === selectedPhotosForDownload[0]);
        if (!photo) return;

        const response = await axios.get(
          `${API_BASE_URL}/photographer/photos/${photo.shareToken}/download`,
          {
            responseType: "blob",
            withCredentials: true,
          }
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
        const shareTokens = photos
          .filter((p) => selectedPhotosForDownload.includes(p.id))
          .map((p) => p.shareToken);

        const response = await axios.post(
          `${API_BASE_URL}/photographer/photos/download-zip`,
          { shareTokens },
          {
            responseType: "blob",
            withCredentials: true,
          }
        );

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", `photos-${Date.now()}.zip`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        setSuccess(
          `${selectedPhotosForDownload.length} photos downloaded successfully!`
        );
      }

      // Clear selection
      setSelectedPhotosForDownload([]);
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                📸 Photographer Studio
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {user?.businessName || user?.username} - Manage your clients and
                photos
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
                onClick={() => setActiveTab("clients")}
                className={`py-4 px-6 border-b-2 font-medium text-sm ${
                  activeTab === "clients"
                    ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                👥 Clients ({clients.length})
              </button>
              <button
                onClick={() => setActiveTab("collections")}
                className={`py-4 px-6 border-b-2 font-medium text-sm ${
                  activeTab === "collections"
                    ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                🗂️ Collections ({collections.length})
              </button>
              <button
                onClick={() => setActiveTab("photos")}
                className={`py-4 px-6 border-b-2 font-medium text-sm ${
                  activeTab === "photos"
                    ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                    : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                }`}
              >
                📷 Photos ({photos.length})
              </button>
            </nav>
          </div>

          {/* Clients Tab */}
          {activeTab === "clients" && (
            <div>
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Client Management
                  </h2>
                  <button
                    onClick={() =>
                      setShowCreateClientForm(!showCreateClientForm)
                    }
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition duration-200"
                  >
                    {showCreateClientForm ? "Cancel" : "+ Add Client"}
                  </button>
                </div>
              </div>

              {showCreateClientForm && (
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <form onSubmit={handleCreateClient} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Client Email
                        </label>
                        <input
                          type="email"
                          value={clientEmail}
                          onChange={(e) => setClientEmail(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="client@example.com"
                          required
                          disabled={isLoading}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Credentials will be sent here (email not stored for
                          privacy)
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Client Name
                        </label>
                        <input
                          type="text"
                          value={clientName}
                          onChange={(e) => setClientName(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          placeholder="John Doe"
                          required
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md disabled:opacity-50 transition duration-200"
                      >
                        {isLoading ? "Creating..." : "Create Client"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="px-6 py-4">
                {clients.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No clients yet. Create one to start sharing photos!
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {clients.map((client) => (
                      <div
                        key={client.id}
                        className="bg-gray-50 rounded-lg p-4"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-semibold text-gray-900">
                            {client.clientName}
                          </h3>
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${
                              client.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {client.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          Username: {client.username}
                        </p>
                        <p className="text-xs text-gray-500">
                          Created:{" "}
                          {new Date(client.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Collections Tab */}
          {activeTab === "collections" && (
            <div>
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Photo Collections
                  </h2>
                  <button
                    onClick={() =>
                      setShowCreateCollectionForm(!showCreateCollectionForm)
                    }
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition duration-200"
                  >
                    {showCreateCollectionForm
                      ? "Cancel"
                      : "+ Create Collection"}
                  </button>
                </div>
              </div>

              {showCreateCollectionForm && (
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <form onSubmit={handleCreateCollection} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Collection Name
                      </label>
                      <input
                        type="text"
                        value={collectionName}
                        onChange={(e) => setCollectionName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Wedding Photos, Event 2024, etc."
                        required
                        disabled={isLoading}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description (Optional)
                      </label>
                      <textarea
                        value={collectionDescription}
                        onChange={(e) =>
                          setCollectionDescription(e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="Description of this collection..."
                        rows={3}
                        disabled={isLoading}
                      />
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md disabled:opacity-50 transition duration-200"
                      >
                        {isLoading ? "Creating..." : "Create Collection"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="px-6 py-4">
                {collections.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No collections yet. Create one to organize your photos!
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {collections.map((collection) => (
                      <div
                        key={collection.collectionId}
                        className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow fade-in-slow"
                      >
                        {/* Collection Thumbnail */}
                        <div className="w-full h-48 bg-gray-100 flex items-center justify-center relative group">
                          {collection.thumbnailDataB64 ? (
                            <img
                              src={`data:image/jpeg;base64,${collection.thumbnailDataB64}`}
                              alt={collection.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="text-gray-400 text-center">
                              <div className="text-4xl mb-2">🗂️</div>
                              <div className="text-sm">No photos yet</div>
                            </div>
                          )}
                          {/* Delete button overlay */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCollection(collection.collectionId);
                            }}
                            className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete collection"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                          </button>
                        </div>

                        <div className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-semibold text-gray-900 text-lg">
                              {collection.name}
                            </h3>
                            {/* Auto-delete countdown timer */}
                            <CountdownTimer
                              targetDate={collection.autoDeleteAt}
                            />
                          </div>
                          {collection.description && (
                            <p className="text-sm text-gray-600 mb-3">
                              {collection.description}
                            </p>
                          )}
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-sm text-gray-500">
                              📷 {collection.photoCount} photo(s)
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(
                                collection.createdAt
                              ).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedCollection(collection.collectionId);
                                setActiveTab("photos");
                              }}
                              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 rounded-md text-sm transition duration-200 transform hover:-translate-y-0.5"
                            >
                              View Photos
                            </button>
                            <button
                              onClick={() => {
                                setCollectionToShare(collection.collectionId);
                                setShowShareModal(true);
                              }}
                              className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md text-sm transition duration-200 transform hover:-translate-y-0.5"
                            >
                              Share with Client
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Photos Tab */}
          {activeTab === "photos" && (
            <div>
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Photo Gallery
                  </h2>
                  <button
                    onClick={() => setShowUploadForm(!showUploadForm)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition duration-200"
                  >
                    {showUploadForm ? "Cancel" : "📤 Upload Photos"}
                  </button>
                </div>

                {/* Collection Filter */}
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => {
                      setSelectedCollection(null);
                      fetchPhotos();
                    }}
                    className={`px-4 py-2 rounded-md text-sm transition-colors ${
                      !selectedCollection
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    All Photos
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCollection("uncategorized");
                      fetchPhotos();
                    }}
                    className={`px-4 py-2 rounded-md text-sm transition-colors ${
                      selectedCollection === "uncategorized"
                        ? "bg-indigo-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    Uncategorized
                  </button>
                  {collections.map((collection) => (
                    <button
                      key={collection.collectionId}
                      onClick={() => {
                        setSelectedCollection(collection.collectionId);
                        fetchPhotos();
                      }}
                      className={`px-4 py-2 rounded-md text-sm transition-colors ${
                        selectedCollection === collection.collectionId
                          ? "bg-indigo-600 text-white"
                          : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                      }`}
                    >
                      🗂️ {collection.name} ({collection.photoCount})
                    </button>
                  ))}
                </div>
              </div>

              {showUploadForm && (
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <form onSubmit={handlePhotoUpload}>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Photos
                      </label>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => setSelectedFiles(e.target.files)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={isLoading}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Photos will be encrypted and stored securely in the
                        database
                      </p>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Collection <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={uploadToCollection}
                        onChange={(e) => setUploadToCollection(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={isLoading}
                        required
                      >
                        <option value="">Select a collection...</option>
                        {collections.map((collection) => (
                          <option
                            key={collection.collectionId}
                            value={collection.collectionId}
                          >
                            {collection.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Photos will be added to this collection
                      </p>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Auto-Delete Timer ⏱️
                      </label>
                      <select
                        value={expiryMinutes}
                        onChange={(e) =>
                          setExpiryMinutes(parseInt(e.target.value))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        disabled={isLoading}
                      >
                        <option value="0">30 seconds (testing)</option>
                        <option value="60">1 hour</option>
                        <option value="120">2 hours</option>
                        <option value="180">3 hours</option>
                        <option value="360">6 hours</option>
                        <option value="720">12 hours</option>
                        <option value="1440">24 hours (1 day)</option>
                        <option value="2880">48 hours (2 days)</option>
                        <option value="4320">72 hours (3 days)</option>
                        <option value="10080">1 week</option>
                        <option value="20160">2 weeks</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Collection will auto-delete after this time period
                      </p>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Share with Clients (Optional)
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowUploadShareModal(true)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors text-left flex justify-between items-center"
                        disabled={isLoading}
                      >
                        <span className="text-sm text-gray-700">
                          {shareWithClients.length === 0
                            ? "Click to select clients..."
                            : `${shareWithClients.length} client${
                                shareWithClients.length !== 1 ? "s" : ""
                              } selected`}
                        </span>
                        <span className="text-gray-400">▼</span>
                      </button>
                      <p className="text-xs text-gray-500 mt-1">
                        Selected clients will get access to this collection
                      </p>
                    </div>

                    {uploadProgress > 0 && (
                      <div className="mb-4">
                        <div className="bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          ></div>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {uploadProgress}% uploaded
                        </p>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={
                          isLoading || !selectedFiles || !uploadToCollection
                        }
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-md disabled:opacity-50 transition duration-200"
                      >
                        {isLoading ? "Uploading..." : "Upload Photos"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Selection and Download Controls */}
              {photos.length > 0 && (
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-700">
                        {selectedPhotosForDownload.length > 0
                          ? `${selectedPhotosForDownload.length} photo(s) selected`
                          : "Select photos to download"}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={selectAllPhotos}
                        className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-md transition duration-200 text-sm"
                      >
                        {photos.every((photo) => photo.selected)
                          ? "Deselect All"
                          : "Select All"}
                      </button>
                      {selectedPhotosForDownload.length > 0 && (
                        <>
                          <button
                            onClick={handleDownloadSelected}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition duration-200 flex items-center space-x-2 text-sm"
                            disabled={isLoading}
                          >
                            <span>⬇️</span>
                            <span>
                              Download{" "}
                              {selectedPhotosForDownload.length > 1
                                ? "ZIP"
                                : ""}
                            </span>
                          </button>
                          <button
                            onClick={handleBulkDeletePhotos}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition duration-200 flex items-center space-x-2 text-sm"
                            disabled={isLoading}
                          >
                            <span>🗑️</span>
                            <span>
                              Delete ({selectedPhotosForDownload.length})
                            </span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="px-6 py-4">
                {!selectedCollection ? (
                  // Show all photos grouped by collection
                  <div className="space-y-8">
                    {/* Uncategorized Photos */}
                    {photos.filter(
                      (p) => !p.collectionId || p.collectionId === ""
                    ).length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center border-b-2 border-gray-300 pb-2">
                          📁 Uncategorized
                          <span className="ml-2 text-sm text-gray-500">
                            (
                            {
                              photos.filter(
                                (p) => !p.collectionId || p.collectionId === ""
                              ).length
                            }{" "}
                            photos)
                          </span>
                        </h3>
                        <MasonryPhotoGrid
                          photos={photos.filter(
                            (p) => !p.collectionId || p.collectionId === ""
                          )}
                          onPhotoDelete={handleDeletePhoto}
                          showDeleteButton={true}
                          onPhotoSelect={togglePhotoSelection}
                          selectable={true}
                        />
                      </div>
                    )}

                    {/* Photos by Collection */}
                    {collections.map((collection) => {
                      const collectionPhotos = photos.filter(
                        (p) => p.collectionId === collection.collectionId
                      );

                      if (collectionPhotos.length === 0) return null;

                      return (
                        <div key={collection.collectionId}>
                          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center border-b-2 border-gray-300 pb-2">
                            🗂️ {collection.name}
                            <span className="ml-2 text-sm text-gray-500">
                              ({collectionPhotos.length} photos)
                            </span>
                          </h3>
                          <MasonryPhotoGrid
                            photos={collectionPhotos}
                            onPhotoDelete={handleDeletePhoto}
                            showDeleteButton={true}
                            onPhotoSelect={togglePhotoSelection}
                            selectable={true}
                          />
                        </div>
                      );
                    })}

                    {/* If no photos at all */}
                    {photos.length === 0 && (
                      <div className="text-center py-12 text-gray-500">
                        <p>No photos uploaded yet.</p>
                        <button
                          onClick={() => setShowUploadForm(true)}
                          className="mt-4 text-indigo-600 hover:text-indigo-800"
                        >
                          Upload your first photos
                        </button>
                      </div>
                    )}
                  </div>
                ) : selectedCollection === "uncategorized" ? (
                  // Show only uncategorized photos
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center border-b-2 border-gray-300 pb-2">
                      📁 Uncategorized
                      <span className="ml-2 text-sm text-gray-500">
                        (
                        {
                          photos.filter(
                            (p) => !p.collectionId || p.collectionId === ""
                          ).length
                        }{" "}
                        photos)
                      </span>
                    </h3>
                    {photos.filter(
                      (p) => !p.collectionId || p.collectionId === ""
                    ).length > 0 ? (
                      <MasonryPhotoGrid
                        photos={photos.filter(
                          (p) => !p.collectionId || p.collectionId === ""
                        )}
                        onPhotoDelete={handleDeletePhoto}
                        showDeleteButton={true}
                        onPhotoSelect={togglePhotoSelection}
                        selectable={true}
                      />
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <p>No uncategorized photos.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  // Show photos for selected collection only
                  <div>
                    {photos.length > 0 ? (
                      <MasonryPhotoGrid
                        photos={photos}
                        onPhotoDelete={handleDeletePhoto}
                        showDeleteButton={true}
                        onPhotoSelect={togglePhotoSelection}
                        selectable={true}
                      />
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <p>No photos in this collection.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Share Collection Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">
              Share Collection with Client
            </h3>
            <p className="text-gray-600 mb-4">
              Select a client to share this collection with:
            </p>
            <div className="max-h-64 overflow-y-auto mb-4">
              {clients.filter((c) => c.isActive).length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No active clients. Create a client first.
                </p>
              ) : (
                <div className="space-y-2">
                  {clients
                    .filter((c) => c.isActive)
                    .map((client) => (
                      <button
                        key={client.id}
                        onClick={() => handleShareCollection(client.username)}
                        className="w-full text-left px-4 py-3 border border-gray-300 rounded-md hover:bg-indigo-50 hover:border-indigo-500 transition-colors"
                      >
                        <div className="font-semibold">{client.clientName}</div>
                        <div className="text-sm text-gray-500">
                          @{client.username}
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowShareModal(false);
                  setCollectionToShare(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Share Modal - Select Clients for Upload */}
      {showUploadShareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold mb-4">Share with Clients</h3>
            <p className="text-gray-600 mb-4">
              Select clients who will get access to this collection:
            </p>
            <div className="max-h-64 overflow-y-auto mb-4">
              {clients.filter((c) => c.isActive).length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No active clients. Create a client first.
                </p>
              ) : (
                <div className="space-y-2">
                  {clients
                    .filter((c) => c.isActive)
                    .map((client) => {
                      const isSelected = shareWithClients.includes(client.id);
                      return (
                        <button
                          key={client.id}
                          onClick={() => toggleClientForUpload(client.id)}
                          className={`w-full text-left px-4 py-3 border rounded-md transition-colors ${
                            isSelected
                              ? "bg-indigo-50 border-indigo-500"
                              : "border-gray-300 hover:bg-gray-50 hover:border-gray-400"
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-semibold flex items-center">
                                {isSelected && (
                                  <span className="mr-2 text-indigo-600">
                                    ✓
                                  </span>
                                )}
                                {client.clientName}
                              </div>
                              <div className="text-sm text-gray-500">
                                @{client.username}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
            <div className="flex justify-between items-center">
              <p className="text-sm text-gray-600">
                {shareWithClients.length} client
                {shareWithClients.length !== 1 ? "s" : ""} selected
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowUploadShareModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PhotographerDashboard;
