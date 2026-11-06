import React, { useState, useEffect, useRef } from 'react';
import { ComboChain, ChainStep } from '../data/skillsLibrary';
import { Plus, Clock, RotateCcw, X, Check, Zap, Heart, Droplet, ArrowLeft, ArrowRight } from 'lucide-react';
import { Language, Theme } from '../utils/i18n';
import { soundFx } from '../utils/audio';

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

  // Active key listening on '+' morph button
  const [isAddingNewStep, setIsAddingNewStep] = useState<'regular' | 'water' | null>(null);
  const addingBtnRef = useRef<HTMLButtonElement | null>(null);

  // Active key listening in bottom editor panel
  const [isPanelKeyCapturing, setIsPanelKeyCapturing] = useState<boolean>(false);

  // Drag and drop reordering state
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const currentStepIdRef = useRef<string | null>(null);

  // Draft step state for bottom panel editing
  const [draftStep, setDraftStep] = useState<{
    key: string;
    castTimeSeconds: number;
    repeatCount: number;
    independent: boolean;
    skillCooldownSeconds: number;
    hpBelowPercent: number | null;
    mpBelowPercent: number | null;
    stepType?: 'skill' | 'water';
  }>({
    key: '',
    castTimeSeconds: 1.5,
    repeatCount: 1,
    independent: false,
    skillCooldownSeconds: 0,
    hpBelowPercent: null,
    mpBelowPercent: null,
    stepType: 'skill',
  });

  const [castInputStr, setCastInputStr] = useState<string>('1.5');
  const [cdInputStr, setCdInputStr] = useState<string>('0');
  const [hpInputStr, setHpInputStr] = useState<string>('');
  const [mpInputStr, setMpInputStr] = useState<string>('');

  // Keep a step selected by default whenever steps exist, unless capturing a new key
  useEffect(() => {
    if (!editingStep && !activeCapturingStepId && !isAddingNewStep && currentChain.steps.length > 0) {
      setEditingStep({ chainId: currentChain.id, stepId: currentChain.steps[0].id });
    }
  }, [currentChain.steps, editingStep, currentChain.id, activeCapturingStepId, isAddingNewStep]);

  // Auto-focus slot key button when capturing key
  useEffect(() => {
    if (activeCapturingStepId) {
      const el = document.getElementById(`slot-key-btn-${activeCapturingStepId}`);
      if (el) {
        el.focus();
      }
    }
  }, [activeCapturingStepId]);

  // Auto-focus morphing '+' button when user clicks add step
  useEffect(() => {
    if (isAddingNewStep && addingBtnRef.current) {
      addingBtnRef.current.focus();
    }
  }, [isAddingNewStep]);

  // Sync draft step when editingStep changes
  useEffect(() => {
    if (!editingStep) {
      currentStepIdRef.current = null;
      return;
    }
    const chain = chains.find((c) => c.id === editingStep.chainId);
    const step = chain?.steps.find((s) => s.id === editingStep.stepId);
    if (step) {
      if (currentStepIdRef.current !== step.id) {
        currentStepIdRef.current = step.id;
        setCastInputStr(String(step.castTimeSeconds ?? 1.5));
        setCdInputStr(String(step.skillCooldownSeconds ?? 0));
        setHpInputStr(step.hpBelowPercent != null ? String(step.hpBelowPercent) : '');
        setMpInputStr(step.mpBelowPercent != null ? String(step.mpBelowPercent) : '');
        setIsPanelKeyCapturing(false);
      }
      setDraftStep({
        key: step.key || '',
        castTimeSeconds: step.castTimeSeconds ?? 1.5,
        repeatCount: step.repeatCount ?? 1,
        independent: Boolean(step.independent),
        skillCooldownSeconds: step.skillCooldownSeconds ?? 0,
        hpBelowPercent: step.hpBelowPercent ?? null,
        mpBelowPercent: step.mpBelowPercent ?? null,
        stepType: step.stepType || 'skill',
      });
    }
  }, [editingStep, chains]);

  // Reorder steps forward or backward (Drag & Drop or buttons)
  const handleReorderSteps = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= currentChain.steps.length || toIndex >= currentChain.steps.length) return;
    soundFx.playClick();
    const updated = chains.map((c) => {
      if (c.id !== currentChain.id) return c;
      const newSteps = [...c.steps];
      const [moved] = newSteps.splice(fromIndex, 1);
      newSteps.splice(toIndex, 0, moved);
      return { ...c, steps: newSteps };
    });
    onChainsChange(updated);
  };

  // Immediate auto-save of any changed property to chains
  const handleUpdateCurrentStep = (patch: Partial<ChainStep>) => {
    if (!editingStep) return;
    setDraftStep((prev) => ({ ...prev, ...patch }));

    const updated = chains.map((c) => {
      if (c.id !== editingStep.chainId) return c;
      return {
        ...c,
        steps: c.steps.map((s) => {
          if (s.id !== editingStep.stepId) return s;
          return {
            ...s,
            ...patch,
            key: patch.key !== undefined ? patch.key.toUpperCase() : s.key,
            actionType: 'press' as const,
          };
        }),
      };
    });
    onChainsChange(updated);
  };

  // Create a new step with captured key and open docked editor panel
  const handleCreateStepWithKey = (chainId: string, key: string, stepType: 'skill' | 'water' = 'skill') => {
    soundFx.playClick();
    const nextIdx = currentChain.steps.length + 1;
    const newStepId = `step_${Date.now()}_${stepType}_${nextIdx}`;
    const newStep: ChainStep = {
      id: newStepId,
      key: key.toUpperCase(),
      castTimeSeconds: stepType === 'water' ? 0 : 1.5,
      skillCooldownSeconds: 0,
      repeatCount: 1,
      independent: stepType === 'water',
      actionType: 'press',
      stepType,
      ...(stepType === 'water' ? { mpBelowPercent: 40 } : {}),
    };
    const updated = chains.map((c) => {
      if (c.id === chainId) {
        return { ...c, steps: [...c.steps, newStep] };
      }
      return c;
    });
    onChainsChange(updated);
    setIsAddingNewStep(null);
    setEditingStep({ chainId, stepId: newStepId });
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

  // Quick key update from slot keypress: saves key and opens editing panel
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
    setActiveCapturingStepId(null);
    // After keypress, open editing panel for this step!
    setEditingStep({ chainId, stepId });
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

  const editingStepData = editingStep
    ? currentChain.steps.find((s) => s.id === editingStep.stepId)
    : null;
  const editingStepIdx = editingStepData
    ? currentChain.steps.findIndex((s) => s.id === editingStepData.id)
    : -1;

  return (
    <div className="flex flex-col gap-4 w-full select-none text-zinc-900 dark:text-zinc-100 font-sans">
      {/* 1. TOP BAR: Header & Clear Action */}
      <div className="flex items-center justify-between pb-2 border-b border-black/10 dark:border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold tracking-wider uppercase text-zinc-950 dark:text-white">
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
          className="p-1.5 rounded-lg border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-mono"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{isRu ? 'Сбросить' : 'Reset'}</span>
        </button>
      </div>

      {/* 2. SPELL SLOTS ROW (Ghost Action Bar) */}
      <div className="p-3 rounded-xl bg-transparent border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] flex flex-wrap items-center gap-2.5 min-h-[64px] transition-all duration-200">
        {currentChain.steps.map((step, idx) => {
          const isCasting = activeCasting?.chainId === currentChain.id && activeCasting?.stepId === step.id;
          const isCurrentlyEditing = editingStep?.stepId === step.id;
          const isDragged = draggedIdx === idx;
          const isDragOver = dragOverIdx === idx && draggedIdx !== idx;

          return (
            <div
              key={step.id}
              draggable={activeCapturingStepId !== step.id}
              onDragStart={(e) => {
                setDraggedIdx(idx);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(idx));
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverIdx !== idx) {
                  setDragOverIdx(idx);
                }
              }}
              onDragLeave={() => {
                if (dragOverIdx === idx) {
                  setDragOverIdx(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedIdx !== null && draggedIdx !== idx) {
                  handleReorderSteps(draggedIdx, idx);
                }
                setDraggedIdx(null);
                setDragOverIdx(null);
              }}
              onDragEnd={() => {
                setDraggedIdx(null);
                setDragOverIdx(null);
              }}
              onClick={() => setEditingStep({ chainId: currentChain.id, stepId: step.id })}
              className={`w-[44px] sm:w-[48px] h-[44px] sm:h-[48px] rounded-lg p-1 relative flex flex-col items-center justify-center cursor-grab active:cursor-grabbing transition-all duration-150 group select-none ${
                isDragged
                  ? 'opacity-30 scale-90 border-dashed border-zinc-400 dark:border-zinc-500'
                  : isDragOver
                  ? 'border-2 border-zinc-950 dark:border-white scale-105 shadow-[0_0_12px_rgba(255,255,255,0.3)] bg-black/10 dark:bg-white/15 z-30'
                  : activeCapturingStepId === step.id
                  ? 'border border-zinc-950 dark:border-white text-zinc-950 dark:text-white animate-pulse bg-black/5 dark:bg-white/10 z-30'
                  : isCasting
                  ? 'border border-zinc-950 dark:border-white text-zinc-950 dark:text-white scale-105 z-20'
                  : isCurrentlyEditing
                  ? step.stepType === 'water'
                    ? 'border-2 border-blue-400 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.35)] bg-blue-500/15 z-20'
                    : 'border border-zinc-950 dark:border-white text-zinc-950 dark:text-white z-20'
                  : step.stepType === 'water'
                  ? 'border border-blue-500/40 text-blue-400 hover:border-blue-400 bg-blue-500/5'
                  : 'border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent'
              }`}
              title={isRu ? 'Зажмите и перетащите, чтобы переместить слот вперёд или назад' : 'Drag to reorder slot forward or backward'}
            >
              {/* Slot Index */}
              <span className={`absolute top-1 left-1.5 text-[8px] font-mono font-medium pointer-events-none ${
                step.stepType === 'water' ? 'text-blue-400/80' : 'text-zinc-400 dark:text-zinc-600'
              }`}>
                {idx + 1}
              </span>

              {/* Remove Step '✕' on hover */}
              {currentChain.steps.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => handleDeleteStep(currentChain.id, step.id, e)}
                  title={isRu ? 'Удалить умение' : 'Delete spell'}
                  className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-zinc-200 dark:bg-zinc-900 border border-black/20 dark:border-white/30 text-zinc-700 dark:text-zinc-300 text-[8px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-zinc-950 hover:text-white dark:hover:bg-white dark:hover:text-black cursor-pointer z-30"
                >
                  ✕
                </button>
              )}

              {/* Keycap Label */}
              <button
                type="button"
                id={`slot-key-btn-${step.id}`}
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
                    e.currentTarget.blur();
                  }
                }}
                className={`w-full text-center font-mono font-bold text-xs tracking-wide transition-colors outline-none cursor-pointer ${
                  activeCapturingStepId === step.id
                    ? step.stepType === 'water'
                      ? 'text-blue-300 animate-pulse'
                      : 'text-zinc-950 dark:text-white animate-pulse'
                    : step.stepType === 'water'
                    ? 'text-blue-400'
                    : step.key
                    ? 'text-zinc-950 dark:text-white'
                    : 'text-zinc-400 dark:text-zinc-600'
                }`}
              >
                {activeCapturingStepId === step.id ? (isRu ? 'ЖМИ' : 'PRESS') : step.key || '—'}
              </button>

              {/* Condition Indicator (HP for normal skills, MP for water) */}
              {step.stepType === 'water' ? (
                <span className="absolute top-1 right-1 text-[7px] font-mono font-medium text-blue-400 bg-blue-500/15 border border-blue-500/30 rounded px-0.5 flex items-center gap-0.5">
                  {step.mpBelowPercent != null ? `${step.mpBelowPercent}%` : 'MP'}
                </span>
              ) : (
                step.hpBelowPercent != null && (
                  <span className="absolute top-1 right-1 text-[7px] font-mono font-medium text-zinc-700 dark:text-zinc-300 bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/20 rounded px-0.5">
                    &lt;{step.hpBelowPercent}%
                  </span>
                )
              )}
            </div>
          );
        })}

        {/* Regular Add Step '+' Button - morphs coolly into glowing 'ЖМИ' on click */}
        {isAddingNewStep === 'regular' ? (
          <button
            ref={addingBtnRef}
            type="button"
            tabIndex={0}
            autoFocus
            onBlur={() => setIsAddingNewStep(null)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsAddingNewStep(null);
                return;
              }
              const captured = getPhysicalKeyFromEvent(e);
              if (captured !== null) {
                e.preventDefault();
                e.stopPropagation();
                handleCreateStepWithKey(currentChain.id, captured, 'skill');
              }
            }}
            className="w-[44px] sm:w-[48px] h-[44px] sm:h-[48px] rounded-lg border-2 border-zinc-950 dark:border-white bg-black/10 dark:bg-white/15 text-zinc-950 dark:text-white shadow-[0_0_14px_rgba(255,255,255,0.4)] scale-105 animate-pulse font-mono font-bold text-[11px] sm:text-xs flex items-center justify-center cursor-pointer shrink-0 transition-all outline-none"
            title={isRu ? 'Нажмите любую клавишу на клавиатуре (Esc для отмены)' : 'Press any key on keyboard (Esc to cancel)'}
          >
            {isRu ? 'ЖМИ' : 'PRESS'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setIsAddingNewStep('regular');
            }}
            title={isRu ? 'Добавить слот в ротацию' : 'Add slot to rotation'}
            className="w-[44px] sm:w-[48px] h-[44px] sm:h-[48px] rounded-lg border border-dashed border-black/20 dark:border-white/20 hover:border-black/50 dark:hover:border-white hover:bg-black/5 dark:hover:bg-white/5 text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition-all flex items-center justify-center cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[1.5]" />
          </button>
        )}

        {/* Special Blue Dashed '+' Button for Water / Mana regen - morphs coolly into glowing 'ЖМИ' on click */}
        {isAddingNewStep === 'water' ? (
          <button
            ref={addingBtnRef}
            type="button"
            tabIndex={0}
            autoFocus
            onBlur={() => setIsAddingNewStep(null)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsAddingNewStep(null);
                return;
              }
              const captured = getPhysicalKeyFromEvent(e);
              if (captured !== null) {
                e.preventDefault();
                e.stopPropagation();
                handleCreateStepWithKey(currentChain.id, captured, 'water');
              }
            }}
            className="w-[44px] sm:w-[48px] h-[44px] sm:h-[48px] rounded-lg border-2 border-blue-400 bg-blue-500/20 text-blue-300 shadow-[0_0_14px_rgba(59,130,246,0.5)] scale-105 animate-pulse font-mono font-bold text-[11px] sm:text-xs flex items-center justify-center cursor-pointer shrink-0 transition-all outline-none"
            title={isRu ? 'Нажмите клавишу для слота воды (Esc для отмены)' : 'Press key for water slot (Esc to cancel)'}
          >
            {isRu ? 'ЖМИ' : 'PRESS'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              setIsAddingNewStep('water');
            }}
            title={isRu ? 'Добавить слот для воды (манареген)' : 'Add water/mana slot'}
            className="w-[44px] sm:w-[48px] h-[44px] sm:h-[48px] rounded-lg border border-dashed border-blue-500/60 hover:border-blue-400 hover:bg-blue-500/10 text-blue-400 hover:text-blue-300 transition-all flex items-center justify-center cursor-pointer shrink-0 relative group"
          >
            <Plus className="w-4 h-4 stroke-[1.5] text-blue-400 group-hover:scale-110 transition-transform" />
          </button>
        )}
      </div>

      {/* 3. DOCKED BOTTOM EDITING PANEL (Ghost Mode) */}
      <div className="w-full rounded-2xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent p-4 shadow-none transition-all duration-200">
        {editingStep && editingStepData ? (
          <div className="flex flex-col gap-3.5">
            {/* Panel Header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-transparent">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-mono font-medium tracking-wide text-zinc-950 dark:text-white flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded font-mono font-bold ${
                    editingStepData.stepType === 'water'
                      ? 'text-blue-400 bg-blue-500/10 border border-blue-500/20'
                      : 'text-zinc-950 dark:text-white'
                  }`}>
                    #{editingStepIdx + 1}
                  </span>
                  <span>
                    {editingStepData.stepType === 'water'
                      ? isRu
                        ? 'Слот для воды (манареген)'
                        : 'Water slot (mana regen)'
                      : isRu
                      ? 'Редактирование умения'
                      : 'Edit spell slot'}
                  </span>
                </span>
                <div className="flex items-center gap-0.5 ml-1">
                  <button
                    type="button"
                    disabled={editingStepIdx <= 0}
                    onClick={() => handleReorderSteps(editingStepIdx, editingStepIdx - 1)}
                    className="p-1 rounded text-zinc-400 hover:text-zinc-950 dark:hover:text-white disabled:opacity-20 disabled:pointer-events-none cursor-pointer transition-colors"
                    title={isRu ? 'Переместить назад (влево)' : 'Move left'}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={editingStepIdx >= currentChain.steps.length - 1}
                    onClick={() => handleReorderSteps(editingStepIdx, editingStepIdx + 1)}
                    className="p-1 rounded text-zinc-400 hover:text-zinc-950 dark:hover:text-white disabled:opacity-20 disabled:pointer-events-none cursor-pointer transition-colors"
                    title={isRu ? 'Переместить вперёд (вправо)' : 'Move right'}
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className={`text-xs font-mono ${editingStepData.stepType === 'water' ? 'text-blue-400' : 'text-zinc-500'}`}>
                  {draftStep.key ? `[${draftStep.key}]` : isRu ? '(клавиша не привязана)' : '(no key)'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingStep(null)}
                  className="p-1 rounded-lg text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer"
                  title={isRu ? 'Закрыть панель' : 'Close panel'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Editing Cards: Simplified 2-card layout for Water, 4-card layout for Regular Skills */}
            {editingStepData.stepType === 'water' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-xl">
                {/* CARD 1: Keybind Capture */}
                <div className="p-3 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent flex flex-col justify-between gap-2.5 transition-all">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                      1. {isRu ? 'Клавиша' : 'Keybind'}
                    </label>
                    <div className="flex items-center gap-1.5">
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
                            handleUpdateCurrentStep({ key: captured.toUpperCase() });
                            setIsPanelKeyCapturing(false);
                            e.currentTarget.blur();
                          }
                        }}
                        className={`h-7 px-2.5 rounded font-mono font-bold text-xs uppercase flex items-center justify-center border transition-all cursor-pointer outline-none select-none ${
                          isPanelKeyCapturing
                            ? 'border-zinc-950 dark:border-white text-zinc-950 dark:text-white animate-pulse bg-black/5 dark:bg-white/10'
                            : draftStep.key
                            ? 'bg-transparent border-black/20 dark:border-white/20 text-zinc-950 dark:text-white hover:border-black/40 dark:hover:border-white/40'
                            : 'bg-transparent border-dashed border-black/20 dark:border-white/20 text-zinc-400 hover:border-black/40 dark:hover:border-white/40'
                        }`}
                      >
                        <span>{isPanelKeyCapturing ? (isRu ? '[ЖМИ]' : '[PRESS]') : `[${draftStep.key || '—'}]`}</span>
                      </button>

                      {draftStep.key && (
                        <button
                          type="button"
                          onClick={() => handleUpdateCurrentStep({ key: '' })}
                          className="w-7 h-7 rounded text-zinc-400 hover:text-red-500 text-xs flex items-center justify-center transition-colors cursor-pointer"
                          title={isRu ? 'Очистить клавишу' : 'Clear key'}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <span className="text-[10px] text-zinc-500 font-mono">
                    {isPanelKeyCapturing
                      ? isRu
                        ? 'ЖМИ КЛАВИШУ НА КЛАВИАТУРЕ...'
                        : 'PRESS KEY ON KEYBOARD...'
                      : isRu
                      ? 'кликните для назначения клавиши'
                      : 'click to assign key'}
                  </span>
                </div>

                {/* CARD 2: MP Below Condition ONLY (styled exactly like HP, without presets) */}
                <div className="p-3 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent flex flex-col justify-between gap-2.5 transition-all">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                      2. {isRu ? 'Условие' : 'Condition'}
                    </label>
                    <span className="text-[10px] font-mono text-zinc-400">
                      {draftStep.mpBelowPercent != null ? `<${draftStep.mpBelowPercent}%` : '—'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5 font-medium">
                        <Droplet className="w-3.5 h-3.5 text-blue-400 fill-blue-400/40 animate-pulse shrink-0" />
                        <span>{isRu ? 'Если MP ниже:' : 'If MP below:'}</span>
                      </span>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-transparent border border-black/15 dark:border-white/10 hover:border-black/30 dark:hover:border-white/20 focus-within:border-zinc-950 dark:focus-within:border-white">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={mpInputStr}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, '').slice(0, 3);
                            setMpInputStr(raw);
                            const val = parseInt(raw, 10);
                            const validMp = !isNaN(val) ? Math.min(100, Math.max(1, val)) : null;
                            handleUpdateCurrentStep({ mpBelowPercent: validMp, independent: true });
                          }}
                          className="w-8 bg-transparent text-center font-mono font-bold text-xs text-zinc-950 dark:text-white outline-none"
                          placeholder="—"
                        />
                        <span className="text-[10px] font-mono text-zinc-500">%</span>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500 pl-5 leading-tight">
                      {isRu ? 'для манарегена / питья воды' : 'for mana recovery'}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Regular 2 cards for skill slots */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* CARD 1: Keybind Capture & HP Below */}
                <div className="p-3 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent flex flex-col justify-between gap-2.5 transition-all">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                      1. {isRu ? 'Клавиша' : 'Keybind'}
                    </label>
                    <div className="flex items-center gap-1.5">
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
                            handleUpdateCurrentStep({ key: captured.toUpperCase() });
                            setIsPanelKeyCapturing(false);
                            e.currentTarget.blur();
                          }
                        }}
                        className={`h-7 px-2.5 rounded font-mono font-bold text-xs uppercase flex items-center justify-center border transition-all cursor-pointer outline-none select-none ${
                          isPanelKeyCapturing
                            ? 'border-zinc-950 dark:border-white text-zinc-950 dark:text-white animate-pulse bg-black/5 dark:bg-white/10'
                            : draftStep.key
                            ? 'bg-transparent border-black/20 dark:border-white/20 text-zinc-950 dark:text-white hover:border-black/40 dark:hover:border-white/40'
                            : 'bg-transparent border-dashed border-black/20 dark:border-white/20 text-zinc-400 hover:border-black/40 dark:hover:border-white/40'
                        }`}
                      >
                        <span>{isPanelKeyCapturing ? (isRu ? '[ЖМИ]' : '[PRESS]') : `[${draftStep.key || '—'}]`}</span>
                      </button>

                      {draftStep.key && (
                        <button
                          type="button"
                          onClick={() => handleUpdateCurrentStep({ key: '' })}
                          className="w-7 h-7 rounded text-zinc-400 hover:text-red-500 text-xs flex items-center justify-center transition-colors cursor-pointer"
                          title={isRu ? 'Очистить клавишу' : 'Clear key'}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <span className="text-[10px] text-zinc-500 font-mono">
                    {isPanelKeyCapturing
                      ? isRu
                        ? 'ЖМИ КЛАВИШУ НА КЛАВИАТУРЕ...'
                        : 'PRESS KEY ON KEYBOARD...'
                      : isRu
                      ? 'кликните для назначения клавиши'
                      : 'click to assign key'}
                  </span>

                  {/* HP Below Function inserted into Container 1 */}
                  <div className="flex flex-col gap-1 pt-1.5 border-t border-black/5 dark:border-white/5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5 font-medium">
                        <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500/40 animate-pulse shrink-0" />
                        <span>{isRu ? 'Если HP ниже:' : 'If HP below:'}</span>
                      </span>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-transparent border border-black/15 dark:border-white/10 hover:border-black/30 dark:hover:border-white/20 focus-within:border-zinc-950 dark:focus-within:border-white">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={hpInputStr}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/[^0-9]/g, '').slice(0, 3);
                            setHpInputStr(raw);
                            const val = parseInt(raw, 10);
                            const validHp = !isNaN(val) ? Math.min(100, Math.max(1, val)) : null;
                            if (validHp != null) {
                              handleUpdateCurrentStep({ hpBelowPercent: validHp, independent: true });
                            } else {
                              handleUpdateCurrentStep({ hpBelowPercent: null });
                            }
                          }}
                          className="w-8 bg-transparent text-center font-mono font-bold text-xs text-zinc-950 dark:text-white outline-none"
                          placeholder="—"
                        />
                        <span className="text-[10px] font-mono text-zinc-500">%</span>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500 pl-5 leading-tight">
                      {isRu ? 'для лечащих скилов' : 'for healing skills'}
                    </span>
                  </div>
                </div>

                {/* CARD 2: Trigger Condition & Cooldowns & Cast Time */}
                <div className="p-3 rounded-xl border border-transparent hover:border-black/10 dark:hover:border-white/[0.08] bg-transparent flex flex-col justify-between gap-2.5 transition-all">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-mono font-semibold text-zinc-700 dark:text-zinc-300">
                      2. {isRu ? 'Условие' : 'Condition'}
                    </label>

                    {/* Pulsing White CD badge until user enters a number */}
                    {(() => {
                      const isCdEmptyOrZero =
                        !draftStep.skillCooldownSeconds ||
                        draftStep.skillCooldownSeconds === 0 ||
                        cdInputStr.trim() === '' ||
                        cdInputStr.trim() === '0';
                      return (
                        <div
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all ${
                            isCdEmptyOrZero
                              ? 'animate-pulse bg-white/10 border border-white text-white shadow-[0_0_10px_rgba(255,255,255,0.3)] ring-1 ring-white/30'
                              : 'bg-transparent border border-black/15 dark:border-white/20 text-zinc-950 dark:text-white'
                          }`}
                        >
                          <span className={`text-[10px] font-mono font-bold tracking-wider ${isCdEmptyOrZero ? 'text-white font-extrabold' : 'text-zinc-300'}`}>
                            {isRu ? 'КД:' : 'CD:'}
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={cdInputStr}
                            placeholder="0"
                            onChange={(e) => {
                              let raw = e.target.value.replace(/[^0-9.,]/g, '');
                              setCdInputStr(raw);
                              const parsed = parseFloat(raw.replace(',', '.'));
                              if (!isNaN(parsed)) {
                                handleUpdateCurrentStep({
                                  skillCooldownSeconds: Math.min(300, Math.max(0, parsed)),
                                });
                              }
                            }}
                            className={`w-9 bg-transparent text-center font-mono font-bold text-xs outline-none ${
                              isCdEmptyOrZero ? 'text-white font-extrabold placeholder:text-white/70' : 'text-zinc-950 dark:text-white'
                            }`}
                          />
                          <span className={`text-[10px] font-mono ${isCdEmptyOrZero ? 'text-white font-bold' : 'text-zinc-400'}`}>
                            {isRu ? 'с' : 's'}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Mode toggle */}
                  <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-transparent border border-transparent hover:border-black/10 dark:hover:border-white/[0.08]">
                    <button
                      type="button"
                      onClick={() => handleUpdateCurrentStep({ independent: false })}
                      className={`py-1.5 px-2 rounded-md text-[10px] font-mono font-medium transition cursor-pointer flex items-center justify-center gap-1 ${
                        !draftStep.independent
                          ? 'text-zinc-950 dark:text-white font-semibold underline underline-offset-4'
                          : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                      }`}
                    >
                      <span>{isRu ? 'По очереди' : 'Sequential'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateCurrentStep({ independent: true })}
                      className={`py-1.5 px-2 rounded-md text-[10px] font-mono font-medium transition cursor-pointer flex items-center justify-center gap-1 ${
                        draftStep.independent
                          ? 'text-zinc-950 dark:text-white font-semibold underline underline-offset-4'
                          : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                      }`}
                    >
                      <Zap className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
                      <span>{isRu ? 'По готовности' : 'ASAP'}</span>
                    </button>
                  </div>

                  {/* Cast Time functionality placed under "По очереди / По готовности" */}
                  <div className="flex flex-col gap-1.5 pt-1.5 border-t border-black/5 dark:border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-300 font-medium">
                        {isRu ? 'Время каста:' : 'Cast Time:'}
                      </span>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-transparent border border-black/15 dark:border-white/10 hover:border-black/30 dark:hover:border-white/20 focus-within:border-zinc-950 dark:focus-within:border-white">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={castInputStr}
                          onChange={(e) => {
                            let raw = e.target.value.replace(/[^0-9.,]/g, '');
                            setCastInputStr(raw);
                            const parsed = parseFloat(raw.replace(',', '.'));
                            if (!isNaN(parsed)) {
                              handleUpdateCurrentStep({
                                castTimeSeconds: Math.min(MAX_CAST_SECONDS, Math.max(0, parsed)),
                              });
                            }
                          }}
                          className="w-8 bg-transparent text-center font-mono font-bold text-xs text-zinc-950 dark:text-white outline-none"
                        />
                        <span className="text-[10px] font-mono text-zinc-500">{isRu ? 'с' : 's'}</span>
                      </div>
                    </div>

                    {/* Cast presets */}
                    <div className="grid grid-cols-6 gap-1">
                      {[0, 1, 1.5, 2, 2.5, 3].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setCastInputStr(String(s));
                            handleUpdateCurrentStep({ castTimeSeconds: s });
                          }}
                          className={`h-6 rounded text-[10px] font-mono transition cursor-pointer border flex items-center justify-center ${
                            draftStep.castTimeSeconds === s
                              ? 'text-zinc-950 dark:text-white font-bold underline underline-offset-2 border-transparent'
                              : 'border-transparent text-zinc-500 hover:text-zinc-950 dark:hover:text-white'
                          }`}
                        >
                          {s}s
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Actions Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-black/10 dark:border-white/10">
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500">
                <Check className="w-3.5 h-3.5 text-zinc-400" />
                <span>{isRu ? 'Все параметры сохраняются автоматически' : 'All settings save automatically'}</span>
              </div>
            </div>
          </div>
        ) : (
          /* Empty / Idle State when no slot is active */
          <div className="py-6 flex flex-col items-center justify-center gap-2 text-center text-zinc-500 font-mono">
            <p className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">
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
                className="mt-1 px-3 py-1 text-[11px] font-mono rounded border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer transition-colors"
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
