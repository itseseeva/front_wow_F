import React, { useRef, useCallback, CSSProperties, HTMLAttributes, ReactNode } from 'react';

export interface SpecularProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  borderGlowColor?: string;
  surfaceGlowColor?: string;
  disabled?: boolean;
}

export const SpecularCard = React.forwardRef<HTMLDivElement, SpecularProps>(({
  children,
  className = '',
  style,
  borderGlowColor = 'rgba(255, 255, 255, 0.55)',
  surfaceGlowColor = 'rgba(255, 255, 255, 0.06)',
  disabled = false,
  ...props
}, ref) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const setMergedRef = useCallback((node: HTMLDivElement | null) => {
    containerRef.current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }
  }, [ref]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      containerRef.current.style.setProperty('--mouse-x', `${x}px`);
      containerRef.current.style.setProperty('--mouse-y', `${y}px`);
      containerRef.current.style.setProperty('--specular-opacity', '1');
    },
    [disabled]
  );

  const handleMouseLeave = useCallback(() => {
    if (!containerRef.current) return;
    containerRef.current.style.setProperty('--specular-opacity', '0');
  }, []);

  return (
    <div
      ref={setMergedRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`specular-container card-specular relative overflow-hidden transition-all duration-200 select-none ${className}`}
      style={{
        '--border-glow-color': borderGlowColor,
        '--surface-glow-color': surfaceGlowColor,
        ...style,
      } as CSSProperties}
      {...props}
    >
      {/* Layer 1: Sharp 1px Specular Border */}
      <span className="specular-border pointer-events-none absolute inset-0 z-10 transition-opacity duration-300" />

      {/* Layer 2: Wide Soft Surface Sheen */}
      <span className="specular-sheen pointer-events-none absolute inset-0 z-0 transition-opacity duration-300" />

      {/* Actual Content */}
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  );
});

SpecularCard.displayName = 'SpecularCard';

export interface SpecularButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  borderGlowColor?: string;
  surfaceGlowColor?: string;
}

export const SpecularButton = React.forwardRef<HTMLButtonElement, SpecularButtonProps>(({
  children,
  className = '',
  style,
  borderGlowColor = 'rgba(255, 255, 255, 0.7)',
  surfaceGlowColor = 'rgba(255, 255, 255, 0.08)',
  disabled = false,
  ...props
}, ref) => {
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const setMergedRef = useCallback((node: HTMLButtonElement | null) => {
    buttonRef.current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref) {
      (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
    }
  }, [ref]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || !buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      buttonRef.current.style.setProperty('--mouse-x', `${x}px`);
      buttonRef.current.style.setProperty('--mouse-y', `${y}px`);
      buttonRef.current.style.setProperty('--specular-opacity', '1');
    },
    [disabled]
  );

  const handleMouseLeave = useCallback(() => {
    if (!buttonRef.current) return;
    buttonRef.current.style.setProperty('--specular-opacity', '0');
  }, []);

  return (
    <button
      ref={setMergedRef}
      disabled={disabled}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`specular-container btn-specular relative overflow-hidden transition-all duration-150 select-none active:scale-[0.98] ${className}`}
      style={{
        '--border-glow-color': borderGlowColor,
        '--surface-glow-color': surfaceGlowColor,
        ...style,
      } as CSSProperties}
      {...props}
    >
      {/* Layer 1: Sharp 1px Specular Border */}
      <span className="specular-border pointer-events-none absolute inset-0 z-10 transition-opacity duration-300" />

      {/* Layer 2: Wide Soft Surface Sheen */}
      <span className="specular-sheen pointer-events-none absolute inset-0 z-0 transition-opacity duration-300" />

      {/* Actual Content */}
      <span className="relative z-10 inline-flex items-center justify-center gap-1.5 w-full h-full">
        {children}
      </span>
    </button>
  );
});

SpecularButton.displayName = 'SpecularButton';
