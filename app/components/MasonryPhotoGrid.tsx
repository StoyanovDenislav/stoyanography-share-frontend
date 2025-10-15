"use client";

import React, { useState } from "react";
import Masonry from "react-masonry-css";
import ImageModal from "./ImageModal";
import axios from "axios";

interface Photo {
  id: string;
  shareToken: string; // Add shareToken for API calls
  filename: string;
  originalName: string;
  uploadedAt: string;
  size: number;
  thumbnailDataB64: string;
  photoDataB64?: string;
  selected?: boolean;
}

interface MasonryPhotoGridProps {
  photos: Photo[];
  onPhotoClick?: (photo: Photo) => void;
  onPhotoDelete?: (photoId: string) => void;
  showDeleteButton?: boolean;
  onPhotoSelect?: (photoId: string) => void;
  selectable?: boolean;
  userRole?: "photographer" | "client" | "guest"; // Add user role for endpoint selection
}
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:6002/api";

const MasonryPhotoGrid: React.FC<MasonryPhotoGridProps> = ({
  photos,
  onPhotoClick,
  onPhotoDelete,
  showDeleteButton = false,
  onPhotoSelect,
  selectable = false,
  userRole = "photographer", // Default to photographer for backward compatibility
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [fullSizeImages, setFullSizeImages] = useState<string[]>([]);
  const [isLoadingFullSize, setIsLoadingFullSize] = useState(false);

  const breakpointColumnsObj = {
    default: 4,
    1100: 4,
    700: 3,
    640: 2,
    480: 2,
  };

  // Convert base64 thumbnail to data URL
  const getThumbnailUrl = (photo: Photo) => {
    return `data:image/jpeg;base64,${photo.thumbnailDataB64}`;
  };

  // Fetch full-size images from the API
  const fetchFullSizeImages = async () => {
    if (fullSizeImages.length > 0) return; // Already loaded

    setIsLoadingFullSize(true);
    try {
      const imagePromises = photos.map(async (photo) => {
        try {
          // Use shareToken instead of RID, and use appropriate endpoint based on role
          const endpoint = `${API_BASE_URL}/${userRole}/photos/${encodeURIComponent(
            photo.shareToken
          )}`;
          // Cookies are sent automatically via axios.defaults.withCredentials = true
          const response = await axios.get(endpoint);
          // Convert base64 to data URI
          return `data:image/jpeg;base64,${response.data.photo.photoData}`;
        } catch (error) {
          console.error(`Failed to load photo ${photo.shareToken}:`, error);
          // Fallback to thumbnail if full size fails
          return getThumbnailUrl(photo);
        }
      });

      const images = await Promise.all(imagePromises);
      setFullSizeImages(images);
    } catch (error) {
      console.error("Error loading full-size images:", error);
      // Fallback to thumbnails
      setFullSizeImages(photos.map((photo) => getThumbnailUrl(photo)));
    } finally {
      setIsLoadingFullSize(false);
    }
  };

  const handleImageClick = async (index: number) => {
    setCurrentImageIndex(index);
    setIsModalOpen(true);

    if (onPhotoClick) {
      onPhotoClick(photos[index]);
    }

    // Fetch full-size images if not already loaded
    if (fullSizeImages.length === 0) {
      await fetchFullSizeImages();
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  if (photos.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-xl">No photos uploaded yet</p>
        <p className="text-sm mt-2">Upload your first photo to get started!</p>
      </div>
    );
  }

  return (
    <div>
      <Masonry
        breakpointCols={breakpointColumnsObj}
        className="flex -ml-4 w-auto"
        columnClassName="pl-4 bg-clip-padding"
      >
        {photos.map((photo, index) => (
          <div key={photo.id} className="mb-4 group relative fade-in">
            {selectable && onPhotoSelect && (
              <div
                className="absolute top-2 left-2 z-20 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onPhotoSelect(photo.id);
                }}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    photo.selected
                      ? "bg-indigo-600 border-2 border-indigo-600"
                      : "bg-white/80 border-2 border-gray-300 hover:border-indigo-400"
                  }`}
                >
                  {photo.selected && (
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
              </div>
            )}
            <img
              src={getThumbnailUrl(photo)}
              alt={photo.originalName}
              className={`w-full rounded-lg shadow-lg hover:shadow-2xl transition-medium transform-smooth hover:scale-105 cursor-pointer ${
                photo.selected ? "ring-4 ring-indigo-500" : ""
              }`}
              loading="lazy"
              onClick={() => handleImageClick(index)}
            />
            {showDeleteButton && onPhotoDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPhotoDelete(photo.id);
                }}
                className="absolute top-2 right-2 bg-red-600 hover:bg-red-700 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-lg z-10"
                title="Delete photo"
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
            )}
            <div className="absolute inset-0 bg-black opacity-0 group-hover:opacity-30 transition-medium rounded-lg pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3 rounded-b-lg opacity-0 group-hover:opacity-100 transition-medium pointer-events-none">
              <p className="text-white text-sm font-medium truncate">
                {photo.originalName}
              </p>
              <p className="text-white/80 text-xs">
                {new Date(photo.uploadedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </Masonry>

      {isModalOpen && (
        <>
          {isLoadingFullSize && fullSizeImages.length === 0 ? (
            <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-90 z-50">
              <div className="text-white text-xl">
                Loading full-size images...
              </div>
            </div>
          ) : (
            <ImageModal
              currentImage={currentImageIndex}
              images={
                fullSizeImages.length > 0
                  ? fullSizeImages
                  : photos.map((p) => getThumbnailUrl(p))
              }
              onClose={handleCloseModal}
            />
          )}
        </>
      )}
    </div>
  );
};

export default MasonryPhotoGrid;
