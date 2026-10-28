import React from 'react';
import { RoutePoint } from '../types';

interface RouteIslandThumbnailProps {
  points?: RoutePoint[];
  loop?: boolean;
  className?: string;
}

export const RouteIslandThumbnail: React.FC<RouteIslandThumbnailProps> = ({
  className = '',
}) => {
  return (
    <div
      className={`relative w-full h-full rounded-xl overflow-hidden bg-[#03060d] border border-cyan-900/50 flex items-center justify-center select-none shadow-[inset_0_0_15px_rgba(0,0,0,0.9)] ${className}`}
    >
      {/* Authentic High-Resolution Volumetric 3D Isometric Terrain Island from image_a5e4115a.png */}
      <img
        src="/assets/aistudio/route_3d_island_clean2.png"
        alt="3D Карта маршрута"
        className="w-full h-full object-cover rounded-xl"
        loading="eager"
      />

      {/* Subtle Ambient Glow Border & Depth Vignette */}
      <div className="absolute inset-0 rounded-xl pointer-events-none shadow-[inset_0_0_12px_rgba(6,182,212,0.18)]" />
    </div>
  );
};
