"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import axios from "../utils/axiosInstance";
import { default as axiosLib } from "axios";
import CountdownTimer from "./CountdownTimer";
import { useSSE } from "../hooks/useSSE";

// Debounce utility to prevent rapid consecutive API calls
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

interface Photographer {
  id: string;
  username: string;
  businessName: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  clientCount: number;
  collectionCount: number;
  photoCount: number;
}

interface Client {
  id: string;
  username: string;
  clientName: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  photographerId: string;
  photographerName: string;
  guestCount: number;
  collectionCount: number;
}

interface Guest {
  id: string;
  username: string;
  guestName: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  expiresAt: string;
  clientId: string;
  clientName: string;
  photographerId: string;
  photographerName: string;
  photoAccessCount: number;
}

interface Collection {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  photographerId: string;
  photographerName: string;
  photoCount: number;
  clientCount: number;
  thumbnailDataB64?: string;
}

interface Photo {
  id: string;
  originalName: string;
  thumbnailDataB64?: string;
  size: number;
  createdAt: string;
  photographerId: string;
  photographerName: string;
}

interface SystemStats {
  totalPhotographers: number;
  activePhotographers: number;
  totalClients: number;
  activeClients: number;
  totalGuests: number;
  activeGuests: number;
  totalCollections: number;
  totalPhotos: number;
  totalStorageBytes: number;
}

interface ScheduledDeletions {
  photographers: PendingDeletion[];
  clients: PendingDeletion[];
  guests: PendingDeletion[];
  photos: PendingDeletion[];
  collections: PendingDeletion[];
  total: number;
}

interface PendingDeletion {
  id: string;
  username?: string;
  businessName?: string;
  clientName?: string;
  guestName?: string;
  originalName?: string;
  name?: string;
  deletedAt: string;
  scheduledDeletionDate: string;
  deletionReason: string;
}

