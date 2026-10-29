import React from 'react';

export const TacticalPerimeterRulers: React.FC = () => {
  return (
    <div className="absolute inset-0 pointer-events-none select-none z-10 overflow-hidden font-mono text-[10px] text-white/20">
      {/* Top Technical Ruler */}
      <div className="absolute top-0 left-0 right-0 h-7 flex items-center border-b border-white/10 px-4">
        {/* Ticks pattern */}
        <div className="w-full h-full flex justify-between items-end pb-1 relative">
          {Array.from({ length: 60 }).map((_, i) => (
            <div
              key={`top-tick-${i}`}
              className={`w-px bg-white/20 ${i % 10 === 0 ? 'h-3.5 bg-white/40' : i % 5 === 0 ? 'h-2' : 'h-1'}`}
            />
          ))}
          {/* Numbers from reference: 60, 70, 70, 180, 180, 180 */}
          <span className="absolute left-[16.5%] top-1">60</span>
          <span className="absolute left-[31.2%] top-1">70</span>
          <span className="absolute left-[46.8%] top-1">70</span>
          <span className="absolute left-[62.5%] top-1">180</span>
          <span className="absolute left-[78.8%] top-1">180</span>
          <span className="absolute left-[95.2%] top-1">180</span>
        </div>
      </div>

      {/* Bottom Technical Ruler */}
      <div className="absolute bottom-0 left-0 right-0 h-7 flex items-center border-t border-white/10 px-4">
        <div className="w-full h-full flex justify-between items-start pt-1 relative">
          {Array.from({ length: 60 }).map((_, i) => (
            <div
              key={`bot-tick-${i}`}
              className={`w-px bg-white/20 ${i % 10 === 0 ? 'h-3.5 bg-white/40' : i % 5 === 0 ? 'h-2' : 'h-1'}`}
            />
          ))}
          {/* Numbers: 120, 200, 21, 250, 250, 200 */}
          <span className="absolute left-[12.4%] bottom-1">120</span>
          <span className="absolute left-[28.4%] bottom-1">200</span>
          <span className="absolute left-[46.2%] bottom-1">21</span>
          <span className="absolute left-[62.8%] bottom-1">250</span>
          <span className="absolute left-[78.4%] bottom-1">250</span>
          <span className="absolute left-[94.8%] bottom-1">200</span>
        </div>
      </div>

      {/* Left Technical Ruler */}
      <div className="absolute top-7 bottom-7 left-0 w-7 border-r border-white/10 py-4 flex flex-col justify-between items-end pr-1">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={`left-tick-${i}`}
            className={`h-px bg-white/20 ${i % 5 === 0 ? 'w-3.5 bg-white/40' : 'w-1.5'}`}
          />
        ))}
        {/* Left numbers: 260, 100, 180 */}
        <span className="absolute top-[13.5%] left-1 rotate-[-90deg] origin-left">260</span>
        <span className="absolute top-[40.2%] left-1 rotate-[-90deg] origin-left">100</span>
        <span className="absolute top-[67.5%] left-1 rotate-[-90deg] origin-left">180</span>
      </div>

      {/* Right Technical Ruler */}
      <div className="absolute top-7 bottom-7 right-0 w-7 border-l border-white/10 py-4 flex flex-col justify-between items-start pl-1">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={`right-tick-${i}`}
            className={`h-px bg-white/20 ${i % 5 === 0 ? 'w-3.5 bg-white/40' : 'w-1.5'}`}
          />
        ))}
        {/* Right numbers: 480, 180 */}
        <span className="absolute top-[31.5%] right-1 rotate-[90deg] origin-right">480</span>
        <span className="absolute top-[65.2%] right-1 rotate-[90deg] origin-right">180</span>
      </div>

      {/* Subtle Tactical Grid Crosshair Lines */}
      <div className="absolute top-[42%] left-0 right-0 h-px bg-white/[0.04] border-b border-dashed border-white/[0.06]" />
      <div className="absolute top-[78%] left-0 right-0 h-px bg-white/[0.04] border-b border-dashed border-white/[0.06]" />
      <div className="absolute left-[35.5%] top-0 bottom-0 w-px bg-white/[0.04] border-r border-dashed border-white/[0.06]" />
      <div className="absolute left-[74.5%] top-0 bottom-0 w-px bg-white/[0.04] border-r border-dashed border-white/[0.06]" />
      <div className="absolute left-[95.2%] top-0 bottom-0 w-px bg-white/[0.04] border-r border-dashed border-white/[0.06]" />

      {/* Crosshair intersections */}
      <div className="absolute top-[42%] left-[35.5%] -translate-x-1/2 -translate-y-1/2 w-3 h-3 border border-white/10 flex items-center justify-center">
        <div className="w-1 h-1 bg-white/20 rounded-full" />
      </div>
      <div className="absolute top-[42%] left-[74.5%] -translate-x-1/2 -translate-y-1/2 w-3 h-3 border border-white/10 flex items-center justify-center">
        <div className="w-1 h-1 bg-white/20 rounded-full" />
      </div>
      <div className="absolute top-[78%] left-[74.5%] -translate-x-1/2 -translate-y-1/2 w-3 h-3 border border-white/10 flex items-center justify-center">
        <div className="w-1 h-1 bg-white/20 rounded-full" />
      </div>
    </div>
  );
};
