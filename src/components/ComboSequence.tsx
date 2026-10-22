import React, { useState, useEffect } from 'react';
import { ComboChain, ChainStep } from '../data/skillsLibrary';
import { Plus, Clock, RotateCcw, Pencil } from 'lucide-react';
import { Language, Theme, translations } from '../utils/i18n';

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
  theme = 'dark',
}) => {
  const t = translations[language];
  const isDark = theme === 'dark';

  // Active step being configured in modal
  const [editingStep, setEditingStep] = useState<{ chainId: string; stepId: string } | null>(null);

  // Active step key listening on the combo bar tile (no text caret, instant key press)
  const [activeCapturingStepId, setActiveCapturingStepId] = useState<string | null>(null);

  // Active key listening in the step editor modal (no text caret, instant key press)
  const [isModalKeyCapturing, setIsModalKeyCapturing] = useState<boolean>(false);

  // Draft step state for modal editing (actionType always 'press')
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

  // String buffer states for smooth decimal, comma and zero-erasing inputs
  const [castInputStr, setCastInputStr] = useState<string>('1.5');
  const [cdInputStr, setCdInputStr] = useState<string>('0');
  const [hpInputStr, setHpInputStr] = useState<string>('');

  // Reference the active rotation chain (single sequence)
  const currentChain = chains[0] || {
    id: 'chain_1',
    name: 'Ротация умений',
    order: 1,
    cooldown: 0,
    triggerAfterChainId: 'always',
    steps: []
  };

  // Add a step to chain (Default: key "", cast 1.5s, CD 0)
  const handleAddStepToChain = (chainId: string) => {
    const updated = chains.map(c => {
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
  };

  // Delete a step from chain («Убрать умение»)
  const handleDeleteStep = (chainId: string, stepId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = chains.map(c => {
      if (c.id === chainId) {
        return { ...c, steps: c.steps.filter(s => s.id !== stepId) };
      }
      return c;
    });
    onChainsChange(updated);
  };

  // Update key inside a step
  const handleUpdateStepKey = (chainId: string, stepId: string, newKey: string) => {
    const updated = chains.map(c => {
      if (c.id !== chainId) return c;
      return {
        ...c,
        steps: c.steps.map(s => {
          if (s.id !== stepId) return s;
          return { ...s, key: newKey.toUpperCase(), actionType: 'press' as const };
        })
      };
    });
    onChainsChange(updated);
  };

  // Update step arbitrary fields
  const handleUpdateStep = (chainId: string, stepId: string, updates: Partial<ChainStep>) => {
    const updated = chains.map(c => {
      if (c.id !== chainId) return c;
      return {
        ...c,
        steps: c.steps.map(s => (s.id === stepId ? { ...s, ...updates, actionType: 'press' as const } : s))
      };
    });
    onChainsChange(updated);
  };

  // Reset steps in current chain to empty
  const handleClearAllChainSteps = (chainId: string) => {
    const updated = chains.map(c => {
      if (c.id === chainId) {
        return {
          ...c,
          steps: c.steps.map(s => ({ ...s, key: '', castTimeSeconds: 1.5, skillCooldownSeconds: 0, repeatCount: 1 }))
        };
      }
      return c;
    });
    onChainsChange(updated);
  };

  // Target step data for the step editor modal
  const editingChain = chains.find(c => c.id === editingStep?.chainId);
  const editingStepData = editingChain?.steps.find(s => s.id === editingStep?.stepId);
  const editingStepIndex = editingChain ? editingChain.steps.findIndex(s => s.id === editingStep?.stepId) : -1;

  // Sync draft state whenever a step is selected for editing
  useEffect(() => {
    if (editingStep && editingStepData) {
      const cd = typeof editingStepData.skillCooldownSeconds === 'number'
        ? editingStepData.skillCooldownSeconds
        : 0;
      const cast = editingStepData.castTimeSeconds ?? 1.5;
      const hp = editingStepData.hpBelowPercent != null ? editingStepData.hpBelowPercent : null;
      setDraftStep({
        key: editingStepData.key || '',
        castTimeSeconds: cast,
        repeatCount: editingStepData.repeatCount ?? 1,
        independent: Boolean(editingStepData.independent),
        skillCooldownSeconds: cd,
        hpBelowPercent: hp,
      });
      setCastInputStr(String(cast));
      setCdInputStr(String(cd));
      setHpInputStr(hp != null ? String(hp) : '');
    }
  }, [editingStep?.chainId, editingStep?.stepId]);

  // Close modal on Escape key (or cancel key capture if active)
  useEffect(() => {
    if (!editingStep) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isModalKeyCapturing) {
          setIsModalKeyCapturing(false);
          return;
        }
        setEditingStep(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingStep, isModalKeyCapturing]);

  // Commit changes from draft to active chain
  const handleSaveStep = () => {
    if (!editingStep) return;
    const parsedCast = parseFloat(castInputStr.replace(',', '.'));
    const finalCast = !isNaN(parsedCast) ? Math.min(MAX_CAST_SECONDS, Math.max(0, parsedCast)) : (draftStep.castTimeSeconds ?? 1.5);
    const parsedCd = parseFloat(cdInputStr.replace(',', '.'));
    const finalCd = !isNaN(parsedCd) ? Math.min(300, Math.max(0, parsedCd)) : (draftStep.skillCooldownSeconds ?? 0);
    const cd = Math.max(0, finalCd);

    const parsedHp = hpInputStr.trim() === '' ? null : parseInt(hpInputStr, 10);
    const finalHp = parsedHp != null && !isNaN(parsedHp) ? Math.min(100, Math.max(0, parsedHp)) : null;

    handleUpdateStep(editingStep.chainId, editingStep.stepId, {
      key: draftStep.key.toUpperCase(),
      actionType: 'press',
      castTimeSeconds: finalCast,
      repeatCount: Math.min(10, Math.max(1, draftStep.repeatCount ?? 1)),
      independent: draftStep.independent,
      skillCooldownSeconds: cd,
      hpBelowPercent: finalHp,
    });
    setEditingStep(null);
  };

  return (
    <div className="w-full flex flex-col gap-2 relative select-none">
      <div className={`w-full rounded-xl p-3 sm:p-3.5 flex flex-col gap-2 relative transition-all duration-200 border ${
        isDark
          ? 'bg-[#08080c] border-zinc-800/90 shadow-[0_6px_25px_rgba(0,0,0,0.95)]'
          : 'bg-white border-zinc-200 shadow-[0_4px_20px_rgba(0,0,0,0.06)] text-zinc-800'
      }`}>
        {/* Header: Ротация умений / Ability Rotation */}
        <div className={`flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-xs ${
          isDark ? 'border-zinc-800/80 text-zinc-200' : 'border-zinc-200 text-zinc-800'
        }`}>
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.85)]' : 'bg-blue-600'}`} />
            <span className={`font-semibold text-xs tracking-wide ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
              {t.rotationTitle}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Reset Steps in Chain */}
            <button
              onClick={() => handleClearAllChainSteps(currentChain.id)}
              title={t.clearKeys}
              className={`p-1 rounded transition cursor-pointer ${
                isDark
                  ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/70 hover:shadow-[0_0_10px_rgba(255,255,255,0.15)]'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Chain Steps Squares - Compact Keycaps */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 w-full pt-1 relative min-h-[46px]">
          <div className="flex flex-wrap items-center gap-1.5 max-w-full">
            {currentChain.steps.map((step, idx) => {
              const isCasting = activeCasting?.chainId === currentChain.id && activeCasting?.stepId === step.id;
              const isIndependent = Boolean(step.independent);
              const isCurrentlyEditing = editingStep?.stepId === step.id;

              return (
                <div
                  key={step.id}
                  onClick={() => setEditingStep({ chainId: currentChain.id, stepId: step.id })}
                  className={`w-[44px] h-[44px] sm:w-[48px] sm:h-[48px] md:w-[52px] md:h-[52px] rounded-lg p-0.5 relative flex flex-col items-center justify-center select-none group transition-all duration-200 shrink-0 cursor-pointer ${
                    isCasting
                      ? isDark
                        ? 'ring-2 ring-zinc-200 shadow-[0_0_22px_rgba(255,255,255,0.85)] scale-105 bg-[#22222d] z-20'
                        : 'ring-2 ring-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)] scale-105 bg-blue-50 z-20'
                      : isCurrentlyEditing
                      ? isDark
                        ? 'ring-2 ring-cyan-400 shadow-[0_0_16px_rgba(6,182,212,0.6)] scale-105 bg-[#0c1626] border border-cyan-400 z-20'
                        : 'ring-2 ring-blue-500 shadow-[0_0_14px_rgba(59,130,246,0.5)] scale-105 bg-blue-50 border border-blue-400 z-20'
                      : isIndependent
                      ? isDark
                        ? 'bg-[#0b1329] border border-blue-500/80 shadow-[0_0_12px_rgba(59,130,246,0.25)] hover:border-blue-400 hover:bg-[#101b38]'
                        : 'bg-blue-50/80 border border-blue-400 shadow-xs hover:border-blue-500 hover:bg-blue-100/60'
                      : isDark
                      ? 'bg-[#0d0d12] border border-zinc-800/90 hover:border-cyan-500/60 hover:shadow-[0_0_14px_rgba(6,182,212,0.25)] hover:bg-[#111624]'
                      : 'bg-zinc-50 border border-zinc-250 hover:border-zinc-400 hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)] hover:bg-white text-zinc-900'
                  }`}
                  style={{
                    boxShadow: isCasting
                      ? '0 0 18px rgba(255,255,255,0.65), inset 0 1px 0 rgba(255,255,255,0.2)'
                      : isCurrentlyEditing
                      ? '0 0 14px rgba(6,182,212,0.4), inset 0 1px 0 rgba(6,182,212,0.3)'
                      : isIndependent
                      ? 'inset 0 1px 0 rgba(59,130,246,0.2), 0 2px 6px rgba(0,0,0,0.85)'
                      : isDark
                      ? 'inset 0 1px 0 rgba(255,255,255,0.06), 0 2px 5px rgba(0,0,0,0.8)'
                      : '0 1px 3px rgba(0,0,0,0.05)',
                  }}
                >
                  {/* Step Index number in top-left */}
                  <div className={`absolute top-0.5 left-1 z-10 font-mono pointer-events-none text-[8px] ${
                    isDark ? 'text-zinc-500 group-hover:text-zinc-300' : 'text-zinc-400 group-hover:text-zinc-700'
                  }`}>
                    {idx + 1}
                  </div>

                  {/* Delete Step button («Убрать умение») in top-right (on hover) */}
                  {currentChain.steps.length > 1 && (
                    <button
                      onClick={(e) => handleDeleteStep(currentChain.id, step.id, e)}
                      title={t.deleteStep}
                      className={`absolute -top-1 -right-1 z-30 w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow border cursor-pointer ${
                        isDark
                          ? 'bg-[#181822] hover:bg-zinc-700 text-zinc-400 hover:text-white border-zinc-600'
                          : 'bg-white hover:bg-rose-50 text-zinc-500 hover:text-rose-600 border-zinc-300'
                      }`}
                    >
                      ✕
                    </button>
                  )}

                  {/* Key Input inside the square */}
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
                    className={`w-full text-center font-mono font-black text-xs uppercase transition-all tracking-wide py-0.5 select-none cursor-pointer caret-transparent outline-none rounded ${
                      activeCapturingStepId === step.id
                        ? 'bg-blue-600/30 text-blue-200 ring-1 ring-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.6)] animate-pulse'
                        : step.key
                        ? isDark
                          ? 'text-zinc-100 group-hover:text-white group-hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]'
                          : 'text-zinc-800 group-hover:text-zinc-950 font-bold'
                        : isDark
                        ? 'text-zinc-600 group-hover:text-zinc-400'
                        : 'text-zinc-400 group-hover:text-zinc-600'
                    }`}
                    title={t.stepHoverHint}
                  >
                    {activeCapturingStepId === step.id ? (
                      <span className="text-[9.5px] text-blue-400 font-sans tracking-tight font-bold">{t.pressPrompt}</span>
                    ) : (
                      step.key || '+'
                    )}
                  </button>

                  {/* Step Edit Button (Карандаш редактирования умения) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingStep({ chainId: currentChain.id, stepId: step.id });
                    }}
                    title={t.editStep}
                    className={`absolute bottom-0.5 left-0.5 z-20 w-3 h-3 rounded flex items-center justify-center transition cursor-pointer select-none active:scale-90 border ${
                      isCurrentlyEditing
                        ? 'bg-[#0c1626] text-cyan-300 border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)]'
                        : isDark
                        ? 'bg-[#070b12] hover:bg-[#0c1626] text-cyan-400/90 hover:text-cyan-200 border-cyan-900/60 hover:border-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.25)]'
                        : 'bg-white hover:bg-blue-50 text-blue-600 hover:text-blue-700 border-zinc-300 hover:border-blue-400 shadow-xs'
                    }`}
                  >
                    <Pencil className="w-1.5 h-1.5 drop-shadow-[0_0_3px_rgba(6,182,212,0.6)]" />
                  </button>

                  {/* Repeat Count Badge */}
                  {step.repeatCount && step.repeatCount > 1 && (
                    <span
                      title={`${t.repeatTitle}: ${step.repeatCount}`}
                      className={`absolute bottom-0.5 right-1 z-20 font-mono text-[7.5px] font-bold px-1 py-0.2 rounded border shadow-xs select-none pointer-events-none ${
                        isDark
                          ? 'text-amber-300 bg-[#120e06] border-amber-500/60 shadow-[0_0_6px_rgba(245,158,11,0.3)]'
                          : 'text-amber-800 bg-amber-50 border-amber-400'
                      }`}
                    >
                      {step.repeatCount}×
                    </span>
                  )}

                  {/* HP Condition Badge */}
                  {step.hpBelowPercent != null && (
                    <span
                      title={`${t.hpBelowLabel} ${step.hpBelowPercent}%`}
                      className={`absolute top-0.5 right-1 z-10 font-mono text-[7px] font-bold px-1 py-0.2 rounded border shadow-xs select-none pointer-events-none ${
                        isDark
                          ? 'text-rose-300 bg-[#1f0a10] border-rose-500/60 shadow-[0_0_6px_rgba(244,63,94,0.3)]'
                          : 'text-rose-700 bg-rose-50 border-rose-300'
                      }`}
                    >
                      &lt;{step.hpBelowPercent}%
                    </span>
                  )}
                </div>
              );
            })}

            {/* Add Step '+' button («Добавить умение в ротацию») */}
            <button
              onClick={() => handleAddStepToChain(currentChain.id)}
              title={t.addStep}
              className={`w-[44px] h-[44px] sm:w-[48px] sm:h-[48px] md:w-[52px] md:h-[52px] rounded-lg border border-dashed transition flex items-center justify-center cursor-pointer shrink-0 group ${
                isDark
                  ? 'border-zinc-800 hover:border-zinc-400 hover:text-white hover:bg-[#14141c] hover:shadow-[0_0_16px_rgba(255,255,255,0.3)] text-zinc-500'
                  : 'border-zinc-300 hover:border-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 text-zinc-400'
              }`}
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* Step Settings Modal: «Умение» */}
      {editingStep && editingStepData && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150 ${
            isDark ? 'bg-black/85' : 'bg-black/45'
          }`}
          onClick={() => {
            setEditingStep(null);
            setIsModalKeyCapturing(false);
          }}
        >
          <div
            className={`w-full max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-3xl rounded-2xl p-3 sm:p-4 md:p-5 flex flex-col gap-2.5 sm:gap-3.5 select-none animate-in zoom-in-95 duration-150 border max-h-[94vh] overflow-y-auto ${
              isDark
                ? 'bg-[#090a10] border-zinc-700/80 text-zinc-200 shadow-[0_24px_60px_rgba(0,0,0,0.95),0_0_30px_rgba(255,255,255,0.06)]'
                : 'bg-white border-zinc-250 text-zinc-800 shadow-[0_20px_50px_rgba(0,0,0,0.15)]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header: Умение #{index} */}
            <div className={`flex items-center justify-between border-b pb-2 ${isDark ? 'border-zinc-800/80' : 'border-zinc-200'}`}>
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 rounded-full shrink-0 ${isDark ? 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]' : 'bg-blue-600'}`}></span>
                <span className={`font-semibold text-xs sm:text-[13px] tracking-wide truncate ${isDark ? 'text-white' : 'text-zinc-900'}`}>
                  {t.stepEditorTitle} #{editingStepIndex + 1}
                </span>
                <span className={`text-[10px] hidden sm:inline ${isDark ? 'text-cyan-400/80 font-mono' : 'text-zinc-400'}`}>
                  • {t.stepEditorSubtitle}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setEditingStep(null)}
                className={`p-1 rounded-lg transition text-xs cursor-pointer shrink-0 leading-none ${
                  isDark ? 'text-zinc-400 hover:text-cyan-300 hover:bg-[#0c1626]' : 'text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100'
                }`}
                title={`${t.cancelBtn} (Esc)`}
              >
                ✕
              </button>
            </div>

            {/* Proportional 2-Row x 2-Column Balanced Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-stretch">
              {/* CELL 1 (Row 1, Col 1): 1. Клавиша на панели */}
              <div className={`flex flex-col justify-between gap-2 p-2.5 rounded-xl border transition-all h-full ${
                isDark ? 'bg-[#06070a]/90 border-zinc-800/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]' : 'bg-zinc-50 border-zinc-200 shadow-xs'
              }`}>
                {/* Header: Label + Status */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full ${draftStep.key ? (isDark ? 'bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]' : 'bg-blue-600') : 'bg-zinc-500'}`} />
                    <span className={`text-[10px] font-semibold truncate ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                      {t.stepKeyLabel}
                    </span>
                  </div>
                  <span className={`text-[8.5px] font-mono px-1.5 py-0.2 rounded border truncate ${
                    draftStep.key
                      ? isDark
                        ? 'text-cyan-300 bg-[#0c1626] border-cyan-400/80 shadow-[0_0_6px_rgba(6,182,212,0.3)] font-bold'
                        : 'text-blue-700 bg-blue-50 border-blue-300 font-bold'
                      : isDark
                      ? 'text-zinc-500 bg-zinc-900 border-zinc-800'
                      : 'text-zinc-400 bg-zinc-100 border-zinc-300'
                  }`}>
                    {draftStep.key ? `[${draftStep.key}]` : t.notAssigned}
                  </span>
                </div>

                {/* Key Capture Button */}
                <div className="flex items-center gap-2 py-1">
                  <button
                    type="button"
                    tabIndex={0}
                    onClick={() => setIsModalKeyCapturing(true)}
                    onBlur={() => setIsModalKeyCapturing(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        setIsModalKeyCapturing(false);
                        e.currentTarget.blur();
                        return;
                      }
                      const captured = getPhysicalKeyFromEvent(e);
                      if (captured !== null) {
                        e.preventDefault();
                        e.stopPropagation();
                        setDraftStep(prev => ({ ...prev, key: captured }));
                        setIsModalKeyCapturing(false);
                        e.currentTarget.blur();
                      }
                    }}
                    className={`flex-1 h-9 px-3 rounded-lg font-mono font-black text-sm uppercase flex items-center justify-center gap-1.5 border transition-all cursor-pointer select-none caret-transparent outline-none ${
                      isModalKeyCapturing
                        ? 'bg-[#0c1626] text-cyan-200 border-cyan-400 ring-2 ring-cyan-500/50 shadow-[0_0_16px_rgba(6,182,212,0.7)] animate-pulse'
                        : draftStep.key
                        ? isDark
                          ? 'bg-[#0c1626] text-cyan-300 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.35)] hover:border-cyan-300 hover:bg-[#0f1f33]'
                          : 'bg-white text-blue-600 border-blue-400 shadow-xs hover:bg-blue-50'
                        : isDark
                        ? 'bg-[#070b12] text-zinc-400 border-cyan-950/80 hover:border-cyan-800 hover:text-cyan-200'
                        : 'bg-zinc-100 text-zinc-500 border-zinc-300 hover:border-zinc-400'
                    }`}
                    title={t.stepHoverHint}
                  >
                    {isModalKeyCapturing ? (
                      <span className="text-xs text-cyan-300 font-bold animate-pulse font-sans tracking-wide">⚡ {t.pressPrompt}</span>
                    ) : draftStep.key ? (
                      <span className="tracking-widest">[{draftStep.key}]</span>
                    ) : (
                      <span className="text-[11px] font-normal tracking-wide font-sans">{language === 'ru' ? '+ Назначить клавишу' : '+ Assign Key'}</span>
                    )}
                  </button>

                  {draftStep.key && (
                    <button
                      type="button"
                      onClick={() => setDraftStep(prev => ({ ...prev, key: '' }))}
                      className={`w-9 h-9 rounded-lg text-xs flex items-center justify-center transition cursor-pointer border shrink-0 ${
                        isDark
                          ? 'bg-[#070b12] border-cyan-950/80 hover:border-cyan-400 text-zinc-400 hover:text-cyan-200 hover:shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                          : 'bg-zinc-200 hover:bg-zinc-300 text-zinc-600 hover:text-zinc-900 border-transparent'
                      }`}
                      title={t.clearKeyTitle}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Subtext Hint */}
                <div className="flex items-center justify-between text-[8.5px] text-zinc-500 truncate pt-0.5 border-t border-zinc-800/40">
                  <span className="truncate">{isModalKeyCapturing ? t.stepKeyHintActive : t.stepKeyHintIdle}</span>
                </div>
              </div>

              {/* CELL 2 (Row 1, Col 2): 2. Когда жать + Когда ХП меньше */}
              <div className={`flex flex-col justify-between gap-2 p-2.5 rounded-xl border transition-all h-full ${
                draftStep.independent
                  ? isDark
                    ? 'bg-[#070b12] border-cyan-900/60 shadow-[inset_0_0_12px_rgba(6,182,212,0.06)]'
                    : 'bg-blue-50/40 border-blue-300'
                  : isDark
                  ? 'bg-[#06070a]/90 border-zinc-800/80'
                  : 'bg-zinc-50 border-zinc-200'
              }`}>
                {/* Header: Label + Active mode badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full ${draftStep.independent ? (isDark ? 'bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.8)]' : 'bg-blue-600') : 'bg-zinc-500'}`} />
                    <label className={`text-[10px] font-semibold truncate ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>
                      {t.whenToPressLabel}
                    </label>
                  </div>
                  <span className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded border truncate ${
                    draftStep.independent
                      ? 'text-cyan-300 bg-[#0c1626] border-cyan-400/80 shadow-[0_0_6px_rgba(6,182,212,0.3)]'
                      : isDark
                      ? 'text-zinc-400 bg-zinc-900 border-zinc-800'
                      : 'text-zinc-600 bg-zinc-200 border-zinc-300'
                  }`}>
                    {draftStep.independent ? t.whenAsap : t.whenInSequence}
                  </span>
                </div>

                {/* Mode Switch: «По очереди» / «⚡ Как только готово» */}
                <div className={`grid grid-cols-2 gap-1 p-0.5 rounded-lg border ${
                  isDark ? 'bg-[#070b12] border-cyan-900/60 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]' : 'bg-zinc-200/70 border-zinc-300'
                }`}>
                  <button
                    type="button"
                    onClick={() => setDraftStep(prev => ({ ...prev, independent: false }))}
                    className={`py-1 px-1.5 rounded-md text-[10px] font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                      !draftStep.independent
                        ? isDark
                          ? 'bg-[#0c1626] text-cyan-300 border border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.35)] font-bold'
                          : 'bg-white text-blue-600 border border-blue-400 shadow-xs font-bold'
                        : isDark ? 'text-zinc-400 hover:text-cyan-200 border border-transparent' : 'text-zinc-600 hover:text-zinc-900 border border-transparent'
                    }`}
                  >
                    <span>{t.whenInSequence}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDraftStep(prev => ({ ...prev, independent: true }))}
                    className={`py-1 px-1.5 rounded-md text-[10px] font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                      draftStep.independent
                        ? isDark
                          ? 'bg-[#0c1626] text-cyan-300 border border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.45)] font-bold'
                          : 'bg-blue-600 text-white border border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.45)]'
                        : isDark ? 'text-zinc-400 hover:text-cyan-200 border border-transparent' : 'text-zinc-600 hover:text-blue-600 border border-transparent'
                    }`}
                  >
                    <span>⚡ {t.whenAsap}</span>
                  </button>
                </div>

                {/* HP Condition: «Когда ХП меньше: [  ] %» */}
                <div className="flex flex-col gap-1 pt-1 border-t border-zinc-800/40">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className={`text-[9.5px] font-medium flex items-center gap-1 truncate ${
                      isDark ? 'text-zinc-300' : 'text-zinc-700'
                    }`}>
                      <span className="text-rose-400 text-[10px]">❤️</span>
                      <span>{t.hpBelowLabel}</span>
                    </span>

                    <div className="flex items-center shrink-0">
                      <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded border transition-colors ${
                        isDark ? 'bg-[#070b12] border-cyan-900/60 focus-within:border-cyan-400 focus-within:shadow-[0_0_8px_rgba(6,182,212,0.35)]' : 'bg-white border-zinc-300'
                      }`}>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={hpInputStr}
                          placeholder={t.hpBelowPlaceholder}
                          onChange={(e) => {
                            let raw = e.target.value.replace(/[^0-9]/g, '');
                            if (raw === '') {
                              setHpInputStr('');
                              setDraftStep(prev => ({ ...prev, hpBelowPercent: null }));
                              return;
                            }
                            const num = parseInt(raw, 10);
                            const clamped = Math.min(100, Math.max(0, num));
                            setHpInputStr(String(clamped));
                            setDraftStep(prev => ({ ...prev, hpBelowPercent: clamped }));
                          }}
                          className={`w-9 bg-transparent text-center font-mono font-bold text-[10.5px] outline-none ${
                            draftStep.hpBelowPercent != null ? 'text-cyan-300 font-black' : isDark ? 'text-zinc-400' : 'text-zinc-600'
                          }`}
                          title={t.hpBelowHint}
                        />
                        <span className={`text-[8.5px] font-mono ${isDark ? 'text-cyan-400/70' : 'text-zinc-400'}`}>%</span>
                      </div>
                    </div>
                  </div>

                  {/* HP Presets */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setHpInputStr('');
                        setDraftStep(prev => ({ ...prev, hpBelowPercent: null }));
                      }}
                      className={`flex-1 h-5 rounded text-[8px] font-mono font-semibold transition cursor-pointer border flex items-center justify-center ${
                        draftStep.hpBelowPercent == null
                          ? isDark
                            ? 'bg-[#0c1626] text-cyan-300 border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.35)] font-bold'
                            : 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : isDark
                          ? 'bg-[#070b12] text-zinc-400 border-zinc-800 hover:text-cyan-200 hover:border-cyan-900/60'
                          : 'bg-zinc-200/80 text-zinc-600 border-zinc-300 hover:text-zinc-900'
                      }`}
                    >
                      {t.hpBelowAny}
                    </button>
                    {[20, 25, 35, 50].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => {
                          setHpInputStr(String(pct));
                          setDraftStep(prev => ({ ...prev, hpBelowPercent: pct }));
                        }}
                        className={`flex-1 h-5 rounded text-[8.5px] font-mono font-bold transition cursor-pointer border flex items-center justify-center ${
                          draftStep.hpBelowPercent === pct
                            ? isDark
                              ? 'bg-[#0c1626] text-cyan-300 border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.35)]'
                              : 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : isDark
                            ? 'bg-[#070b12] text-zinc-400 border-zinc-800 hover:text-cyan-200 hover:border-cyan-900/60'
                            : 'bg-zinc-200/80 text-zinc-600 border-zinc-300 hover:text-zinc-900'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* CELL 3 (Row 2, Col 1): 3. Время каста и Нажатий подряд */}
              <div className={`p-2.5 rounded-xl border flex flex-col justify-between gap-2 h-full ${
                isDark ? 'bg-[#06070a]/90 border-zinc-800/80' : 'bg-zinc-50 border-zinc-200'
              }`}>
                <div className="grid grid-cols-2 gap-2 h-full">
                  {/* Время каста */}
                  <div className="flex flex-col justify-between gap-1">
                    <div className="flex items-center justify-between">
                      <label className={`text-[9.5px] font-semibold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{t.castLabel}</label>
                      <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded border transition-colors ${
                        isDark ? 'bg-[#070b12] border-cyan-900/60 focus-within:border-cyan-400 focus-within:shadow-[0_0_8px_rgba(6,182,212,0.35)]' : 'bg-white border-zinc-300'
                      }`}>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={castInputStr}
                          onChange={(e) => {
                            let raw = e.target.value;
                            if (raw === '') {
                              setCastInputStr('');
                              setDraftStep(prev => ({ ...prev, castTimeSeconds: 0 }));
                              return;
                            }
                            raw = raw.replace(/[^0-9.,]/g, '');
                            const parts = raw.split(/[.,]/);
                            if (parts.length > 2) {
                              const sep = raw.includes(',') ? ',' : '.';
                              raw = parts[0] + sep + parts.slice(1).join('');
                            }
                            setCastInputStr(raw);
                            const parsed = parseFloat(raw.replace(',', '.'));
                            if (!isNaN(parsed)) {
                              setDraftStep(prev => ({ ...prev, castTimeSeconds: Math.min(MAX_CAST_SECONDS, Math.max(0, parsed)) }));
                            }
                          }}
                          onBlur={() => {
                            if (castInputStr === '' || castInputStr === '.' || castInputStr === ',') {
                              setCastInputStr('1.5');
                              setDraftStep(prev => ({ ...prev, castTimeSeconds: 1.5 }));
                            } else {
                              const parsed = parseFloat(castInputStr.replace(',', '.'));
                              if (isNaN(parsed)) {
                                setCastInputStr('1.5');
                                setDraftStep(prev => ({ ...prev, castTimeSeconds: 1.5 }));
                              } else {
                                const val = Math.min(MAX_CAST_SECONDS, Math.max(0, parsed));
                                setCastInputStr(String(val));
                                setDraftStep(prev => ({ ...prev, castTimeSeconds: val }));
                              }
                            }
                          }}
                          className={`w-9 bg-transparent text-center font-mono font-bold text-[10.5px] outline-none ${
                            isDark ? 'text-cyan-300' : 'text-zinc-900'
                          }`}
                          placeholder="1.5"
                          title={t.castTitle}
                        />
                        <span className={`text-[8px] font-mono ${isDark ? 'text-cyan-400/70' : 'text-zinc-500'}`}>{t.castSecondsUnit}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 pt-0.5">
                      {[0, 1, 1.5, 2, 2.5, 3].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => {
                            setDraftStep(prev => ({ ...prev, castTimeSeconds: s }));
                            setCastInputStr(String(s));
                          }}
                          className={`flex-1 h-5 rounded text-[8.5px] font-mono font-bold transition cursor-pointer border flex items-center justify-center ${
                            draftStep.castTimeSeconds === s
                              ? isDark
                                ? 'bg-[#0c1626] text-cyan-300 border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.35)]'
                                : 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : isDark
                              ? 'bg-[#070b12] text-zinc-400 border-zinc-800 hover:text-cyan-200 hover:border-cyan-900/60'
                              : 'bg-zinc-200/80 text-zinc-600 border-zinc-300 hover:text-zinc-900 hover:bg-zinc-300/80'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Нажатий подряд */}
                  <div className="flex flex-col justify-between gap-1 pl-2 border-l border-zinc-800/40">
                    <div className="flex items-center justify-between">
                      <label className={`text-[9.5px] font-semibold ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{t.repeatLabel}</label>
                      <span className={`text-[8.5px] font-mono font-bold px-1 py-0.2 rounded border ${
                        isDark ? 'text-cyan-300 bg-[#0c1626] border-cyan-400/80 shadow-[0_0_6px_rgba(6,182,212,0.3)]' : 'text-blue-800 bg-blue-50 border-blue-300'
                      }`}>
                        {draftStep.repeatCount || 1}×
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 pt-0.5">
                      {[1, 2, 3, 4, 5].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => setDraftStep(prev => ({ ...prev, repeatCount: cnt }))}
                          className={`flex-1 h-5 rounded font-mono text-[9px] font-bold transition cursor-pointer flex items-center justify-center border ${
                            (draftStep.repeatCount || 1) === cnt
                              ? isDark
                                ? 'bg-[#0c1626] text-cyan-300 border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.35)]'
                                : 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : isDark
                              ? 'bg-[#070b12] text-zinc-400 hover:text-cyan-200 border-zinc-800 hover:border-cyan-900/60'
                              : 'bg-zinc-200/80 text-zinc-600 hover:text-zinc-900 border-zinc-300 hover:bg-zinc-300/80'
                          }`}
                          title={`${t.repeatTitle}: ${cnt}`}
                        >
                          {cnt}×
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* CELL 4 (Row 2, Col 2): 4. Перезарядка (сек) */}
              <div className={`p-2.5 rounded-xl border flex flex-col justify-between gap-1.5 transition-all h-full ${
                draftStep.independent
                  ? isDark
                    ? 'bg-[#070b12] border-cyan-900/60 shadow-[inset_0_0_12px_rgba(6,182,212,0.08)]'
                    : 'bg-blue-50/50 border-blue-300'
                  : isDark
                  ? 'bg-[#06070a]/90 border-zinc-800/80'
                  : 'bg-zinc-50 border-zinc-200'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <label className={`text-[10px] font-semibold shrink-0 flex items-center gap-1.5 ${
                    isDark ? 'text-zinc-200' : 'text-zinc-800'
                  }`}>
                    <Clock className={`w-3.5 h-3.5 ${draftStep.independent ? 'text-cyan-400' : isDark ? 'text-zinc-400' : 'text-zinc-500'}`} />
                    <span>{t.cooldownLabel}</span>
                  </label>
                  <div className={`flex items-center gap-1 px-2 py-0.5 rounded-md border transition-colors ${
                    isDark ? 'bg-[#070b12] border-cyan-900/60 focus-within:border-cyan-400 focus-within:shadow-[0_0_8px_rgba(6,182,212,0.35)]' : 'bg-white border-zinc-300'
                  }`}>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={cdInputStr}
                      onChange={(e) => {
                        let raw = e.target.value;
                        if (raw === '') {
                          setCdInputStr('');
                          setDraftStep(prev => ({ ...prev, skillCooldownSeconds: 0 }));
                          return;
                        }
                        raw = raw.replace(/[^0-9.,]/g, '');
                        const parts = raw.split(/[.,]/);
                        if (parts.length > 2) {
                          const sep = raw.includes(',') ? ',' : '.';
                          raw = parts[0] + sep + parts.slice(1).join('');
                        }
                        setCdInputStr(raw);
                        const parsed = parseFloat(raw.replace(',', '.'));
                        if (!isNaN(parsed)) {
                          setDraftStep(prev => ({ ...prev, skillCooldownSeconds: Math.min(300, Math.max(0, parsed)) }));
                        }
                      }}
                      onBlur={() => {
                        if (cdInputStr === '' || cdInputStr === '.' || cdInputStr === ',') {
                          setCdInputStr('0');
                          setDraftStep(prev => ({ ...prev, skillCooldownSeconds: 0 }));
                        } else {
                          const parsed = parseFloat(cdInputStr.replace(',', '.'));
                          if (isNaN(parsed)) {
                            setCdInputStr('0');
                            setDraftStep(prev => ({ ...prev, skillCooldownSeconds: 0 }));
                          } else {
                            const val = Math.min(300, Math.max(0, parsed));
                            setCdInputStr(String(val));
                            setDraftStep(prev => ({ ...prev, skillCooldownSeconds: val }));
                          }
                        }
                      }}
                      className={`w-11 bg-transparent text-center font-mono font-bold text-[10.5px] outline-none ${
                        draftStep.independent ? 'text-cyan-300 font-black' : isDark ? 'text-zinc-100' : 'text-zinc-900'
                      }`}
                      placeholder="0"
                    />
                    <span className={`text-[9px] font-mono ${isDark ? 'text-cyan-400/70' : 'text-zinc-400'}`}>{t.castSecondsUnit}</span>
                  </div>
                </div>

                {/* Preset buttons */}
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  <span className="text-[8px] text-zinc-500">Preset:</span>
                  {[0, 3, 6, 8, 12, 15, 20, 24, 30].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => {
                        setDraftStep(prev => ({ ...prev, skillCooldownSeconds: sec }));
                        setCdInputStr(String(sec));
                      }}
                      className={`px-1.5 py-0.2 rounded text-[8.5px] font-mono font-bold transition cursor-pointer border ${
                        draftStep.skillCooldownSeconds === sec
                          ? isDark
                            ? 'bg-[#0c1626] text-cyan-300 border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.35)]'
                            : 'bg-blue-600 text-white border-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.4)]'
                          : isDark
                          ? 'bg-[#070b12] text-zinc-400 border-zinc-800 hover:text-cyan-200 hover:border-cyan-900/60'
                          : 'bg-zinc-200/80 text-zinc-600 border-zinc-300 hover:text-zinc-900 hover:bg-zinc-300/80'
                      }`}
                    >
                      {sec}{t.castSecondsUnit}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className={`flex items-center justify-between pt-2 border-t mt-0.5 ${isDark ? 'border-zinc-800/80' : 'border-zinc-200'}`}>
              <div className="text-[9.5px] text-zinc-400 hidden sm:flex items-center gap-1.5">
                <span className="text-zinc-500">💡</span>
                <span>{language === 'ru' ? 'Нажмите любую клавишу — старая сразу заменится без стирания' : 'Press any key — binds instantly without backspace'}</span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setEditingStep(null)}
                  className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg text-[11px] font-medium border transition cursor-pointer ${
                    isDark
                      ? 'bg-[#070b12] hover:bg-[#0c1626] text-zinc-400 hover:text-cyan-200 border-cyan-900/60 hover:border-cyan-400 hover:shadow-[0_0_8px_rgba(6,182,212,0.25)]'
                      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-900 border-zinc-300'
                  }`}
                >
                  {t.cancelBtn}
                </button>
                <button
                  type="button"
                  onClick={handleSaveStep}
                  className={`flex-1 sm:flex-initial py-1.5 px-4 rounded-lg text-[11px] font-semibold border transition cursor-pointer select-none active:scale-95 ${
                    isDark
                      ? 'bg-[#0c1626] hover:bg-[#0f1f33] text-cyan-300 hover:text-cyan-100 border-cyan-400 hover:border-cyan-300 shadow-[0_0_14px_rgba(6,182,212,0.4)] font-bold'
                      : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-600 shadow-sm'
                  }`}
                >
                  {t.saveBtn}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
