"use client";

import { useState, useEffect } from "react";

interface CountdownTimerProps {
  targetDate: string | null;
  className?: string;
}

export default function CountdownTimer({
  targetDate,
  className = "",
}: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false,
  });

  useEffect(() => {
    // If no targetDate, don't set up timer
    if (!targetDate) return;

    const calculateTimeLeft = () => {
      const target = new Date(targetDate).getTime();
      const now = new Date().getTime();
      const difference = target - now;

      if (difference <= 0) {
        return {
          days: 0,
          hours: 0,
          minutes: 0,
          seconds: 0,
          isExpired: true,
        };
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor(
          (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        ),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000),
        isExpired: false,
      };
    };

    // Initial calculation
    setTimeLeft(calculateTimeLeft());

    // Update every second
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  // If no targetDate set yet (waiting for photos to be uploaded)
  if (!targetDate) {
    return (
      <span
        className={`text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800 ${className}`}
      >
        ⏳ Waiting for photos
      </span>
    );
  }

  if (timeLeft.isExpired) {
    return (
      <span
        className={`text-xs px-2 py-1 rounded-full bg-red-100 text-red-800 ${className}`}
      >
        ⏱️ Expired
      </span>
    );
  }

  const getBadgeColor = () => {
    if (timeLeft.days === 0) return "bg-red-100 text-red-800";
    if (timeLeft.days <= 3) return "bg-red-100 text-red-800";
    if (timeLeft.days <= 7) return "bg-yellow-100 text-yellow-800";
    return "bg-gray-100 text-gray-800";
  };

  return (
    <span
      className={`text-xs px-2 py-1 rounded-full ${getBadgeColor()} ${className}`}
      title={`Auto-deletes on ${new Date(targetDate).toLocaleString()}`}
    >
      ⏱️ {timeLeft.days > 0 && `${timeLeft.days}d `}
      {String(timeLeft.hours).padStart(2, "0")}:
      {String(timeLeft.minutes).padStart(2, "0")}:
      {String(timeLeft.seconds).padStart(2, "0")}
    </span>
  );
}