const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "photographers"
    | "clients"
    // | "guests" // REMOVED - Guest functionality disabled
    | "collections"
    | "photos"
    | "pending-deletions"
  >("overview");

  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  // const [guests, setGuests] = useState<Guest[]>([]); // REMOVED - Guest functionality disabled
  const [collections, setCollections] = useState<Collection[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [scheduledDeletions, setScheduledDeletions] =
    useState<ScheduledDeletions | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Form state
  const [email, setEmail] = useState("");
  const [businessName, setBusinessName] = useState("");

  const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:6002/api";

  // Server-Sent Events for real-time updates (OPTIMIZED: minimal targeted fetches)
  useSSE({
    onPhotoEvent: () => {
      // Only fetch photos and collections (not system stats on every photo event)
      fetchPhotos();
      fetchCollections();
    },
    onCollectionEvent: () => {
      // Only fetch collections (photos are unaffected by collection changes)
      fetchCollections();
    },
    onClientEvent: () => {
      // Only fetch clients and photographers (related entities)
      fetchClients();
      fetchPhotographers();
    },
    // REMOVED - Guest functionality disabled
    // onGuestEvent: () => {
    //   fetchGuests();
    //   fetchClients();
    //   fetchSystemStats();
    // },
    onConnected: () => {
      console.log("✅ Admin real-time updates connected");
      // Fetch stats once on connection, not on every event
      fetchSystemStats();
    },
  });

  useEffect(() => {
    fetchSystemStats();
    fetchPhotographers();
    fetchClients();
    // fetchGuests(); // REMOVED - Guest functionality disabled
    fetchCollections();
    fetchPhotos();
    fetchScheduledDeletions();
  }, []);

  // REMOVED - 15-minute polling causes excessive API requests
  // SSE provides real-time updates, polling is unnecessary
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     console.log("🔄 Periodic refresh (15min fallback)...");
  //     fetchSystemStats();
  //     fetchPhotographers();
  //     fetchClients();
  //     fetchCollections();
  //     fetchPhotos();
  //     fetchScheduledDeletions();
  //   }, 15 * 60 * 1000); // 15 minutes
  //
  //   return () => clearInterval(interval);
  // }, []);

  // Raw fetch functions
  const fetchSystemStatsRaw = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/stats`);
      if (response.data.success) {
        setStats(response.data.stats);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchPhotographersRaw = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/photographers`);
      if (response.data.success) {
        setPhotographers(response.data.photographers);
      }
    } catch (error) {
      console.error("Error fetching photographers:", error);
    }
  };

  const fetchClientsRaw = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/clients`);
      if (response.data.success) {
        setClients(response.data.clients);
      }
    } catch (error) {
      console.error("Error fetching clients:", error);
    }
  };

  // Debounced versions (prevent rapid consecutive calls from SSE events)
  const fetchSystemStats = useCallback(debounce(fetchSystemStatsRaw, 1000), []);
  const fetchPhotographers = useCallback(
    debounce(fetchPhotographersRaw, 1000),
    []
  );
  const fetchClients = useCallback(debounce(fetchClientsRaw, 1000), []);

  // REMOVED - Guest functionality disabled
  // const fetchGuests = async () => {
  //   try {
  //     const response = await axios.get(`${API_BASE_URL}/admin/guests`);
  //     if (response.data.success) {
  //       setGuests(response.data.guests);
  //     }
  //   } catch (error) {
  //     console.error("Error fetching guests:", error);
  //   }
  // };

  const fetchCollectionsRaw = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/collections`);
      if (response.data.success) {
        setCollections(response.data.collections);
      }
    } catch (error) {
      console.error("Error fetching collections:", error);
    }
  };

  const fetchPhotosRaw = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/admin/photos`);
      if (response.data.success) {
        setPhotos(response.data.photos);
      }
    } catch (error) {
      console.error("Error fetching photos:", error);
    }
  };

  // Create debounced versions to prevent rapid consecutive calls
  const fetchCollections = useCallback(debounce(fetchCollectionsRaw, 1000), []);
  const fetchPhotos = useCallback(debounce(fetchPhotosRaw, 1000), []);

  const fetchScheduledDeletions = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/admin/scheduled-deletions`
      );
      if (response.data.success) {
        setScheduledDeletions(response.data.scheduled);
      }
    } catch (error) {
      console.error("Error fetching scheduled deletions:", error);
    }
  };

  // Refresh all data
  const refreshAll = async () => {
    console.log("🔄 Refreshing all admin data...");
    await Promise.all([
      fetchSystemStats(),
      fetchPhotographers(),
      fetchClients(),
      //fetchGuests(),
      fetchCollections(),
      fetchPhotos(),
      fetchScheduledDeletions(),
    ]);
    console.log("✅ Refresh complete");
  };

  const restoreEntity = async (
    entityClass: string,
    entityId: string,
    displayName: string
  ) => {
    if (!window.confirm(`Are you sure you want to restore "${displayName}"?`)) {
      return;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/admin/restore`, {
        entityClass,
        entityId,
      });

      if (response.data.success) {
        const photosRestored = response.data.photosRestored || 0;
        const message =
          photosRestored > 0
            ? `${displayName} and ${photosRestored} photo(s) restored successfully`
            : `${displayName} restored successfully`;
        setSuccess(message);
        await refreshAll(); // Refresh everything after restore
      }
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to restore entity");
    }
  };

  const runCleanup = async () => {
    if (
      !window.confirm(
        "Are you sure you want to permanently delete all items that have reached their 7-day deadline? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/cleanup-deletions`
      );
      if (response.data.success) {
        const count = response.data.summary.totalDeleted;
        if (count === 0) {
          setSuccess(
            "No items ready for deletion yet. Items must wait 7 days before permanent deletion."
          );
        } else {
          setSuccess(
            `Cleanup completed: ${count} item${
              count !== 1 ? "s" : ""
            } permanently deleted`
          );
        }
        fetchScheduledDeletions();
        fetchPhotographers();
        fetchClients();
        // fetchGuests();
        fetchCollections();
        fetchPhotos();
        fetchSystemStats();
      }
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to run cleanup");
    }
  };

  const nukeAllDeletions = async () => {
    if (
      !window.confirm(
        "⚠️ NUCLEAR OPTION ⚠️\n\nThis will IMMEDIATELY and PERMANENTLY delete ALL marked items, ignoring the 7-day grace period!\n\nThis action CANNOT be undone!\n\nAre you ABSOLUTELY SURE?"
      )
    ) {
      return;
    }

    // Double confirmation
    if (
      !window.confirm(
        "💣 FINAL WARNING 💣\n\nYou are about to permanently delete ALL pending items RIGHT NOW.\n\nClick OK to proceed with nuclear deletion."
      )
    ) {
      return;
    }

    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/nuke-all-deletions`
      );
      if (response.data.success) {
        const count = response.data.summary.totalDeleted;
        setSuccess(
          `💥 Nuclear deletion complete: ${count} item${
            count !== 1 ? "s" : ""
          } permanently deleted immediately!`
        );
        fetchScheduledDeletions();
        fetchPhotographers();
        fetchClients();
        //fetchGuests();
        fetchCollections();
        fetchPhotos();
        fetchSystemStats();
      }
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to nuke deletions");
    }
  };

  const handleCreatePhotographer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/create-photographer`,
        {
          email,
          businessName,
        }
      );

      if (response.data.success) {
        setSuccess(
          `Photographer created successfully! Credentials sent to ${email}`
        );
        setEmail("");
        setBusinessName("");
        setShowCreateForm(false);
        fetchPhotographers();
        fetchSystemStats();
      }
    } catch (error: any) {
      setError(
        error.response?.data?.message || "Failed to create photographer"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const togglePhotographerStatus = async (photographerId: string) => {
    try {
      const encodedId = encodeURIComponent(photographerId);
      const url = `${API_BASE_URL}/admin/photographer/${encodedId}/toggle`;
      await axios.put(url);
      fetchPhotographers();
      fetchSystemStats();
    } catch (error) {
      console.error("Toggle error:", error);
      if (axiosLib.isAxiosError(error)) {
        setError(
          error.response?.data?.message ||
            "Failed to update photographer status"
        );
      }
    }
  };

  const deletePhotographer = async (
    photographerId: string,
    businessName: string
  ) => {
    if (
      !window.confirm(
        `Are you sure you want to mark photographer "${businessName}" for deletion? It will be permanently deleted in 7 days. You can restore it from the Pending Deletions tab during this period.`
      )
    ) {
      return;
    }

    try {
      const encodedId = encodeURIComponent(photographerId);
      const url = `${API_BASE_URL}/admin/photographer/${encodedId}`;
      const response = await axios.delete(url);

      if (response.data.success) {
        setSuccess(
          `Photographer "${businessName}" marked for deletion. Will be permanently deleted on ${new Date(
            response.data.scheduledDeletionDate
          ).toLocaleDateString()}`
        );
        fetchPhotographers();
        fetchSystemStats();
        fetchScheduledDeletions();
      }
    } catch (error) {
      console.error("Delete error:", error);
      if (axiosLib.isAxiosError(error)) {
        setError(
          error.response?.data?.message || "Failed to delete photographer"
        );
      }
    }
  };

  const deleteClient = async (clientId: string, clientName: string) => {
    if (
      !window.confirm(
        `Are you sure you want to mark client "${clientName}" for deletion? It will be permanently deleted in 7 days.`
      )
    ) {
      return;
    }

    try {
      const encodedId = encodeURIComponent(clientId);
      const response = await axios.delete(
        `${API_BASE_URL}/admin/client/${encodedId}`
      );

      if (response.data.success) {
        setSuccess(`Client "${clientName}" marked for deletion.`);
        fetchClients();
        fetchSystemStats();
        fetchScheduledDeletions();
      }
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to delete client");
    }
  };

  const deleteGuest = async (guestId: string, guestName: string) => {
    if (
      !window.confirm(
        `Are you sure you want to mark guest "${guestName}" for deletion? It will be permanently deleted in 7 days.`
      )
    ) {
      return;
    }

    try {
      const encodedId = encodeURIComponent(guestId);
      const response = await axios.delete(
        `${API_BASE_URL}/admin/guest/${encodedId}`
      );

      if (response.data.success) {
        setSuccess(`Guest "${guestName}" marked for deletion.`);
        // fetchGuests();
        fetchSystemStats();
        fetchScheduledDeletions();
      }
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to delete guest");
    }
  };

  const deleteCollection = async (
    collectionId: string,
    collectionName: string
  ) => {
    if (
      !window.confirm(
        `Are you sure you want to mark collection "${collectionName}" for deletion? It will be permanently deleted in 7 days.`
      )
    ) {
      return;
    }

    try {
      const encodedId = encodeURIComponent(collectionId);
      const response = await axios.delete(
        `${API_BASE_URL}/admin/collection/${encodedId}`
      );

      if (response.data.success) {
        const photosDeleted = response.data.photosDeleted || 0;
        const message =
          photosDeleted > 0
            ? `Collection "${collectionName}" and ${photosDeleted} photo(s) marked for deletion.`
            : `Collection "${collectionName}" marked for deletion.`;
        setSuccess(message);
        fetchCollections();
        fetchPhotos(); // Refresh photos tab since cascade delete affects photos
        fetchSystemStats();
        fetchScheduledDeletions();
      }
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to delete collection");
    }
  };

  const deletePhoto = async (photoId: string, photoName: string) => {
    if (
      !window.confirm(
        `Are you sure you want to mark photo "${photoName}" for deletion? It will be permanently deleted in 7 days.`
      )
    ) {
      return;
    }

    try {
      const encodedId = encodeURIComponent(photoId);
      const response = await axios.delete(
        `${API_BASE_URL}/admin/photo/${encodedId}`
      );

      if (response.data.success) {
        setSuccess(`Photo "${photoName}" marked for deletion.`);
        fetchPhotos();
        fetchSystemStats();
        fetchScheduledDeletions();
      }
    } catch (error: any) {
      setError(error.response?.data?.message || "Failed to delete photo");
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const renderOverview = () => (
    <div>
      {/* System Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Photographers</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats?.totalPhotographers || 0}
              </p>
              <p className="text-xs text-green-600 mt-1">
                {stats?.activePhotographers || 0} active
              </p>
            </div>
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">📷</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Clients</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats?.totalClients || 0}
              </p>
              <p className="text-xs text-green-600 mt-1">
                {stats?.activeClients || 0} active
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">👥</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Guests</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats?.totalGuests || 0}
              </p>
              <p className="text-xs text-green-600 mt-1">
                {stats?.activeGuests || 0} active
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">🎫</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Collections</p>
              <p className="text-3xl font-bold text-gray-900">
                {stats?.totalCollections || 0}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                {stats?.totalPhotos || 0} photos
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-2xl">📁</span>
            </div>
          </div>
        </div>
      </div>

      {/* Storage Info */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Storage Usage
        </h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-indigo-600">
              {formatBytes(stats?.totalStorageBytes || 0)}
            </p>
            <p className="text-sm text-gray-500">Total storage used</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-gray-900">
              {stats?.totalPhotos || 0}
            </p>
            <p className="text-sm text-gray-500">Total photos</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPhotographers = () => (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">
            👨‍💼 Photographers
          </h2>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition duration-200"
          >
            {showCreateForm ? "Cancel" : "+ Add Photographer"}
          </button>
        </div>
      </div>

      {showCreateForm && (
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <form onSubmit={handleCreatePhotographer} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="photographer@example.com"
                  required
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Business Name
                </label>
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Photography Studio Name"
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
                {isLoading ? "Creating..." : "Create Photographer"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="px-6 py-4">
        {photographers.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No photographers created yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Business Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Username
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Stats
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {photographers.map((photographer) => (
                  <tr key={photographer.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {photographer.businessName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(photographer.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {photographer.username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {photographer.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="space-y-1">
                        <div>📷 {photographer.photoCount} photos</div>
                        <div>📁 {photographer.collectionCount} collections</div>
                        <div>👥 {photographer.clientCount} clients</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          photographer.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {photographer.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-3">
                      <button
                        onClick={() =>
                          togglePhotographerStatus(photographer.id)
                        }
                        className={`${
                          photographer.isActive
                            ? "text-orange-600 hover:text-orange-900"
                            : "text-green-600 hover:text-green-900"
                        }`}
                      >
                        {photographer.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() =>
                          deletePhotographer(
                            photographer.id,
                            photographer.businessName
                          )
                        }
                        className="text-red-600 hover:text-red-900"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  const renderClients = () => (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">👥 Clients</h2>
      </div>

      <div className="px-6 py-4">
        {clients.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No clients yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Client Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Username
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Created By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Stats
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {clients.map((client) => (
                  <tr key={client.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {client.clientName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(client.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {client.username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {client.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center mr-2">
                          <span className="text-sm">📷</span>
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-indigo-700">
                            {client.photographerName}
                          </div>
                          <div className="text-xs text-gray-500">
                            Photographer
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="space-y-1">
                        <div>📁 {client.collectionCount} collections</div>
                        <div>🎫 {client.guestCount} guests</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          client.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {client.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() =>
                          deleteClient(client.id, client.clientName)
                        }
                        className="text-red-600 hover:text-red-900 font-medium"
                      >
                        🗑️ Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  // REMOVED - Guest functionality disabled
  /*
  const renderGuests = () => (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">🎫 Guests</h2>
      </div>

      <div className="px-6 py-4">
        {guests.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No guests yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Guest Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Username
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Created By
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Expires
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              
          
            </table>
          </div>
        )}
      </div>
    </div>
  );
  */ const renderCollections = () => (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">📁 Collections</h2>
      </div>

      <div className="px-6 py-4">
        {collections.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No collections yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collections.map((collection) => (
              <div
                key={collection.id}
                className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
              >
                {collection.thumbnailDataB64 ? (
                  <img
                    src={`data:image/jpeg;base64,${collection.thumbnailDataB64}`}
                    alt={collection.name}
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-400 text-4xl">📁</span>
                  </div>
                )}
                <div className="p-4">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {collection.name}
                  </h3>
                  {collection.description && (
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                      {collection.description}
                    </p>
                  )}
                  <div className="mt-3 space-y-2">
                    <div className="bg-indigo-50 rounded-md p-2 border border-indigo-100">
                      <div className="flex items-center text-xs text-gray-600 mb-1">
                        <span className="mr-1">👤</span>
                        <span>Created by:</span>
                      </div>
                      <div className="flex items-center text-sm font-semibold text-indigo-700">
                        <span className="mr-2">📷</span>
                        <span className="truncate">
                          {collection.photographerName}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>📸 {collection.photoCount} photos</span>
                      <span>👥 {collection.clientCount} clients</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(collection.createdAt).toLocaleDateString()}
                    </div>
                    <button
                      onClick={() =>
                        deleteCollection(collection.id, collection.name)
                      }
                      className="mt-2 w-full bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition duration-200"
                    >
                      🗑️ Delete Collection
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderPhotos = () => (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">📸 Photos</h2>
      </div>

      <div className="px-6 py-4">
        {photos.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No photos yet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
              >
                {photo.thumbnailDataB64 ? (
                  <img
                    src={`data:image/jpeg;base64,${photo.thumbnailDataB64}`}
                    alt={photo.originalName}
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-400 text-4xl">📷</span>
                  </div>
                )}
                <div className="p-3">
                  <h4 className="text-sm font-semibold text-gray-900 truncate">
                    {photo.originalName}
                  </h4>
                  <div className="mt-2 space-y-1">
                    <div className="bg-indigo-50 rounded px-2 py-1">
                      <div className="text-xs text-gray-600">Created by:</div>
                      <div className="flex items-center text-xs font-semibold text-indigo-700">
                        <span className="mr-1">📷</span>
                        <span className="truncate">
                          {photo.photographerName}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{formatBytes(photo.size)}</span>
                      <span>
                        {new Date(photo.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <button
                      onClick={() => deletePhoto(photo.id, photo.originalName)}
                      className="mt-2 w-full bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs transition duration-200"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderPendingDeletions = () => {
    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleString();
    };

    const getDaysRemaining = (scheduledDate: string) => {
      const now = new Date();
      const scheduled = new Date(scheduledDate);
      const daysRemaining = Math.ceil(
        (scheduled.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysRemaining;
    };

    const getDisplayName = (item: PendingDeletion): string => {
      return (
        item.businessName ||
        item.clientName ||
        item.guestName ||
        item.name ||
        item.originalName ||
        "Unknown"
      );
    };

    const totalPending = scheduledDeletions?.total || 0;

    return (
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                🗑️ Pending Deletions
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Items scheduled for permanent deletion (7-day grace period)
              </p>
            </div>
            {totalPending > 0 && (
              <div className="flex space-x-3">
                <button
                  onClick={runCleanup}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium transition duration-200"
                  title="Only deletes items that have reached their 7-day deadline"
                >
                  🧹 Force Cleanup
                </button>
                <button
                  onClick={nukeAllDeletions}
                  className="bg-gradient-to-r from-red-600 to-red-800 hover:from-red-700 hover:to-red-900 text-white px-4 py-2 rounded-md text-sm font-bold transition duration-200 shadow-lg border-2 border-red-900"
                  title="DANGER: Immediately deletes ALL marked items (ignores 7-day grace period)"
                >
                  💣 NUKE ALL
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 space-y-6">
          {totalPending === 0 ? (
            <p className="text-gray-500 text-center py-8">
              ✅ No items pending deletion
            </p>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-800 mb-2">
                  ℹ️ <strong>Note:</strong> The "Force Cleanup" button only
                  permanently deletes items that have reached their 7-day
                  deadline. Newly deleted items will automatically be removed
                  after 7 days by the scheduled cleanup job (runs daily at 3:00
                  AM).
                </p>
                <p className="text-sm text-red-800 font-semibold">
                  💣 <strong>NUKE ALL:</strong> Immediately deletes ALL marked
                  items regardless of the deadline. Use with extreme caution!
                </p>
              </div>
              {/* Photographers */}
              {scheduledDeletions?.photographers &&
                scheduledDeletions.photographers.length > 0 && (
                  <div key="photographers-section">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                      <span className="mr-2">📷</span>
                      Photographers ({scheduledDeletions.photographers.length})
                    </h3>
                    <div className="space-y-2">
                      {scheduledDeletions.photographers.map((item) => {
                        const daysRemaining = getDaysRemaining(
                          item.scheduledDeletionDate
                        );
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50"
                          >
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">
                                {item.businessName} ({item.username})
                              </p>
                              <p className="text-sm text-gray-600">
                                Reason: {item.deletionReason}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                Marked: {formatDate(item.deletedAt)} • Will
                                delete: {formatDate(item.scheduledDeletionDate)}
                              </p>
                            </div>
                            <div className="flex items-center space-x-3">
                              <CountdownTimer
                                targetDate={item.scheduledDeletionDate}
                              />
                              <button
                                onClick={() =>
                                  restoreEntity(
                                    "Photographer",
                                    item.id,
                                    getDisplayName(item)
                                  )
                                }
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition duration-200"
                              >
                                Restore
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Clients */}
              {scheduledDeletions?.clients &&
                scheduledDeletions.clients.length > 0 && (
                  <div key="clients-section">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                      <span className="mr-2">👥</span>
                      Clients ({scheduledDeletions.clients.length})
                    </h3>
                    <div className="space-y-2">
                      {scheduledDeletions.clients.map((item) => {
                        const daysRemaining = getDaysRemaining(
                          item.scheduledDeletionDate
                        );
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50"
                          >
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">
                                {item.clientName} ({item.username})
                              </p>
                              <p className="text-sm text-gray-600">
                                Reason: {item.deletionReason}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                Marked: {formatDate(item.deletedAt)} • Will
                                delete: {formatDate(item.scheduledDeletionDate)}
                              </p>
                            </div>
                            <div className="flex items-center space-x-3">
                              <CountdownTimer
                                targetDate={item.scheduledDeletionDate}
                              />
                              <button
                                onClick={() =>
                                  restoreEntity(
                                    "Client",
                                    item.id,
                                    getDisplayName(item)
                                  )
                                }
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition duration-200"
                              >
                                Restore
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Guests */}
              {scheduledDeletions?.guests &&
                scheduledDeletions.guests.length > 0 && (
                  <div key="guests-section">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                      <span className="mr-2">🎫</span>
                      Guests ({scheduledDeletions.guests.length})
                    </h3>
                    <div className="space-y-2">
                      {scheduledDeletions.guests.map((item) => {
                        const daysRemaining = getDaysRemaining(
                          item.scheduledDeletionDate
                        );
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50"
                          >
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">
                                {item.guestName} ({item.username})
                              </p>
                              <p className="text-sm text-gray-600">
                                Reason: {item.deletionReason}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                Marked: {formatDate(item.deletedAt)} • Will
                                delete: {formatDate(item.scheduledDeletionDate)}
                              </p>
                            </div>
                            <div className="flex items-center space-x-3">
                              <CountdownTimer
                                targetDate={item.scheduledDeletionDate}
                              />
                              <button
                                onClick={() =>
                                  restoreEntity(
                                    "Guest",
                                    item.id,
                                    getDisplayName(item)
                                  )
                                }
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition duration-200"
                              >
                                Restore
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Photos */}
              {scheduledDeletions?.photos &&
                scheduledDeletions.photos.length > 0 && (
                  <div key="photos-section">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                      <span className="mr-2">📸</span>
                      Photos ({scheduledDeletions.photos.length})
                    </h3>
                    <div className="space-y-2">
                      {scheduledDeletions.photos.map((item) => {
                        const daysRemaining = getDaysRemaining(
                          item.scheduledDeletionDate
                        );
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50"
                          >
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">
                                {item.originalName}
                              </p>
                              <p className="text-sm text-gray-600">
                                Reason: {item.deletionReason}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                Marked: {formatDate(item.deletedAt)} • Will
                                delete: {formatDate(item.scheduledDeletionDate)}
                              </p>
                            </div>
                            <div className="flex items-center space-x-3">
                              <span
                                className={`text-sm font-medium px-3 py-1 rounded-full ${
                                  daysRemaining <= 1
                                    ? "bg-red-100 text-red-800"
                                    : daysRemaining <= 3
                                    ? "bg-orange-100 text-orange-800"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {daysRemaining}{" "}
                                {daysRemaining === 1 ? "day" : "days"} left
                              </span>
                              <button
                                onClick={() =>
                                  restoreEntity(
                                    "Photo",
                                    item.id,
                                    getDisplayName(item)
                                  )
                                }
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition duration-200"
                              >
                                Restore
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* Collections */}
              {scheduledDeletions?.collections &&
                scheduledDeletions.collections.length > 0 && (
                  <div key="collections-section">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                      <span className="mr-2">📁</span>
                      Collections ({scheduledDeletions.collections.length})
                    </h3>
                    <div className="space-y-2">
                      {scheduledDeletions.collections.map((item) => {
                        const daysRemaining = getDaysRemaining(
                          item.scheduledDeletionDate
                        );
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50"
                          >
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">
                                {item.name}
                              </p>
                              <p className="text-sm text-gray-600">
                                Reason: {item.deletionReason}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                Marked: {formatDate(item.deletedAt)} • Will
                                delete: {formatDate(item.scheduledDeletionDate)}
                              </p>
                            </div>
                            <div className="flex items-center space-x-3">
                              <span
                                className={`text-sm font-medium px-3 py-1 rounded-full ${
                                  daysRemaining <= 1
                                    ? "bg-red-100 text-red-800"
                                    : daysRemaining <= 3
                                    ? "bg-orange-100 text-orange-800"
                                    : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {daysRemaining}{" "}
                                {daysRemaining === 1 ? "day" : "days"} left
                              </span>
                              <button
                                onClick={() =>
                                  restoreEntity(
                                    "PhotoCollection",
                                    item.id,
                                    getDisplayName(item)
                                  )
                                }
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition duration-200"
                              >
                                Restore
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                🔧 Admin Dashboard
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Welcome back, {user?.username}
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
        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab("overview")}
                className={`${
                  activeTab === "overview"
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                📊 Overview
              </button>
              <button
                onClick={() => setActiveTab("photographers")}
                className={`${
                  activeTab === "photographers"
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                📷 Photographers ({photographers.length})
              </button>
              <button
                onClick={() => setActiveTab("clients")}
                className={`${
                  activeTab === "clients"
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                👥 Clients ({clients.length})
              </button>
              {/* REMOVED - Guest functionality disabled */}
              {/* <button
                onClick={() => setActiveTab("guests")}
                className={`${
                  activeTab === "guests"
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                🎫 Guests ({guests.length})
              </button> */}
              <button
                onClick={() => setActiveTab("collections")}
                className={`${
                  activeTab === "collections"
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                📁 Collections ({collections.length})
              </button>
              <button
                onClick={() => setActiveTab("photos")}
                className={`${
                  activeTab === "photos"
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                📸 Photos ({photos.length})
              </button>
              <button
                onClick={() => setActiveTab("pending-deletions")}
                className={`${
                  activeTab === "pending-deletions"
                    ? "border-indigo-500 text-indigo-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
              >
                🗑️ Pending Deletions ({scheduledDeletions?.total || 0})
              </button>
            </nav>
          </div>
        </div>
        {/* Tab Content */}
        {activeTab === "overview" && renderOverview()}
        {activeTab === "photographers" && renderPhotographers()}
        {activeTab === "clients" && renderClients()}
        {/* {activeTab === "guests" && renderGuests()} */}{" "}
        {/* REMOVED - Guest functionality disabled */}
        {activeTab === "collections" && renderCollections()}
        {activeTab === "photos" && renderPhotos()}
        {activeTab === "pending-deletions" && renderPendingDeletions()}
      </div>
    </div>
  );
};

export default AdminDashboard;
