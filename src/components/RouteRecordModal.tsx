import React, { useState, useEffect } from 'react';
import { X, Route, Check } from 'lucide-react';
import { soundFx } from '../utils/audio';
import { SpecularButton } from './ui/Specular';

interface RouteRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultName?: string;
  onStartRecord?: (name: string, isLoop: boolean) => void;
  onRouteSaved?: (newRoute: any, terrain: any) => void;
  onToast?: (toast: any) => void;
  language?: 'ru' | 'en' | any;
  theme?: 'dark' | 'light' | any;
}

export const RouteRecordModal: React.FC<RouteRecordModalProps> = ({
  isOpen,
  onClose,
  defaultName = 'Маршрут 2',
  onStartRecord,
  onRouteSaved,
  language = 'ru',
}) => {
  const [routeName, setRouteName] = useState(defaultName);
  const [isLoop, setIsLoop] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setRouteName(defaultName);
    }
  }, [isOpen, defaultName]);

  if (!isOpen) return null;

  const isRu = language === 'ru';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundFx.playClick();
    const finalName = routeName.trim() || defaultName;
    if (onStartRecord) {
      onStartRecord(finalName, isLoop);
    }
    if (onRouteSaved) {
      onRouteSaved(
        { id: `route_${Date.now()}`, name: finalName, loop: isLoop, points: 44, length_s: 132 },
        null
      );
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn select-none">
      <div
        className="w-full max-w-md rounded-xl p-5 border border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.9)] bg-[#121214]"
      >
        <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-white" strokeWidth={1.5} />
            <h2 className="text-sm font-semibold text-white tracking-wide">
              {isRu ? 'Запись нового маршрута' : 'Record new route'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="text-zinc-400 hover:text-white cursor-pointer p-1 rounded-md hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-mono text-zinc-400 mb-1.5">
              {isRu ? 'Название маршрута' : 'Route name'}
            </label>
            <input
              type="text"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#18181b] border border-white/[0.08] text-white text-xs font-mono focus:outline-none focus:border-white transition-colors"
              placeholder={isRu ? 'Например: Награнд Руда' : 'e.g. Nagrand Ore'}
              autoFocus
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-[#18181b] border border-white/[0.08]">
            <div>
              <span className="block text-xs font-medium text-white">
                {isRu ? 'Замкнутый контур (Круг)' : 'Closed loop (Circle)'}
              </span>
              <span className="block text-[11px] text-zinc-400">
                {isRu
                  ? 'Бот циклически повторяет маршрут без остановок'
                  : 'Bot repeats the loop continuously'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                soundFx.playClick();
                setIsLoop(!isLoop);
              }}
              className={`w-5 h-5 rounded-md flex items-center justify-center cursor-pointer border transition-colors ${
                isLoop
                  ? 'bg-white border-white text-zinc-950 font-bold'
                  : 'bg-black/40 border-white/20 text-transparent'
              }`}
            >
              <Check className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>

          <div className="pt-2 flex justify-end gap-2.5">
            <SpecularButton
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-mono text-zinc-400 hover:text-white border border-white/[0.08] bg-[#18181b] hover:bg-white/[0.08] cursor-pointer"
            >
              {isRu ? 'Отмена' : 'Cancel'}
            </SpecularButton>
            <SpecularButton
              onClick={() => {}}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-zinc-950 bg-white hover:bg-zinc-200 shadow-sm cursor-pointer active:scale-95 transition-all"
            >
              {isRu ? 'Создать маршрут' : 'Create route'}
            </SpecularButton>
          </div>
        </form>
      </div>
    </div>
  );
};
