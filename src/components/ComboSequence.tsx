import React, { useState, useEffect } from 'react';
import { ComboChain, ChainStep } from '../data/skillsLibrary';
import { Plus, Clock, RotateCcw, Pencil, X, Check, Zap, Heart } from 'lucide-react';
import { Language, Theme } from '../utils/i18n';

interface Props {
  chains: ComboChain[];
  onChainsChange: (chains: ComboChain[]) => void;
  activeCasting?: { chainId: string; stepId: string } | null;
  isBotRunning?: boolean;
  onToast?: (message: string) => void;
  onError?: (message: string) => void;
  language?: Language;
  theme?: Theme;
}

const MAX_CAST_SECONDS = 999;

// Extract clean physical game key name from KeyboardEvent
const getPhysicalKeyFromEvent = (e: React.KeyboardEvent): string | null => {
  if (e.key === 'Escape') return null;
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null;
  if (e.key === 'Backspace' || e.key === 'Delete') return '';

  if (e.key === 'Tab') return 'TAB';
  if (/^F([1-9]|1[0-2])$/i.test(e.key)) {
    return e.key.toUpperCase();
  }

  let keyStr = e.key.toUpperCase();
  if (e.code.startsWith('Key')) {
    keyStr = e.code.replace('Key', '');
  } else if (e.code.startsWith('Digit')) {
    keyStr = e.code.replace('Digit', '');
  } else if (e.code.startsWith('Numpad')) {
    keyStr = 'NUM' + e.code.replace('Numpad', '');
  } else if (e.key === ' ' || e.code === 'Space') {
    keyStr = 'SPACE';
  } else if (e.key === 'ArrowUp') keyStr = 'UP';
  else if (e.key === 'ArrowDown') keyStr = 'DOWN';
  else if (e.key === 'ArrowLeft') keyStr = 'LEFT';
  else if (e.key === 'ArrowRight') keyStr = 'RIGHT';

  return keyStr.slice(0, 5);
};

