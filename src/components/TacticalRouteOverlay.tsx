import React from 'react';

// SVG Path definition in 1920x1080 coordinate space matching the reference image route
export const ROUTE_SVG_PATH = `
  M 985 540
  C 990 480, 1040 454, 1083 454
  C 1140 454, 1220 495, 1260 460
  C 1290 435, 1295 360, 1310 320
  C 1340 270, 1450 260, 1520 307
  C 1565 338, 1575 420, 1565 520
  C 1555 590, 1530 635, 1580 635
  C 1625 635, 1645 680, 1630 730
  C 1610 775, 1535 785, 1475 750
  C 1420 715, 1370 780, 1315 745
  C 1265 710, 1295 650, 1285 635
  C 1270 610, 1200 625, 1145 631
  C 1070 640, 1010 615, 985 570
  Z
`.trim().replace(/\s+/g, ' ');

interface TacticalRouteOverlayProps {
  isVisible: boolean;
}

export const TacticalRouteOverlay: React.FC<TacticalRouteOverlayProps> = ({
  isVisible,
}) => {
  if (!isVisible) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      <svg
        viewBox="0 0 1920 1080"
        className="w-full h-full object-fill absolute inset-0"
        preserveAspectRatio="none"
      >
        <defs>
          {/* Intense golden-amber outer bloom */}
          <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="8" result="blur1" />
            <feGaussianBlur stdDeviation="16" result="blur2" />
            <feMerge>
              <feMergeNode in="blur2" />
              <feMergeNode in="blur1" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Ambient route glow underlay */}
        <path
          d={ROUTE_SVG_PATH}
          fill="none"
          stroke="rgba(245, 176, 65, 0.45)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#routeGlow)"
        />

        {/* Main sharp yellow route spline */}
        <path
          d={ROUTE_SVG_PATH}
          fill="none"
          stroke="#f5b041"
          strokeWidth="3.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Subtle animated energy pulses flowing along the route */}
        <path
          d={ROUTE_SVG_PATH}
          fill="none"
          stroke="#fff4cc"
          strokeWidth="2.5"
          strokeDasharray="16 120"
          className="animate-energy-loop"
          strokeLinecap="round"
        />

        {/* Directional Triangles along segments */}
        <polygon points="1285,395 1295,385 1290,405" fill="#f5b041" />
        <polygon points="1355,285 1370,280 1365,295" fill="#f5b041" />
        <polygon points="1575,440 1565,455 1582,455" fill="#f5b041" />
        <polygon points="1630,710 1620,725 1612,710" fill="#f5b041" />
        <polygon points="1475,758 1460,763 1472,772" fill="#f5b041" />
        <polygon points="1382,776 1370,782 1380,790" fill="#f5b041" />
        <polygon points="1030,595 1015,585 1025,575" fill="#f5b041" />

        {/* Clean circular waypoint nodes along the route (No icons/coins) */}
        {[
          { x: 1083, y: 454 },
          { x: 1310, y: 320 },
          { x: 1520, y: 307 },
          { x: 1565, y: 520 },
          { x: 1630, y: 730 },
          { x: 1285, y: 635 },
        ].map((pt, i) => (
          <g key={i}>
            <circle
              cx={pt.x}
              cy={pt.y}
              r={7}
              fill="rgba(24, 20, 16, 0.95)"
              stroke="#f5b041"
              strokeWidth="2"
            />
            <circle cx={pt.x} cy={pt.y} r={2.5} fill="#ffffff" />
          </g>
        ))}
      </svg>
    </div>
  );
};
