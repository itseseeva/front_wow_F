import React, { useState, useRef, useEffect } from 'react';
import { ComboChain, ChainStep } from '../data/skillsLibrary';
import { Plus, Clock, RotateCcw, Pencil } from 'lucide-react';
import { CaptureProgressToast, CaptureProgressState } from './CaptureProgressToast';
import { CaptureSkillsModal } from './CaptureSkillsModal';
import { CaptureSkillsResponse, CaptureSkillsSlot } from '../types';
import { soundManager } from '../utils/sound';
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

// Extract clean physical game key name from KeyboardEvent (no text caret, no layout mismatch)
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

// Mock generators for preview mode or initial state
const createMockSkillIcon = (hue: number, label: string): string => {
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 48;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const grad = ctx.createLinearGradient(0, 0, 48, 48);
  grad.addColorStop(0, `hsl(${hue}, 70%, 45%)`);
  grad.addColorStop(1, `hsl(${(hue + 40) % 360}, 80%, 25%)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 48, 48);
  ctx.strokeStyle = `hsl(${hue}, 90%, 65%)`;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 46, 46);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 24, 24);
  return canvas.toDataURL('image/png');
};

const createMockSkillSlots = (): CaptureSkillsSlot[] => {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='];
  return keys.map((key, idx) => {
    const isIssue = key === '5' || key === '0';
    return {
      key,
      row: 'bottom',
      brightness: isIssue ? 48 : 115 + (idx * 3) % 25,
      ok: !isIssue,
      status: isIssue ? 'тёмный: пустой или откат?' : 'ok',
      icon_png: createMockSkillIcon((idx * 30 + 190) % 360, key),
    };
  });
};

export const ComboSequence: React.FC<Props> = ({
  chains,
  onChainsChange,
  activeCasting = null,
  isBotRunning = false,
  onToast,
  onError,
  language = 'ru',
  theme = 'dark',
}) => {
  const t = translations[language];
  const isDark = theme === 'dark';
  // Capture Skills state
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureProgress, setCaptureProgress] = useState<CaptureProgressState | null>(null);
  const [isCaptureModalOpen, setIsCaptureModalOpen] = useState(false);
  const [captureResult, setCaptureResult] = useState<CaptureSkillsResponse | null>(null);
  const captureToastTimeoutRef = useRef<any>(null);

  // Open skills modal handler
  const handleOpenSkillsModal = () => {
    if (!captureResult) {
      setCaptureResult({
        ok: true,
        message: 'Снимки сохранены',
        slots: createMockSkillSlots(),
      });
    }
    setIsCaptureModalOpen(true);
  };

  // Listen to easyfarm:capture-progress from backend
  useEffect(() => {
    const handleCaptureProgressEvent = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      const stage = detail.stage as 'minimize' | 'capture' | 'save';
      const secondsLeft = typeof detail.seconds_left === 'number' ? detail.seconds_left : 0;
      
      if (captureToastTimeoutRef.current) {
        clearTimeout(captureToastTimeoutRef.current);
        captureToastTimeoutRef.current = null;
      }

      setCaptureProgress({
        stage,
        secondsLeft,
      });
    };

    window.addEventListener('easyfarm:capture-progress', handleCaptureProgressEvent as EventListener);
    return () => {
      window.removeEventListener('easyfarm:capture-progress', handleCaptureProgressEvent as EventListener);
      if (captureToastTimeoutRef.current) {
        clearTimeout(captureToastTimeoutRef.current);
      }
    };
  }, []);

  const [isCaptureSuccess, setIsCaptureSuccess] = useState(false);

  // Active step being configured in modal
  const [editingStep, setEditingStep] = useState<{ chainId: string; stepId: string } | null>(null);

  // Active step key listening on the combo bar tile (no text caret, instant key press)
  const [activeCapturingStepId, setActiveCapturingStepId] = useState<string | null>(null);

  // Active key listening in the step editor modal (no text caret, instant key press)
  const [isModalKeyCapturing, setIsModalKeyCapturing] = useState<boolean>(false);

  // Draft step state for modal editing
  const [draftStep, setDraftStep] = useState<{
    key: string;
    actionType: string;
    castTimeSeconds: number;
    repeatCount: number;
    independent: boolean;
    skillCooldownSeconds: number;
  }>({
    key: '',
    actionType: 'press',
    castTimeSeconds: 0,
    repeatCount: 1,
    independent: false,
    skillCooldownSeconds: 0,
  });

  // String buffer states for smooth decimal, comma and zero-erasing inputs
  const [castInputStr, setCastInputStr] = useState<string>('0');
  const [cdInputStr, setCdInputStr] = useState<string>('0');

  // Reference the active rotation chain (single sequence)
  const currentChain = chains[0] || {
    id: 'chain_1',
    name: 'Ротация скиллов',
    order: 1,
    cooldown: 0,
    triggerAfterChainId: 'always',
    steps: []
  };

  // Add a step to chain
  const handleAddStepToChain = (chainId: string) => {
    const updated = chains.map(c => {
      if (c.id === chainId) {
        const nextIdx = c.steps.length + 1;
        const newStep: ChainStep = {
          id: `step_${Date.now()}_${nextIdx}`,
          key: '',
          cooldown: 8.0,
          castTimeSeconds: 0,
          repeatCount: 1,
        };
        return { ...c, steps: [...c.steps, newStep] };
      }
      return c;
    });
    onChainsChange(updated);
  };

  // Delete a step from chain
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
          return { ...s, key: newKey.toUpperCase() };
        })
      };
    });
    onChainsChange(updated);
  };

  // Update step arbitrary fields (independent, skillCooldownSeconds, etc.)
  const handleUpdateStep = (chainId: string, stepId: string, updates: Partial<ChainStep>) => {
    const updated = chains.map(c => {
      if (c.id !== chainId) return c;
      return {
        ...c,
        steps: c.steps.map(s => (s.id === stepId ? { ...s, ...updates } : s))
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
          steps: c.steps.map(s => ({ ...s, key: '', castTimeSeconds: 0, repeatCount: 1 }))
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
        : (typeof editingStepData.cooldown === 'number' ? editingStepData.cooldown : 0);
      const cast = editingStepData.castTimeSeconds ?? 0;
      setDraftStep({
        key: editingStepData.key || '',
        actionType: editingStepData.actionType || 'press',
        castTimeSeconds: cast,
        repeatCount: editingStepData.repeatCount ?? 1,
        independent: Boolean(editingStepData.independent),
        skillCooldownSeconds: cd,
      });
      setCastInputStr(String(cast));
      setCdInputStr(String(cd));
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
    const finalCast = !isNaN(parsedCast) ? Math.min(MAX_CAST_SECONDS, Math.max(0, parsedCast)) : (draftStep.castTimeSeconds ?? 0);
    const parsedCd = parseFloat(cdInputStr.replace(',', '.'));
    const finalCd = !isNaN(parsedCd) ? Math.min(300, Math.max(0, parsedCd)) : (draftStep.skillCooldownSeconds ?? 0);
    const cd = Math.max(0, finalCd);

    handleUpdateStep(editingStep.chainId, editingStep.stepId, {
      key: draftStep.key.toUpperCase(),
      actionType: draftStep.actionType,
      castTimeSeconds: finalCast,
      repeatCount: Math.min(10, Math.max(1, draftStep.repeatCount ?? 1)),
      independent: draftStep.independent,
      skillCooldownSeconds: cd,
      cooldown: cd,
    });
    setEditingStep(null);
  };

  // Capture skills snapshot action with animation, sound, and notification
  const handleCaptureSkills = async () => {
    if (isBotRunning || isCapturing) return;
    setIsCapturing(true);
    setIsCaptureSuccess(false);

    // Initial toast: "Переключитесь на игру и ждите"
    setCaptureProgress({
      stage: 'prompt_switch',
      secondsLeft: 6,
      message: 'Переключитесь на игру и ждите — съёмка начнётся автоматически',
    });

    try {
      if (typeof window !== 'undefined' && window.pywebview?.api?.capture_skills) {
        const rawRes = await window.pywebview.api.capture_skills();
        let res: any = rawRes;
        if (typeof rawRes === 'string') {
          try {
            res = JSON.parse(rawRes);
          } catch (e) {
            console.warn('capture_skills: JSON parse failed', e);
          }
        }

        // Defensive normalization of response object
        if (!res || typeof res !== 'object') {
          res = { ok: false, message: 'Не удалось распознать ответ съемки скиллов' };
        }

        // Normalize slots array (safeguard keys as string, boolean ok, etc.)
        if (Array.isArray(res.slots)) {
          res.slots = res.slots.map((s: any) => ({
            key: s?.key != null ? String(s.key) : '',
            row: s?.row || 'bottom',
            icon_png: s?.icon_png || '',
            brightness: typeof s?.brightness === 'number' ? s.brightness : 100,
            ok: Boolean(s?.ok),
            status: s?.status || (s?.ok ? 'ok' : 'проверь'),
          }));
        } else {
          res.slots = [];
        }

        setCaptureResult(res);

        // Force viewport repaint in pywebview/WebView2 upon window restore to eliminate black screen
        if (typeof window !== 'undefined') {
          requestAnimationFrame(() => {
            window.dispatchEvent(new Event('resize'));
          });
          setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
          }, 80);
        }

        // Filter out Q and C if any, and check if all remaining skills are ready/ok
        const skillSlots = res.slots.filter((s: any) => {
          const k = String(s.key || '').toLowerCase();
          return k !== 'q' && k !== 'c';
        });

        const allSkillsOk = res.ok && skillSlots.length > 0 && skillSlots.every((s: any) => Boolean(s.ok));

        if (allSkillsOk) {
          setIsCaptureSuccess(true);
          soundManager.playSkillsReady();
          setCaptureProgress({
            stage: 'done',
            secondsLeft: 0,
            message: 'Скиллы готовы! Все снимки успешно сохранены',
          });
          setTimeout(() => setIsCaptureSuccess(false), 5000);
        } else {
          setIsCaptureSuccess(false);
          soundManager.playSkillsError();
          const badCount = skillSlots.filter((s: any) => !s.ok).length;
          setCaptureProgress({
            stage: 'error',
            secondsLeft: 0,
            message: badCount > 0
              ? `${badCount} ${badCount === 1 ? 'скилл не готов' : 'скилла не готовы'} (откат или темно) — попробуйте ещё раз`
              : (res.message || 'Скиллы не готовы — попробуйте ещё раз'),
          });
        }

        // Keep toast visible for 4 seconds after completion
        if (captureToastTimeoutRef.current) clearTimeout(captureToastTimeoutRef.current);
        captureToastTimeoutRef.current = setTimeout(() => {
          setCaptureProgress(null);
        }, 4000);
      } else {
        // Preview mode simulated progression
        // 1. prompt switch (1s)
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setCaptureProgress({ stage: 'minimize', secondsLeft: 6 });
        // 2. minimize countdown
        await new Promise((resolve) => setTimeout(resolve, 800));
        setCaptureProgress({ stage: 'capture', secondsLeft: 4 });
        await new Promise((resolve) => setTimeout(resolve, 600));
        setCaptureProgress({ stage: 'capture', secondsLeft: 2 });
        await new Promise((resolve) => setTimeout(resolve, 600));
        setCaptureProgress({ stage: 'save', secondsLeft: 0 });
        await new Promise((resolve) => setTimeout(resolve, 500));

        // In preview mode: demonstrate success with sound!
        const previewSlots = createMockSkillSlots();
        setCaptureResult({
          ok: true,
          message: 'Снимки сохранены',
          slots: previewSlots,
        });
        setIsCaptureSuccess(true);
        soundManager.playSkillsReady();

        setCaptureProgress({
          stage: 'done',
          secondsLeft: 0,
          message: 'Скиллы готовы! Все снимки успешно сохранены',
        });

        setTimeout(() => setIsCaptureSuccess(false), 5000);

        if (captureToastTimeoutRef.current) clearTimeout(captureToastTimeoutRef.current);
        captureToastTimeoutRef.current = setTimeout(() => {
          setCaptureProgress(null);
        }, 4000);
      }
    } catch (err: any) {
      soundManager.playSkillsError();
      setIsCaptureSuccess(false);
      setCaptureProgress({
        stage: 'error',
        secondsLeft: 0,
        message: err?.message || 'Ошибка съемки — попробуйте ещё раз',
      });
      if (captureToastTimeoutRef.current) clearTimeout(captureToastTimeoutRef.current);
      captureToastTimeoutRef.current = setTimeout(() => {
        setCaptureProgress(null);
      }, 4000);
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className="w-full max-w-[480px] mx-auto flex flex-col gap-2 relative select-none">
      <div className={`w-full rounded-xl p-3 flex flex-col gap-2 relative transition-all duration-200 border ${
        isDark
          ? 'bg-[#08080c] border-zinc-800/90 shadow-[0_6px_25px_rgba(0,0,0,0.95)]'
          : 'bg-white border-zinc-200 shadow-[0_4px_20px_rgba(0,0,0,0.06)] text-zinc-800'
      }`}>
        {/* Header */}
        <div className={`flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-xs ${
          isDark ? 'border-zinc-800/80 text-zinc-200' : 'border-zinc-200 text-zinc-800'
        }`}>
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-zinc-200 shadow-[0_0_8px_rgba(255,255,255,0.85)]' : 'bg-zinc-800'}`} />
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

        {/* Chain Steps Squares - Small & Compact Keycaps */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 w-full pt-1 relative min-h-[46px]">
          <div className="flex flex-wrap items-center gap-1.5 max-w-full">
            {currentChain.steps.map((step, idx) => {
              const isCasting = activeCasting?.chainId === currentChain.id && activeCasting?.stepId === step.id;
              const isIndependent = Boolean(step.independent);
              const skillCd = typeof step.skillCooldownSeconds === 'number'
                ? step.skillCooldownSeconds
                : (typeof step.cooldown === 'number' && step.independent ? step.cooldown : 0);
              const hasCd = skillCd > 0;

              return (
                <React.Fragment key={step.id}>
                  {(() => {
                    const isCurrentlyEditing = editingStep?.stepId === step.id;
                    return (
                      <div
                        onClick={() => setEditingStep({ chainId: currentChain.id, stepId: step.id })}
                        className={`w-[46px] h-[46px] rounded-lg p-0.5 relative flex flex-col items-center justify-center select-none group transition-all duration-200 shrink-0 cursor-pointer ${
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

                        {/* Delete Step button in top-right (on hover) */}
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

                        {/* Step Edit Button (Карандаш редактирования шага - чёрно-синий стиль) */}
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

                    {/* Repeat Count Badge - Bottom Right Corner */}
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
                  </div>
                );
              })()}
            </React.Fragment>
              );
            })}

            {/* Add Step '+' button */}
            <button
              onClick={() => handleAddStepToChain(currentChain.id)}
              title={t.addStep}
              className={`w-[46px] h-[46px] rounded-lg border border-dashed transition flex items-center justify-center cursor-pointer shrink-0 group ${
                isDark
                  ? 'border-zinc-800 hover:border-zinc-400 hover:text-white hover:bg-[#14141c] hover:shadow-[0_0_16px_rgba(255,255,255,0.3)] text-zinc-500'
                  : 'border-zinc-300 hover:border-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 text-zinc-400'
              }`}
            >
              <Plus className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* Step Settings Modal: Horizontal & Ergonomic «Редактор шага» */}
      {editingStep && editingStepData && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150 ${
            isDark ? 'bg-black/85' : 'bg-black/45'
          }`}
          onClick={() => {
            setEditingStep(null);
            setIsModalKeyCapturing(false);
          }}
        >
          <div
            className={`w-full max-w-[560px] sm:max-w-[620px] rounded-2xl p-3 sm:p-3.5 flex flex-col gap-2.5 select-none animate-in zoom-in-95 duration-150 border ${
              isDark
                ? 'bg-[#090a10] border-zinc-700/80 text-zinc-200 shadow-[0_24px_60px_rgba(0,0,0,0.95),0_0_30px_rgba(255,255,255,0.06)]'
                : 'bg-white border-zinc-250 text-zinc-800 shadow-[0_20px_50px_rgba(0,0,0,0.15)]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header (Horizontal) */}
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

            {/* Horizontal 2-Column Content Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* LEFT COLUMN: Клавиша, Действие, Каст, Повторы */}
              <div className="flex flex-col gap-2">
                {/* 1. Клавиша скилла */}
                <div className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border ${
                  isDark ? 'bg-[#06070a]/90 border-zinc-800/80' : 'bg-zinc-50 border-zinc-200'
                }`}>
                  <div className="flex flex-col min-w-0">
                    <span className={`text-[10px] font-semibold ${isDark ? 'text-zinc-200' : 'text-zinc-800'}`}>{t.stepKeyLabel}</span>
                    <span className="text-[8.5px] text-zinc-500 truncate">
                      {isModalKeyCapturing ? t.stepKeyHintActive : t.stepKeyHintIdle}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
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
                      className={`min-w-[64px] h-7 px-2.5 rounded-lg font-mono font-black text-xs uppercase flex items-center justify-center gap-1 border transition cursor-pointer select-none caret-transparent outline-none ${
                        isModalKeyCapturing
                          ? 'bg-[#0c1626] text-cyan-200 border-cyan-400 ring-2 ring-cyan-500/50 shadow-[0_0_14px_rgba(6,182,212,0.6)] animate-pulse'
                          : draftStep.key
                          ? isDark
                            ? 'bg-[#0c1626] text-cyan-300 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.35)] hover:border-cyan-300 hover:bg-[#0f1f33]'
                            : 'bg-white text-blue-600 border-blue-400 shadow-xs hover:bg-blue-50'
                          : isDark
                          ? 'bg-[#070b12] text-zinc-500 border-cyan-950/80 hover:border-cyan-800 hover:text-cyan-200'
                          : 'bg-zinc-100 text-zinc-400 border-zinc-300 hover:border-zinc-400'
                      }`}
                      title={t.stepHoverHint}
                    >
                      {isModalKeyCapturing ? (
                        <span className="text-[10px] text-cyan-300 font-bold animate-pulse font-sans">{t.pressPrompt}</span>
                      ) : draftStep.key ? (
                        <span className="tracking-wider">[{draftStep.key}]</span>
                      ) : (
                        <span className={isDark ? 'text-zinc-500 font-normal' : 'text-zinc-400 font-normal'}>[ + ]</span>
                      )}
                    </button>
                    {draftStep.key && (
                      <button
                        type="button"
                        onClick={() => setDraftStep(prev => ({ ...prev, key: '' }))}
                        className={`w-5 h-5 rounded-md text-[10px] flex items-center justify-center transition cursor-pointer border ${
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
                </div>

                {/* 2. Тип действия */}
                <div className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl border ${
                  isDark ? 'bg-[#06070a]/90 border-zinc-800/80' : 'bg-zinc-50 border-zinc-200'
                }`}>
                  <div className="flex flex-col">
                    <label className={`text-[10px] font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{t.actionTypeLabel}</label>
                    <span className="text-[8.5px] text-zinc-500">{t.actionTypeHint}</span>
                  </div>
                  <div className={`grid grid-cols-2 gap-1 p-0.5 rounded-lg border ${
                    isDark ? 'bg-[#070b12] border-cyan-900/60 shadow-[inset_0_1px_3px_rgba(0,0,0,0.8)]' : 'bg-zinc-200/70 border-zinc-300'
                  }`}>
                    <button
                      type="button"
                      onClick={() => setDraftStep(prev => ({ ...prev, actionType: 'press' }))}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition cursor-pointer ${
                        draftStep.actionType === 'press'
                          ? isDark
                            ? 'bg-[#0c1626] text-cyan-300 border border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.35)] font-bold'
                            : 'bg-white text-blue-600 border border-blue-400 shadow-xs font-bold'
                          : isDark ? 'text-zinc-400 hover:text-cyan-200 border border-transparent' : 'text-zinc-600 hover:text-zinc-900 border border-transparent'
                      }`}
                    >
                      {t.actionPress}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraftStep(prev => ({ ...prev, actionType: 'hold' }))}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition cursor-pointer ${
                        draftStep.actionType === 'hold'
                          ? isDark
                            ? 'bg-[#0c1626] text-cyan-300 border border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.35)] font-bold'
                            : 'bg-white text-blue-600 border border-blue-400 shadow-xs font-bold'
                          : isDark ? 'text-zinc-400 hover:text-cyan-200 border border-transparent' : 'text-zinc-600 hover:text-zinc-900 border border-transparent'
                      }`}
                    >
                      {t.actionHold}
                    </button>
                  </div>
                </div>

                {/* 3. Горизонтальная сетка: Время каста и Нажатий подряд */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Время каста */}
                  <div className={`flex flex-col gap-1 p-2 rounded-xl border ${
                    isDark ? 'bg-[#06070a]/90 border-zinc-800/80' : 'bg-zinc-50 border-zinc-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <label className={`text-[9.5px] font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{t.castLabel}</label>
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
                            // Allow only digits, comma and dot
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
                              setCastInputStr('0');
                              setDraftStep(prev => ({ ...prev, castTimeSeconds: 0 }));
                            } else {
                              const parsed = parseFloat(castInputStr.replace(',', '.'));
                              if (isNaN(parsed)) {
                                setCastInputStr('0');
                                setDraftStep(prev => ({ ...prev, castTimeSeconds: 0 }));
                              } else {
                                const val = Math.min(MAX_CAST_SECONDS, Math.max(0, parsed));
                                setCastInputStr(String(val));
                                setDraftStep(prev => ({ ...prev, castTimeSeconds: val }));
                              }
                            }
                          }}
                          className={`w-10 sm:w-12 bg-transparent text-center font-mono font-bold text-[10.5px] outline-none ${
                            isDark ? 'text-cyan-300' : 'text-zinc-900'
                          }`}
                          placeholder="0"
                          title={t.castTitle}
                        />
                        <span className={`text-[8px] font-mono ${isDark ? 'text-cyan-400/70' : 'text-zinc-500'}`}>{t.castSecondsUnit}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 pt-0.5">
                      {[0, 1, 2, 3, 5, 10].map((s) => (
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
                  <div className={`flex flex-col gap-1 p-2 rounded-xl border ${
                    isDark ? 'bg-[#06070a]/90 border-zinc-800/80' : 'bg-zinc-50 border-zinc-200'
                  }`}>
                    <div className="flex items-center justify-between">
                      <label className={`text-[9.5px] font-medium ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>{t.repeatLabel}</label>
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

              {/* RIGHT COLUMN: Тип запуска (Обычный / Постоянно) и КД скилла */}
              <div className="flex flex-col gap-2">
                {/* 1. Тип запуска: Обычный / Постоянно */}
                <div className={`flex flex-col gap-1.5 p-2 rounded-xl border ${
                  isDark ? 'bg-[#06070a]/90 border-zinc-800/80' : 'bg-zinc-50 border-zinc-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <label className={`text-[10px] font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      {t.triggerTypeLabel}
                    </label>
                    {draftStep.independent ? (
                      <span className="text-[8.5px] font-bold text-cyan-300 bg-[#0c1626] px-1.5 py-0.2 rounded border border-cyan-400/80 shadow-[0_0_6px_rgba(6,182,212,0.3)]">
                        {t.triggerSpam}
                      </span>
                    ) : (
                      <span className={`text-[8.5px] px-1.5 py-0.2 rounded border ${
                        isDark ? 'text-zinc-400 bg-zinc-900 border-zinc-800' : 'text-zinc-600 bg-zinc-200 border-zinc-300'
                      }`}>
                        {t.triggerSequence}
                      </span>
                    )}
                  </div>

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
                      <span>{t.triggerSequenceDesc}</span>
                      <span className="text-[8px] opacity-70 font-normal">{t.triggerSequenceSub}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDraftStep(prev => {
                          const nextCd = (!prev.skillCooldownSeconds || prev.skillCooldownSeconds === 0) ? 6 : prev.skillCooldownSeconds;
                          setCdInputStr(String(nextCd));
                          return {
                            ...prev,
                            independent: true,
                            skillCooldownSeconds: nextCd,
                          };
                        });
                      }}
                      className={`py-1 px-1.5 rounded-md text-[10px] font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                        draftStep.independent
                          ? isDark
                            ? 'bg-[#0c1626] text-cyan-300 border border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.45)] font-bold'
                            : 'bg-blue-600 text-white border border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.45)]'
                          : isDark ? 'text-zinc-400 hover:text-cyan-200 border border-transparent' : 'text-zinc-600 hover:text-blue-600 border border-transparent'
                      }`}
                    >
                      <span>⚡ {t.triggerSpam}</span>
                    </button>
                  </div>
                </div>

                {/* 2. КД скилла (сек) */}
                <div className={`flex flex-col gap-1.5 p-2 rounded-xl border transition-all ${
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
                      <span>{t.skillCdLabel}</span>
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
                        className={`w-11 bg-transparent text-center font-mono font-bold text-[11px] outline-none ${
                          draftStep.independent ? 'text-cyan-300 font-black' : isDark ? 'text-zinc-100' : 'text-zinc-900'
                        }`}
                        placeholder="0"
                      />
                      <span className={`text-[9px] font-mono ${isDark ? 'text-cyan-400/70' : 'text-zinc-400'}`}>{t.castSecondsUnit}</span>
                    </div>
                  </div>

                  {/* Быстрые кнопки пресетов */}
                  <div className="flex flex-wrap items-center gap-1 pt-0.2">
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
            </div>

            {/* Footer Buttons: Horizontal bar */}
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

      {/* Capture Skills Progress Toast (displays during countdown, persists 4s after finish) */}
      <CaptureProgressToast
        progress={captureProgress}
        onDismiss={() => setCaptureProgress(null)}
      />

      {/* Capture Skills Result Modal (opens on «Посмотреть скилы») */}
      <CaptureSkillsModal
        isOpen={isCaptureModalOpen}
        result={captureResult}
        onClose={() => setIsCaptureModalOpen(false)}
        onRetry={handleCaptureSkills}
        isLoading={isCapturing}
      />
    </div>
  );
};
