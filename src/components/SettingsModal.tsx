import React from 'react';
import { X, Settings, Keyboard, Sliders, Shield } from 'lucide-react';
import { soundFx } from '../utils/audio';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'ru' | 'en';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  language,
}) => {
  if (!isOpen) return null;

  const isRu = language === 'ru';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
      <div
        className="w-full max-w-lg rounded-xl p-6 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.85)] max-h-[85vh] overflow-y-auto"
        style={{
          background: 'rgba(22, 24, 28, 0.95)',
        }}
      >
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-[#e5c158]" />
            <h2 className="text-base font-bold text-white tracking-wide">
              {isRu ? 'Настройки бота и HUD' : 'Bot & HUD Settings'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="text-zinc-400 hover:text-white cursor-pointer p-1 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          {/* Section 1: Hotkeys */}
          <div>
            <h3 className="text-xs font-bold text-[#e5c158] uppercase font-mono tracking-wider mb-2 flex items-center gap-1.5">
              <Keyboard className="w-4 h-4" />
              <span>{isRu ? 'Горячие клавиши управления' : 'Control Hotkeys'}</span>
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center p-2.5 rounded bg-white/[0.03] border border-white/10">
                <span className="text-zinc-300">{isRu ? 'Старт / Стоп бота:' : 'Start / Stop Bot:'}</span>
                <span className="px-2 py-0.5 rounded bg-black/50 border border-white/20 text-[#e5c158] font-mono font-bold">F5</span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded bg-white/[0.03] border border-white/10">
                <span className="text-zinc-300">{isRu ? 'Захват предыдущей цели:' : 'Previous Target Key:'}</span>
                <span className="px-2 py-0.5 rounded bg-black/50 border border-white/20 text-white font-mono font-bold">H</span>
              </div>
              <div className="flex justify-between items-center p-2.5 rounded bg-white/[0.03] border border-white/10">
                <span className="text-zinc-300">{isRu ? 'Зум радара (+ / -):' : 'Radar Zoom (In/Out):'}</span>
                <span className="px-2 py-0.5 rounded bg-black/50 border border-white/20 text-white font-mono font-bold">PAGEUP / PAGEDN</span>
              </div>
            </div>
          </div>

          {/* Section 2: Safety & Anti-Stuck */}
          <div>
            <h3 className="text-xs font-bold text-[#e5c158] uppercase font-mono tracking-wider mb-2 flex items-center gap-1.5">
              <Shield className="w-4 h-4" />
              <span>{isRu ? 'Безопасность и обход препятствий' : 'Safety & Obstacle Avoidance'}</span>
            </h3>
            <div className="space-y-2 text-xs text-zinc-300">
              <label className="flex items-center justify-between p-2.5 rounded bg-white/[0.03] border border-white/10 cursor-pointer">
                <span>{isRu ? '3D Mesh Navmesh обход деревьев и построек' : '3D Navmesh avoidance for trees/houses'}</span>
                <input type="checkbox" defaultChecked className="accent-amber-500" />
              </label>
              <label className="flex items-center justify-between p-2.5 rounded bg-white/[0.03] border border-white/10 cursor-pointer">
                <span>{isRu ? 'Автоматический прыжок при застревании (>2 сек)' : 'Auto-jump when stuck (>2 sec)'}</span>
                <input type="checkbox" defaultChecked className="accent-amber-500" />
              </label>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-white/10 flex justify-end">
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="px-5 py-2 rounded-lg text-xs font-bold text-black bg-[#e5c158] hover:bg-[#f5d17f] cursor-pointer"
          >
            {isRu ? 'Сохранить' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
