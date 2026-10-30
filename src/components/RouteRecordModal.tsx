import React, { useState, useEffect } from 'react';
import { X, Route } from 'lucide-react';
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
  defaultName,
  onStartRecord,
  onRouteSaved,
  language = 'ru',
}) => {
  const isRu = language === 'ru';
  const effectiveDefaultName = defaultName || (isRu ? 'Маршрут 2' : 'Route 2');
  const [routeName, setRouteName] = useState(effectiveDefaultName);

  useEffect(() => {
    if (isOpen) {
      setRouteName(effectiveDefaultName);
    }
  }, [isOpen, effectiveDefaultName]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundFx.playClick();
    const finalName = routeName.trim() || effectiveDefaultName;
    if (onStartRecord) {
      onStartRecord(finalName, true);
    }
    if (onRouteSaved) {
      onRouteSaved(
        { id: `route_${Date.now()}`, name: finalName, loop: true, points: 44, length_s: 132 },
        null
      );
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 dark:bg-black/75 backdrop-blur-md animate-fadeIn select-none">
      <div className="w-full max-w-md rounded-2xl p-5 border border-black/10 dark:border-white/[0.08] shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.9)] bg-white dark:bg-[#121214] transition-colors">
        <div className="flex items-center justify-between pb-3.5 border-b border-black/10 dark:border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-zinc-950 dark:text-white" strokeWidth={1.5} />
            <h2 className="text-sm font-semibold text-zinc-950 dark:text-white tracking-wide">
              {isRu ? 'Запись нового маршрута' : 'Record new route'}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white cursor-pointer p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-mono text-zinc-600 dark:text-zinc-400 mb-1.5">
              {isRu ? 'Название маршрута' : 'Route name'}
            </label>
            <input
              type="text"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-zinc-50 dark:bg-[#18181b] border border-black/15 dark:border-white/[0.08] text-zinc-950 dark:text-white text-xs font-mono focus:outline-none focus:border-zinc-950 dark:focus:border-white transition-colors"
              placeholder={isRu ? 'Например: Награнд Руда' : 'e.g. Nagrand Ore'}
              autoFocus
            />
          </div>

          <div className="pt-2 flex justify-end gap-2.5">
            <SpecularButton
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg text-xs font-mono text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-black/10 dark:border-white/[0.08] bg-zinc-100 dark:bg-[#18181b] hover:bg-zinc-200 dark:hover:bg-white/[0.08] cursor-pointer"
            >
              {isRu ? 'Отмена' : 'Cancel'}
            </SpecularButton>
            <SpecularButton
              type="submit"
              className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white dark:text-zinc-950 bg-zinc-950 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 shadow-sm cursor-pointer active:scale-95 transition-all"
            >
              {isRu ? 'Создать маршрут' : 'Create route'}
            </SpecularButton>
          </div>
        </form>
      </div>
    </div>
  );
};
