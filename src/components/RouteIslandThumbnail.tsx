import React, { useMemo } from 'react';
import { RoutePoint } from '../types';

interface RouteIslandThumbnailProps {
  points?: RoutePoint[];
  loop?: boolean;
  className?: string;
}

export const RouteIslandThumbnail: React.FC<RouteIslandThumbnailProps> = ({
  points = [],
  loop = true,
  className = '',
}) => {
  // Generate SVG path for route: dynamic if points exist, or authentic default runic trajectory
  const { pathData, waypoints } = useMemo(() => {
    if (points && points.length > 3) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      points.forEach(p => {
        const x = p[0];
        const y = p[1];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      });

      const spanX = Math.max(maxX - minX, 0.001);
      const spanY = Math.max(maxY - minY, 0.001);
      const padding = 14;
      const width = 100 - padding * 2;
      const height = 100 - padding * 2;

      const normPts = points.map(p => ({
        x: padding + ((p[0] - minX) / spanX) * width,
        y: padding + ((p[1] - minY) / spanY) * height,
      }));

      let d = `M ${normPts[0].x.toFixed(1)} ${normPts[0].y.toFixed(1)}`;
      for (let i = 1; i < normPts.length; i++) {
        d += ` L ${normPts[i].x.toFixed(1)} ${normPts[i].y.toFixed(1)}`;
      }
      if (loop) d += ' Z';

      // Pick 3-4 notable waypoints for ruby seals
      const seals = [
        normPts[0],
        normPts[Math.floor(normPts.length * 0.33)],
        normPts[Math.floor(normPts.length * 0.66)],
      ];

      return { pathData: d, waypoints: seals };
    }

    // Default authentic Warcraft fantasy loop trajectory
    if (loop) {
      return {
        pathData: 'M 22,50 C 20,25 38,18 55,24 C 74,30 84,22 82,45 C 80,68 70,82 48,78 C 30,75 24,68 22,50 Z',
        waypoints: [
          { x: 22, y: 50 },
          { x: 55, y: 24 },
          { x: 82, y: 45 },
          { x: 48, y: 78 },
        ],
      };
    }

    // Default back-and-forth trajectory
    return {
      pathData: 'M 18,72 Q 32,28 50,48 T 84,24',
      waypoints: [
        { x: 18, y: 72 },
        { x: 50, y: 48 },
        { x: 84, y: 24 },
      ],
    };
  }, [points, loop]);

  return (
    <div
      className={`relative w-full h-full rounded-lg overflow-hidden border-2 border-[#785a28] flex items-center justify-center select-none shadow-[inset_0_0_16px_rgba(0,0,0,0.95)] ${className}`}
      style={{
        background: 'radial-gradient(circle at 50% 50%, #2a1f18 0%, #17100c 75%, #0d0907 100%)',
      }}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full pointer-events-none"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Golden Rune Glow Filter */}
          <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Parchment texture gradient */}
          <radialGradient id="parchmentLight" cx="45%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#4a3725" stopOpacity="0.45" />
            <stop offset="60%" stopColor="#2c1f14" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#140c08" stopOpacity="0.95" />
          </radialGradient>
        </defs>

        {/* Vintage Parchment Wash */}
        <rect width="100" height="100" fill="url(#parchmentLight)" />

        {/* Ancient Topographic Elevation Contours (Sepia / Umber) */}
        <path
          d="M 12,28 Q 28,15 45,22 T 88,32"
          fill="none"
          stroke="#5a4224"
          strokeWidth="0.8"
          strokeDasharray="2,3"
          opacity="0.5"
        />
        <path
          d="M 10,50 Q 25,38 48,44 T 92,48"
          fill="none"
          stroke="#5a4224"
          strokeWidth="0.8"
          strokeDasharray="1.5,2.5"
          opacity="0.45"
        />
        <path
          d="M 15,75 Q 35,62 60,70 T 88,68"
          fill="none"
          stroke="#5a4224"
          strokeWidth="0.8"
          strokeDasharray="2,3"
          opacity="0.5"
        />
        <circle cx="50" cy="50" r="38" fill="none" stroke="#4a351b" strokeWidth="0.75" opacity="0.35" />
        <circle cx="50" cy="50" r="26" fill="none" stroke="#4a351b" strokeWidth="0.75" strokeDasharray="3,3" opacity="0.3" />

        {/* Classic Warcraft Nautical Compass Rose (Top Right) */}
        <g transform="translate(82, 18) scale(0.65)" opacity="0.65">
          <circle cx="0" cy="0" r="10" fill="none" stroke="#c89b3c" strokeWidth="0.8" />
          {/* North needle */}
          <polygon points="0,-12 3,0 0,2 -3,0" fill="#dc2626" />
          {/* South needle */}
          <polygon points="0,12 3,0 0,-2 -3,0" fill="#c89b3c" />
          {/* East/West needles */}
          <polygon points="12,0 0,3 -2,0 0,-3" fill="#8c6b32" />
          <polygon points="-12,0 0,3 2,0 0,-3" fill="#8c6b32" />
          <circle cx="0" cy="0" r="1.5" fill="#f0b232" />
        </g>

        {/* Golden Runic Trajectory Route */}
        {/* Underlay glow */}
        <path
          d={pathData}
          fill="none"
          stroke="#c89b3c"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.4"
          filter="url(#goldGlow)"
        />
        {/* Core gleaming gold line */}
        <path
          d={pathData}
          fill="none"
          stroke="#f0b232"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#goldGlow)"
        />
        {/* Inner bright highlight */}
        <path
          d={pathData}
          fill="none"
          stroke="#fff0a6"
          strokeWidth="0.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.9"
        />

        {/* Horde Ruby Red Waypoint Seals with Gold Rims */}
        {waypoints.map((wp, i) => (
          <g key={i} transform={`translate(${wp.x}, ${wp.y})`}>
            {/* Outer gold rim */}
            <circle cx="0" cy="0" r="3.2" fill="#785a28" stroke="#f0b232" strokeWidth="0.8" />
            {/* Ruby inner core */}
            <circle cx="0" cy="0" r="2.2" fill={i === 0 ? '#ef4444' : '#dc2626'} />
            {/* Specular glint */}
            <circle cx="-0.8" cy="-0.8" r="0.8" fill="#ffffff" opacity="0.8" />
          </g>
        ))}

        {/* Ornate Corner Metal Brackets */}
        <path d="M 3,12 L 3,3 L 12,3" fill="none" stroke="#c89b3c" strokeWidth="1.2" opacity="0.7" />
        <path d="M 97,12 L 97,3 L 88,3" fill="none" stroke="#c89b3c" strokeWidth="1.2" opacity="0.7" />
        <path d="M 3,88 L 3,97 L 12,97" fill="none" stroke="#c89b3c" strokeWidth="1.2" opacity="0.7" />
        <path d="M 97,88 L 97,97 L 88,97" fill="none" stroke="#c89b3c" strokeWidth="1.2" opacity="0.7" />
      </svg>

      {/* Subtle Inner Antique Vignette */}
      <div className="absolute inset-0 rounded-lg pointer-events-none shadow-[inset_0_0_12px_rgba(0,0,0,0.85)]" />
    </div>
  );
};
