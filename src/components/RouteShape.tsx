import React from 'react';

export type RouteShapeType = 'square' | 'cross' | 'triangle' | 'circle';

export interface RouteShapeDefinition {
  type: RouteShapeType;
  labelRu: string;
  labelEn: string;
}

export const ROUTE_SHAPES: RouteShapeDefinition[] = [
  { type: 'square', labelRu: 'Квадрат', labelEn: 'Square' },
  { type: 'cross', labelRu: 'Крестик', labelEn: 'Cross' },
  { type: 'triangle', labelRu: 'Треугольник', labelEn: 'Triangle' },
  { type: 'circle', labelRu: 'Круг', labelEn: 'Circle' },
];

/**
 * Maps a numerical route index (color_index or route array index)
 * to one of the 4 monochrome geometric shapes:
 * 0 -> Square (квадрат)
 * 1 -> Cross (крестик)
 * 2 -> Triangle (треугольник)
 * 3 -> Circle (круг)
 */
export function getRouteShape(index: number = 0): RouteShapeType {
  const normalized = Math.abs(Math.floor(index)) % 4;
  switch (normalized) {
    case 0:
      return 'square';
    case 1:
      return 'cross';
    case 2:
      return 'triangle';
    case 3:
    default:
      return 'circle';
  }
}

export interface RouteShapeIconProps {
  shape?: RouteShapeType;
  index?: number;
  className?: string;
  size?: number;
  title?: string;
}

/**
 * High-definition crisp vector SVG shape in monochrome white/black style.
 * In dark mode it is bright white; in light mode dark zinc.
 */
export const RouteShapeIcon: React.FC<RouteShapeIconProps> = ({
  shape,
  index = 0,
  className = 'w-3 h-3 text-zinc-950 dark:text-white',
  size,
  title,
}) => {
  const activeShape = shape || getRouteShape(index);
  const sizeStyle = size ? { width: `${size}px`, height: `${size}px` } : undefined;

  switch (activeShape) {
    case 'square':
      return (
        <svg
          viewBox="0 0 10 10"
          className={className}
          style={sizeStyle}
          fill="currentColor"
          aria-label={title || 'square'}
        >
          {title && <title>{title}</title>}
          <rect x="1.5" y="1.5" width="7" height="7" rx="0.5" />
        </svg>
      );
    case 'cross':
      return (
        <svg
          viewBox="0 0 10 10"
          className={className}
          style={sizeStyle}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
          aria-label={title || 'cross'}
        >
          {title && <title>{title}</title>}
          <line x1="2" y1="2" x2="8" y2="8" />
          <line x1="8" y1="2" x2="2" y2="8" />
        </svg>
      );
    case 'triangle':
      return (
        <svg
          viewBox="0 0 10 10"
          className={className}
          style={sizeStyle}
          fill="currentColor"
          aria-label={title || 'triangle'}
        >
          {title && <title>{title}</title>}
          <polygon points="5,1.5 9,8.5 1,8.5" />
        </svg>
      );
    case 'circle':
    default:
      return (
        <svg
          viewBox="0 0 10 10"
          className={className}
          style={sizeStyle}
          fill="currentColor"
          aria-label={title || 'circle'}
        >
          {title && <title>{title}</title>}
          <circle cx="5" cy="5" r="3.5" />
        </svg>
      );
  }
};
