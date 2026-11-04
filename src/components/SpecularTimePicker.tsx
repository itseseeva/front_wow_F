import React, { useState, useRef, useEffect } from 'react';
import { Clock, ChevronUp, ChevronDown } from 'lucide-react';
import { soundFx } from '../utils/audio';

interface SpecularTimePickerProps {
  value: string; // "HH:MM"
  onChange: (time: string) => void;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}

export const SpecularTimePicker: React.FC<SpecularTimePickerProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
  ariaLabel,
}) => {
  const parts = value && value.includes(':') ? value.split(':') : ['10', '00'];
  const rawH = parseInt(parts[0] || '10', 10);
  const rawM = parseInt(parts[1] || '00', 10);

  const hours = isNaN(rawH) ? 10 : Math.max(0, Math.min(23, rawH));
  const minutes = isNaN(rawM) ? 0 : Math.max(0, Math.min(59, rawM));

  const formatH = String(hours).padStart(2, '0');
  const formatM = String(minutes).padStart(2, '0');

  const [isEditingH, setIsEditingH] = useState(false);
  const [isEditingM, setIsEditingM] = useState(false);
  const [tempH, setTempH] = useState(formatH);
  const [tempM, setTempM] = useState(formatM);

  const hInputRef = useRef<HTMLInputElement>(null);
  const mInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isEditingH) setTempH(formatH);
  }, [formatH, isEditingH]);

  useEffect(() => {
    if (!isEditingM) setTempM(formatM);
  }, [formatM, isEditingM]);

  const stepHour = (delta: number) => {
    if (disabled) return;
    soundFx.playClick();
    const nextH = (hours + delta + 24) % 24;
    onChange(`${String(nextH).padStart(2, '0')}:${formatM}`);
  };

  const stepMinute = (delta: number) => {
    if (disabled) return;
    soundFx.playClick();
    // Round to step of 5
    let nextM = minutes + delta * 5;
    if (nextM < 0) nextM = 55;
    else if (nextM >= 60) nextM = 0;
    else nextM = Math.round(nextM / 5) * 5;
    onChange(`${formatH}:${String(nextM).padStart(2, '0')}`);
  };

  const commitHour = (valStr: string) => {
    setIsEditingH(false);
    let val = parseInt(valStr, 10);
    if (isNaN(val)) val = hours;
    val = Math.max(0, Math.min(23, val));
    onChange(`${String(val).padStart(2, '0')}:${formatM}`);
  };

  const commitMinute = (valStr: string) => {
    setIsEditingM(false);
    let val = parseInt(valStr, 10);
    if (isNaN(val)) val = minutes;
    val = Math.max(0, Math.min(59, val));
    onChange(`${formatH}:${String(val).padStart(2, '0')}`);
  };

  const handleWheel = (e: React.WheelEvent, isH: boolean) => {
    e.preventDefault();
    if (isH) {
      stepHour(e.deltaY < 0 ? 1 : -1);
    } else {
      stepMinute(e.deltaY < 0 ? 1 : -1);
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-xl bg-black/60 border border-white/15 hover:border-white/35 text-xs font-mono text-white shadow-sm transition-all select-none ${
        disabled ? 'opacity-40 pointer-events-none' : ''
      } ${className}`}
      aria-label={ariaLabel}
    >
      {/* Hours Stepper / Input */}
      <div
        className="flex items-center group relative cursor-pointer"
        onWheel={(e) => handleWheel(e, true)}
        title="Колесо мыши или клик: изменить часы"
      >
        {isEditingH ? (
          <input
            ref={hInputRef}
            type="text"
            inputMode="numeric"
            maxLength={2}
            value={tempH}
            onChange={(e) => setTempH(e.target.value.replace(/\D/g, '').slice(0, 2))}
            onBlur={() => commitHour(tempH)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitHour(tempH);
              if (e.key === 'Escape') setIsEditingH(false);
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                stepHour(1);
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                stepHour(-1);
              }
            }}
            className="w-5 text-center font-bold bg-white text-zinc-950 rounded px-0 py-0.5 outline-none font-mono text-xs"
            autoFocus
          />
        ) : (
          <div
            onClick={() => {
              setIsEditingH(true);
              setTimeout(() => hInputRef.current?.select(), 10);
            }}
            className="flex items-center gap-0.5 px-1 py-0.5 rounded hover:bg-white/15 transition-colors font-bold text-white text-xs"
          >
            <span>{formatH}</span>
          </div>
        )}

        <div className="flex flex-col ml-0.5 opacity-60 hover:opacity-100 transition-opacity">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              stepHour(1);
            }}
            className="hover:text-white text-zinc-400 p-0 leading-none cursor-pointer"
          >
            <ChevronUp className="w-2.5 h-2.5" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              stepHour(-1);
            }}
            className="hover:text-white text-zinc-400 p-0 leading-none cursor-pointer -mt-0.5"
          >
            <ChevronDown className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      <span className="text-zinc-500 font-bold select-none text-xs">:</span>

      {/* Minutes Stepper / Input */}
      <div
        className="flex items-center group relative cursor-pointer"
        onWheel={(e) => handleWheel(e, false)}
        title="Колесо мыши или клик: изменить минуты"
      >
        {isEditingM ? (
          <input
            ref={mInputRef}
            type="text"
            inputMode="numeric"
            maxLength={2}
            value={tempM}
            onChange={(e) => setTempM(e.target.value.replace(/\D/g, '').slice(0, 2))}
            onBlur={() => commitMinute(tempM)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitMinute(tempM);
              if (e.key === 'Escape') setIsEditingM(false);
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                stepMinute(1);
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                stepMinute(-1);
              }
            }}
            className="w-5 text-center font-bold bg-white text-zinc-950 rounded px-0 py-0.5 outline-none font-mono text-xs"
            autoFocus
          />
        ) : (
          <div
            onClick={() => {
              setIsEditingM(true);
              setTimeout(() => mInputRef.current?.select(), 10);
            }}
            className="flex items-center gap-0.5 px-1 py-0.5 rounded hover:bg-white/15 transition-colors font-bold text-white text-xs"
          >
            <span>{formatM}</span>
          </div>
        )}

        <div className="flex flex-col ml-0.5 opacity-60 hover:opacity-100 transition-opacity">
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              stepMinute(1);
            }}
            className="hover:text-white text-zinc-400 p-0 leading-none cursor-pointer"
          >
            <ChevronUp className="w-2.5 h-2.5" />
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              stepMinute(-1);
            }}
            className="hover:text-white text-zinc-400 p-0 leading-none cursor-pointer -mt-0.5"
          >
            <ChevronDown className="w-2.5 h-2.5" />
          </button>
        </div>
      </div>

      <Clock className="w-3 h-3 text-zinc-400 ml-0.5 shrink-0 select-none" />
    </div>
  );
};