export const ComboSequence: React.FC<Props> = ({
  chains,
  onChainsChange,
  activeCasting = null,
  language = 'ru',
}) => {
  const isRu = language === 'ru';

  // Primary active chain
  const currentChain = chains[0] || {
    id: 'chain_1',
    name: 'Боевая ротация',
    order: 1,
    cooldown: 0,
    triggerAfterChainId: 'always',
    steps: [],
  };

  // Active step being configured in bottom docked editor (Open by default on slot 1)
  const [editingStep, setEditingStep] = useState<{ chainId: string; stepId: string } | null>(() => {
    if (currentChain && currentChain.steps.length > 0) {
      return { chainId: currentChain.id, stepId: currentChain.steps[0].id };
    }
    return null;
  });

  // Active key listening on slot tile
  const [activeCapturingStepId, setActiveCapturingStepId] = useState<string | null>(null);

  // Active key listening in bottom editor panel
  const [isPanelKeyCapturing, setIsPanelKeyCapturing] = useState<boolean>(false);

  // Draft step state for bottom panel editing
  const [draftStep, setDraftStep] = useState<{
    key: string;
    castTimeSeconds: number;
    repeatCount: number;
    independent: boolean;
    skillCooldownSeconds: number;
    hpBelowPercent: number | null;
  }>({
    key: '',
    castTimeSeconds: 1.5,
    repeatCount: 1,
    independent: false,
    skillCooldownSeconds: 0,
    hpBelowPercent: null,
  });

  const [castInputStr, setCastInputStr] = useState<string>('1.5');
  const [cdInputStr, setCdInputStr] = useState<string>('0');
  const [hpInputStr, setHpInputStr] = useState<string>('');

  // Keep a step selected by default whenever steps exist
  useEffect(() => {
    if (!editingStep && currentChain.steps.length > 0) {
      setEditingStep({ chainId: currentChain.id, stepId: currentChain.steps[0].id });
    }
  }, [currentChain.steps, editingStep, currentChain.id]);

  // Sync draft step when editingStep changes
  useEffect(() => {
    if (!editingStep) return;
    const chain = chains.find((c) => c.id === editingStep.chainId);
    const step = chain?.steps.find((s) => s.id === editingStep.stepId);
    if (step) {
      setDraftStep({
        key: step.key || '',
        castTimeSeconds: step.castTimeSeconds ?? 1.5,
        repeatCount: step.repeatCount ?? 1,
        independent: Boolean(step.independent),
        skillCooldownSeconds: step.skillCooldownSeconds ?? 0,
        hpBelowPercent: step.hpBelowPercent ?? null,
      });
      setCastInputStr(String(step.castTimeSeconds ?? 1.5));
      setCdInputStr(String(step.skillCooldownSeconds ?? 0));
      setHpInputStr(step.hpBelowPercent != null ? String(step.hpBelowPercent) : '');
      setIsPanelKeyCapturing(false);
    }
  }, [editingStep, chains]);

  // Add step to chain
  const handleAddStepToChain = (chainId: string) => {
    const updated = chains.map((c) => {
      if (c.id === chainId) {
        const nextIdx = c.steps.length + 1;
        const newStep: ChainStep = {
          id: `step_${Date.now()}_${nextIdx}`,
          key: '',
          castTimeSeconds: 1.5,
          skillCooldownSeconds: 0,
          repeatCount: 1,
          independent: false,
          actionType: 'press',
        };
        return { ...c, steps: [...c.steps, newStep] };
      }
      return c;
    });
    onChainsChange(updated);
    // Auto-focus the newly added step for editing
    const lastStep = updated.find((c) => c.id === chainId)?.steps.slice(-1)[0];
    if (lastStep) {
      setEditingStep({ chainId, stepId: lastStep.id });
    }
  };

  // Delete step
  const handleDeleteStep = (chainId: string, stepId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = chains.map((c) => {
      if (c.id === chainId) {
        return { ...c, steps: c.steps.filter((s) => s.id !== stepId) };
      }
      return c;
    });
    onChainsChange(updated);
    if (editingStep?.stepId === stepId) {
      setEditingStep(null);
    }
  };

  // Quick key update from slot keypress
  const handleUpdateStepKey = (chainId: string, stepId: string, newKey: string) => {
    const updated = chains.map((c) => {
      if (c.id !== chainId) return c;
      return {
        ...c,
        steps: c.steps.map((s) => {
          if (s.id !== stepId) return s;
          return { ...s, key: newKey.toUpperCase(), actionType: 'press' as const };
        }),
      };
    });
    onChainsChange(updated);
  };

  // Clear all steps
  const handleClearAllChainSteps = (chainId: string) => {
    const updated = chains.map((c) => {
      if (c.id === chainId) {
        return {
          ...c,
          steps: [
            {
              id: `step_${Date.now()}_1`,
              key: '1',
              castTimeSeconds: 1.5,
              skillCooldownSeconds: 0,
              repeatCount: 1,
              independent: false,
              actionType: 'press' as const,
            },
          ],
        };
      }
      return c;
    });
    onChainsChange(updated);
    setEditingStep(null);
  };

  // Save changes from bottom panel
  const handleSaveStep = () => {
    if (!editingStep) return;
    const parsedHp = hpInputStr.trim() === '' ? null : parseInt(hpInputStr, 10);
    const validHp = parsedHp != null && !isNaN(parsedHp) ? Math.min(100, Math.max(1, parsedHp)) : null;

    const updated = chains.map((c) => {
      if (c.id !== editingStep.chainId) return c;
      return {
        ...c,
        steps: c.steps.map((s) => {
          if (s.id !== editingStep.stepId) return s;
          return {
            ...s,
            key: draftStep.key.toUpperCase(),
            castTimeSeconds: draftStep.castTimeSeconds,
            repeatCount: draftStep.repeatCount,
            independent: draftStep.independent,
            skillCooldownSeconds: draftStep.skillCooldownSeconds,
            hpBelowPercent: validHp,
            actionType: 'press' as const,
          };
        }),
      };
    });
    onChainsChange(updated);
    // Keep panel open on current step so editing is always accessible
  };

  const editingStepData = editingStep
    ? currentChain.steps.find((s) => s.id === editingStep.stepId)
    : null;
  const editingStepIdx = editingStepData
    ? currentChain.steps.findIndex((s) => s.id === editingStepData.id)
    : -1;

  return (
    <div className="flex flex-col gap-4 w-full select-none text-zinc-100 font-sans">
      {/* 1. TOP BAR: Header & Clear Action */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full bg-[#e5c158] shadow-[0_0_8px_rgba(229,193,88,0.7)]" />
          <span className="text-xs font-mono font-bold tracking-wider uppercase text-white">
            {isRu ? 'ПОСЛЕДОВАТЕЛЬНОСТЬ ЗАКЛИНАНИЙ' : 'SPELL ROTATION SEQUENCE'}
          </span>
          <span className="text-[10px] font-mono text-zinc-500">
            ({currentChain.steps.length} {isRu ? 'слотов' : 'slots'})
          </span>
        </div>

        <button
          type="button"
          onClick={() => handleClearAllChainSteps(currentChain.id)}
          title={isRu ? 'Сбросить ротацию' : 'Reset rotation'}
          className="p-1.5 rounded-lg border border-transparent hover:border-white/[0.08] bg-transparent text-zinc-500 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-mono"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{isRu ? 'Сбросить' : 'Reset'}</span>
        </button>
      </div>

      {/* 2. SPELL SLOTS ROW (Ghost Action Bar) */}
      <div className="p-3 rounded-xl bg-transparent border border-transparent hover:border-white/[0.08] flex flex-wrap items-center gap-2.5 min-h-[64px] transition-all duration-200">
        {currentChain.steps.map((step, idx) => {
          const isCasting = activeCasting?.chainId === currentChain.id && activeCasting?.stepId === step.id;
          const isIndependent = Boolean(step.independent);
          const isCurrentlyEditing = editingStep?.stepId === step.id;

          return (
            <div
              key={step.id}
              onClick={() => setEditingStep({ chainId: currentChain.id, stepId: step.id })}
              className={`w-[44px] h-[44px] rounded-lg p-1 relative flex flex-col items-center justify-center cursor-pointer transition-all duration-150 group select-none ${
                isCasting
                  ? 'border border-white text-white scale-105 z-20'
                  : isCurrentlyEditing
                  ? 'border border-white text-white z-20'
                  : 'border border-transparent hover:border-white/[0.08] bg-transparent'
              }`}
            >
              {/* Slot Index */}
              <span className="absolute top-1 left-1.5 text-[8px] font-mono font-medium text-zinc-600 pointer-events-none">
                {idx + 1}
              </span>

              {/* Remove Step '✕' on hover */}
              {currentChain.steps.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => handleDeleteStep(currentChain.id, step.id, e)}
                  title={isRu ? 'Удалить умение' : 'Delete spell'}
                  className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-zinc-900 border border-white/30 text-zinc-300 text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white hover:text-black cursor-pointer z-30"
                >
                  ✕
                </button>
              )}

              {/* Keycap Label */}
              <button
                type="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveCapturingStepId(step.id);
                }}
                onBlur={() => {
                  if (activeCapturingStepId === step.id) {
                    setActiveCapturingStepId(null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setActiveCapturingStepId(null);
                    e.currentTarget.blur();
                    return;
                  }
                  const captured = getPhysicalKeyFromEvent(e);
                  if (captured !== null) {
                    e.preventDefault();
                    e.stopPropagation();
                    handleUpdateStepKey(currentChain.id, step.id, captured);
                    setActiveCapturingStepId(null);
                    e.currentTarget.blur();
                  }
                }}
                className={`w-full text-center font-mono font-semibold text-xs tracking-wide transition-colors outline-none cursor-pointer ${
                  activeCapturingStepId === step.id
                    ? 'text-white animate-pulse'
                    : step.key
                    ? 'text-white'
                    : 'text-zinc-600'
                }`}
              >
                {activeCapturingStepId === step.id ? (
                  <span className="text-[9px] text-white font-mono">ЖМИ</span>
                ) : (
                  step.key || '—'
                )}
              </button>

              {/* Edit Icon Indicator in Corner */}
              <div
                className={`absolute bottom-1 left-1.5 text-[8px] transition-colors ${
                  isCurrentlyEditing ? 'text-white' : 'text-zinc-600 group-hover:text-zinc-400'
                }`}
              >
                <Pencil className="w-2 h-2" />
              </div>

              {/* HP Condition Indicator */}
              {step.hpBelowPercent != null && (
                <span className="absolute top-1 right-1 text-[7px] font-mono font-medium text-zinc-300 bg-white/10 border border-white/20 rounded px-0.5">
                  &lt;{step.hpBelowPercent}%
                </span>
              )}

              {/* Repeat Indicator */}
              {step.repeatCount && step.repeatCount > 1 && (
                <span className="absolute bottom-1 right-1 text-[7px] font-mono font-medium text-zinc-300 bg-white/10 rounded px-0.5">
                  {step.repeatCount}×
                </span>
              )}
            </div>
          );
        })}

        {/* Append Slot '+' Button */}
        <button
          type="button"
          onClick={() => handleAddStepToChain(currentChain.id)}
          title={isRu ? 'Добавить слот в ротацию' : 'Add slot to rotation'}
          className="w-[44px] h-[44px] rounded-lg border border-dashed border-white/20 hover:border-white hover:bg-white/5 text-zinc-500 hover:text-white transition-all flex items-center justify-center cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[1.5]" />
        </button>
      </div>

      {/* 3. DOCKED BOTTOM EDITING PANEL (Ghost Mode) */}
      <div className="w-full rounded-2xl border border-transparent hover:border-white/[0.08] bg-transparent p-4 shadow-none transition-all duration-200">
        {editingStep && editingStepData ? (
          <div className="flex flex-col gap-3.5">
            {/* Panel Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-transparent">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium tracking-wide text-white flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-white font-mono font-bold">
                    #{editingStepIdx + 1}
                  </span>
                  <span>{isRu ? 'Редактирование умения' : 'Edit spell slot'}</span>
                </span>
                <span className="text-xs font-mono text-zinc-500">
                  {draftStep.key ? `[${draftStep.key}]` : isRu ? '(клавиша не привязана)' : '(no key)'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingStep(null)}
                  className="p-1 rounded-lg text-zinc-500 hover:text-white transition-colors cursor-pointer"
                  title={isRu ? 'Закрыть панель' : 'Close panel'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Grid of 4 Monochrome Settings Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* CARD 1: Keybind Capture */}
              <div className="p-3 rounded-xl border border-transparent hover:border-white/[0.08] bg-transparent flex flex-col justify-between gap-2.5 transition-all">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono font-semibold text-zinc-300">
                    1. {isRu ? 'Клавиша' : 'Keybind'}
                  </label>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {draftStep.key ? `[${draftStep.key}]` : '—'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    tabIndex={0}
                    onClick={() => setIsPanelKeyCapturing(true)}
                    onBlur={() => setIsPanelKeyCapturing(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setIsPanelKeyCapturing(false);
                        e.currentTarget.blur();
                        return;
                      }
                      const captured = getPhysicalKeyFromEvent(e);
                      if (captured !== null) {
                        e.preventDefault();
                        e.stopPropagation();
                        setDraftStep((prev) => ({ ...prev, key: captured }));
                        setIsPanelKeyCapturing(false);
                        e.currentTarget.blur();
                      }
                    }}
                    className={`flex-1 h-9 px-3 rounded-lg font-mono font-bold text-sm uppercase flex items-center justify-center border transition-all cursor-pointer outline-none select-none ${
                      isPanelKeyCapturing
                        ? 'bg-red-950/80 border-[#e5c158] text-[#fef08a] ring-2 ring-[#e5c158] animate-pulse'
                        : draftStep.key
                        ? 'bg-[#222730] border-white/20 text-white hover:border-[#e5c158]'
                        : 'bg-white/5 border-dashed border-white/20 text-zinc-400 hover:border-white/40'
                    }`}
                  >
                    {isPanelKeyCapturing ? (
                      <span className="text-xs text-[#e5c158] animate-pulse font-mono font-bold">
                        ⚡ {isRu ? 'НАЖМИТЕ КЛАВИШУ' : 'PRESS KEY'}
                      </span>
                    ) : draftStep.key ? (
                      <span className="tracking-widest">[{draftStep.key}]</span>
                    ) : (
                      <span className="text-xs font-normal">
                        {isRu ? '+ Назначить клавишу' : '+ Assign Key'}
                      </span>
                    )}
                  </button>

                  {draftStep.key && (
                    <button
                      type="button"
                      onClick={() => setDraftStep((prev) => ({ ...prev, key: '' }))}
                      className="w-9 h-9 rounded-lg border border-white/10 bg-white/5 hover:bg-red-950/50 hover:border-red-500/50 text-zinc-400 hover:text-red-300 text-xs flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      title={isRu ? 'Очистить клавишу' : 'Clear key'}
                    >
                      ✕
                    </button>
                  )}
                </div>

                <span className="text-[10px] text-zinc-500 font-mono">
                  {isPanelKeyCapturing
                    ? isRu
                      ? 'Ожидание нажатия на клавиатуре...'
                      : 'Waiting for keypress...'
                    : isRu
                    ? 'Кликните и нажмите нужную кнопку'
                    : 'Click and press desired key'}
                </span>
              </div>

              {/* CARD 2: Trigger Condition & HP */}
              <div className="p-3 rounded-xl border border-transparent hover:border-white/[0.08] bg-transparent flex flex-col justify-between gap-2.5 transition-all">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono font-semibold text-zinc-300">
                    2. {isRu ? 'Условие' : 'Condition'}
                  </label>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {draftStep.independent
                      ? isRu
                        ? 'По готовности'
                        : 'ASAP'
                      : isRu
                      ? 'По очереди'
                      : 'Sequential'}
                  </span>
                </div>

                {/* Mode toggle */}
                <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-transparent border border-transparent hover:border-white/[0.08]">
                  <button
                    type="button"
                    onClick={() => setDraftStep((prev) => ({ ...prev, independent: false }))}
                    className={`py-1.5 px-2 rounded-md text-[10px] font-mono font-medium transition cursor-pointer flex items-center justify-center gap-1 ${
                      !draftStep.independent
                        ? 'text-white font-semibold underline underline-offset-4'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <span>{isRu ? 'По очереди' : 'Sequential'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftStep((prev) => ({ ...prev, independent: true }))}
                    className={`py-1.5 px-2 rounded-md text-[10px] font-mono font-medium transition cursor-pointer flex items-center justify-center gap-1 ${
                      draftStep.independent
                        ? 'text-white font-semibold underline underline-offset-4'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    <Zap className="w-3 h-3 text-zinc-400" />
                    <span>{isRu ? 'По готовности' : 'ASAP'}</span>
                  </button>
                </div>

                {/* HP Below Condition */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-transparent">
                  <span className="text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                    <Heart className="w-3 h-3 text-zinc-500" />
                    <span>{isRu ? 'HP ниже:' : 'HP below:'}</span>
                  </span>
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-transparent border border-transparent hover:border-white/[0.1] focus-within:border-white">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={hpInputStr}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, '').slice(0, 3);
                        setHpInputStr(raw);
                        const val = parseInt(raw, 10);
                        setDraftStep((prev) => ({
                          ...prev,
                          hpBelowPercent: !isNaN(val) ? Math.min(100, Math.max(1, val)) : null,
                        }));
                      }}
                      className="w-8 bg-transparent text-center font-mono font-bold text-xs text-white outline-none"
                      placeholder="—"
                    />
                    <span className="text-[10px] font-mono text-zinc-500">%</span>
                  </div>
                </div>
              </div>

              {/* CARD 3: Cast Time & Repeats */}
              <div className="p-3 rounded-xl border border-transparent hover:border-white/[0.08] bg-transparent flex flex-col justify-between gap-2.5 transition-all">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono font-semibold text-zinc-300">
                    3. {isRu ? 'Время каста' : 'Cast Time'}
                  </label>
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-transparent border border-transparent hover:border-white/[0.1] focus-within:border-white">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={castInputStr}
                      onChange={(e) => {
                        let raw = e.target.value.replace(/[^0-9.,]/g, '');
                        setCastInputStr(raw);
                        const parsed = parseFloat(raw.replace(',', '.'));
                        if (!isNaN(parsed)) {
                          setDraftStep((prev) => ({
                            ...prev,
                            castTimeSeconds: Math.min(MAX_CAST_SECONDS, Math.max(0, parsed)),
                          }));
                        }
                      }}
                      className="w-10 bg-transparent text-center font-mono font-bold text-xs text-white outline-none"
                    />
                    <span className="text-[10px] font-mono text-zinc-500">c</span>
                  </div>
                </div>

                {/* Cast presets */}
                <div className="grid grid-cols-6 gap-1">
                  {[0, 1, 1.5, 2, 2.5, 3].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setDraftStep((prev) => ({ ...prev, castTimeSeconds: s }));
                        setCastInputStr(String(s));
                      }}
                      className={`h-6 rounded text-[10px] font-mono transition cursor-pointer border flex items-center justify-center ${
                        draftStep.castTimeSeconds === s
                          ? 'text-white font-bold underline underline-offset-2 border-transparent'
                          : 'border-transparent text-zinc-500 hover:text-white'
                      }`}
                    >
                      {s}s
                    </button>
                  ))}
                </div>

                {/* Repeats row */}
                <div className="flex items-center justify-between pt-1 border-t border-transparent">
                  <span className="text-[10px] font-mono text-zinc-500">
                    {isRu ? 'Повторов:' : 'Repeats:'}
                  </span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4].map((cnt) => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setDraftStep((prev) => ({ ...prev, repeatCount: cnt }))}
                        className={`w-6 h-5 rounded text-[10px] font-mono transition cursor-pointer border flex items-center justify-center ${
                          (draftStep.repeatCount || 1) === cnt
                            ? 'text-white font-bold underline underline-offset-2 border-transparent'
                            : 'border-transparent text-zinc-500 hover:text-white'
                        }`}
                      >
                        {cnt}×
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* CARD 4: Cooldown (CD) */}
              <div className="p-3 rounded-xl border border-transparent hover:border-white/[0.08] bg-transparent flex flex-col justify-between gap-2.5 transition-all">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono font-semibold text-zinc-300 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-zinc-400" />
                    <span>4. {isRu ? 'Кулдаун (КД)' : 'Cooldown'}</span>
                  </label>
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-black/40 border border-white/10 focus-within:border-white">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={cdInputStr}
                      onChange={(e) => {
                        let raw = e.target.value.replace(/[^0-9.,]/g, '');
                        setCdInputStr(raw);
                        const parsed = parseFloat(raw.replace(',', '.'));
                        if (!isNaN(parsed)) {
                          setDraftStep((prev) => ({
                            ...prev,
                            skillCooldownSeconds: Math.min(300, Math.max(0, parsed)),
                          }));
                        }
                      }}
                      className="w-10 bg-transparent text-center font-mono font-bold text-xs text-white outline-none"
                    />
                    <span className="text-[10px] font-mono text-zinc-400">c</span>
                  </div>
                </div>

                {/* Cooldown presets */}
                <div className="grid grid-cols-4 gap-1">
                  {[0, 6, 12, 24].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => {
                        setDraftStep((prev) => ({ ...prev, skillCooldownSeconds: sec }));
                        setCdInputStr(String(sec));
                      }}
                      className={`h-6 rounded text-[10px] font-mono transition cursor-pointer border flex items-center justify-center ${
                        draftStep.skillCooldownSeconds === sec
                          ? 'bg-white text-zinc-950 font-semibold border-white shadow-sm'
                          : 'bg-[#18181b] border-white/10 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>

                <span className="text-[10px] text-zinc-500 font-mono">
                  {isRu ? 'Пауза перед повторным кастом' : 'Cooldown before recast'}
                </span>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-[11px] font-mono text-zinc-500">
                {isRu ? 'Изменения применяются сразу к ротации' : 'Changes apply immediately to rotation'}
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingStep(null)}
                  className="px-3 py-1.5 rounded-lg border border-white/10 bg-[#18181b] hover:bg-[#202024] text-zinc-300 hover:text-white text-xs font-mono font-medium transition cursor-pointer"
                >
                  {isRu ? 'Отмена' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveStep}
                  className="px-4 py-1.5 rounded-lg bg-white hover:bg-zinc-100 text-zinc-950 text-xs font-mono font-semibold transition cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isRu ? 'Сохранить слот' : 'Save Slot'}</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Empty / Idle State when no slot is active */
          <div className="py-6 flex flex-col items-center justify-center gap-2 text-center text-zinc-500 font-mono">
            <div className="w-8 h-8 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-zinc-400">
              <Pencil className="w-4 h-4" />
            </div>
            <p className="text-xs text-zinc-400 font-medium">
              {isRu
                ? 'Кликните по любому слоту умения выше, чтобы настроить клавишу, тайминги и условия'
                : 'Click any spell slot above to configure keybind, timings, and trigger conditions'}
            </p>
            {currentChain.steps.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setEditingStep({
                    chainId: currentChain.id,
                    stepId: currentChain.steps[0].id,
                  })
                }
                className="mt-1 px-3 py-1 text-[11px] font-mono rounded border border-white/10 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white cursor-pointer transition-colors"
              >
                {isRu ? 'Настроить слот #1' : 'Configure slot #1'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
