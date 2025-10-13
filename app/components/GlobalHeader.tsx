"use client";

import React from "react";
import DarkModeToggle from "./DarkModeToggle";

const GlobalHeader: React.FC = () => {
  return (
    <header className="w-full site-header">
      <div className="app-container flex items-center justify-between py-2">
        <div className="flex flex-col">
          <div className="logo text-sm">
            Stoyanography <span className="accent">Share</span>
          </div>
          <div className="text-xs small-muted">
            Privacy-first photo sharing for professional photographers
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DarkModeToggle />
        </div>
      </div>
    </header>
  );
};

export default GlobalHeader;
