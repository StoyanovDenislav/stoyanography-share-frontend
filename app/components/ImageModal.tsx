"use client";

import React, { useEffect, useState } from "react";
import { useSwipeable } from "react-swipeable";

interface ImageModalProps {
  currentImage: number;
  images: string[]; // Base64 data URLs
  onClose: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({
  currentImage,
  images,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(currentImage);
  const [isChanging, setIsChanging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [direction, setDirection] = useState("");
  const [zoomLevel, setZoomLevel] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });
  const MAX_ZOOM_LEVEL = 3;

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 300);
  };

  const handleNext = () => {
    if (isChanging) return;
    setIsChanging(true);
    setDirection("right");
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
    setTimeout(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
      setIsChanging(false);
    }, 190);
  };

  const handlePrev = () => {
    if (isChanging) return;
    setIsChanging(true);
    setDirection("left");
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
    setTimeout(() => {
      setCurrentIndex(
        (prevIndex) => (prevIndex - 1 + images.length) % images.length
      );
      setIsChanging(false);
    }, 190);
  };

  const handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    const zoomIncrement = event.deltaY > 0 ? -0.1 : 0.1;
    setZoomLevel((prev) => {
      const newZoomLevel = Math.min(
        MAX_ZOOM_LEVEL,
        Math.max(1, prev + zoomIncrement)
      );
      if (newZoomLevel === 1) {
        setPosition({ x: 0, y: 0 });
      }
      return newZoomLevel;
    });
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    if (zoomLevel > 1) {
      setIsDragging(true);
      setStartPosition({
        x: event.clientX - position.x,
        y: event.clientY - position.y,
      });
    }
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: event.clientX - startPosition.x,
        y: event.clientY - startPosition.y,
      });
    }
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    if (isDragging && event.touches.length === 1) {
      const touch = event.touches[0];
      setPosition({
        x: touch.clientX - startPosition.x,
        y: touch.clientY - startPosition.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    if (zoomLevel > 1 && event.touches.length === 1) {
      const touch = event.touches[0];
      setIsDragging(true);
      setStartPosition({
        x: touch.clientX - position.x,
        y: touch.clientY - position.y,
      });
    }
  };

  const handleDoubleClick = () => {
    setZoomLevel(1);
    setPosition({ x: 0, y: 0 });
  };

  const handlers = useSwipeable({
    onSwipedLeft: () => handleNext(),
    onSwipedRight: () => handlePrev(),
    trackMouse: true,
  });

  useEffect(() => {
    setCurrentIndex(currentImage);
  }, [currentImage]);

  useEffect(() => {
    const imgContainer = document.getElementById("image-container");
    imgContainer?.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      imgContainer?.removeEventListener("wheel", handleWheel);
    };
  }, [zoomLevel]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        handleNext();
      } else if (event.key === "ArrowLeft") {
        handlePrev();
      } else if (event.key === "Escape") {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentIndex]);

  return (
    <div
      {...handlers}
      className={`fixed inset-0 flex flex-col justify-center items-center bg-black bg-opacity-90 z-50 transition-medium ${
        isClosing ? "opacity-0" : "opacity-100"
      }`}
    >
      <div
        id="image-container"
        className="relative w-full h-full flex items-center justify-center overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      >
        <button
          onClick={handlePrev}
          className="absolute top-1/2 left-5 transform -translate-y-1/2 text-white text-4xl z-10 hover:scale-110 transition-fast transform-smooth"
        >
          ←
        </button>
        <button
          onClick={handleClose}
          className="absolute top-5 right-5 text-white text-2xl z-10 hover:scale-110 transition-fast transform-smooth"
        >
          ✕
        </button>
        <button
          onClick={handleNext}
          className="absolute top-1/2 right-5 transform -translate-y-1/2 text-white text-4xl z-10 hover:scale-110 transition-fast transform-smooth"
        >
          →
        </button>
        <div className="flex items-center justify-center h-full">
          <img
            className={`transition-all duration-300 ease-in-out ${
              isChanging ? "opacity-0 scale-95" : "opacity-100 scale-100"
            }`}
            style={{
              transform: `scale(${zoomLevel}) translate(${
                position.x / zoomLevel
              }px, ${position.y / zoomLevel}px)`,
              maxWidth: "90%",
              maxHeight: "90%",
              cursor:
                zoomLevel > 1 ? (isDragging ? "grabbing" : "grab") : "default",
              userSelect: "none",
            }}
            src={images[currentIndex]}
            alt={`Photo ${currentIndex + 1}`}
            draggable={false}
          />
        </div>
        <div className="absolute bottom-5 text-white text-sm">
          {currentIndex + 1} / {images.length}
        </div>
      </div>
    </div>
  );
};

export default ImageModal;
