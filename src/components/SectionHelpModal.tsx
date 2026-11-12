import React, { useEffect } from 'react';
import {
  X,
  Route,
  Crosshair,
  CalendarClock,
  BarChart3,
  SlidersHorizontal,
  Compass,
  Sparkles,
  Shield,
  Clock,
  Coins,
  Layers,
  CheckCircle2,
  Lightbulb,
  Zap,
} from 'lucide-react';
import { SpecularButton } from './ui/Specular';
import { soundFx } from '../utils/audio';

export type HelpSectionId = 'routes' | 'rotation' | 'schedule' | 'loot' | 'summary' | 'settings';

interface SectionHelpModalProps {
  isOpen: boolean;
  sectionId: HelpSectionId | null;
  onClose: () => void;
  onStartTour?: (sectionId: HelpSectionId) => void;
  language?: 'ru' | 'en';
}

interface SectionHelpData {
  titleRu: string;
  titleEn: string;
  badgeRu: string;
  badgeEn: string;
  icon: React.ComponentType<{ className?: string }>;
  introRu: string;
  introEn?: string;
  steps: {
    titleRu: string;
    titleEn: string;
    descRu: string;
    descEn: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
  tipRu: string;
  tipEn: string;
}

const SECTION_HELP_CONTENT: Record<HelpSectionId, SectionHelpData> = {
  routes: {
    titleRu: 'Маршруты и местность',
    titleEn: 'Routes and Terrain',
    badgeRu: 'Сетка местности • Сбор руды и трав',
    badgeEn: 'Terrain Mesh • Ore & Herb Gathering',
    icon: Route,
    introRu:
      'Бот бегает по зоне по карте проходимости, собранной из файлов самой игры: склоны, скалы, дома, вода. Без этой карты он не бежит — стоит и ждёт.',
    introEn:
      'The bot navigates the zone using a traversability mesh built directly from game client files: slopes, cliffs, buildings, water. Without this map, it does not run — it stays still and waits.',
    steps: [
      {
        titleRu: '1. Карта местности',
        titleEn: '1. Terrain Map',
        descRu:
          'Первый раз в новой зоне карта собирается 2–3 минуты — бот в это время стоит. Дальше берётся с диска за пару секунд. Крутые склоны, стены и предметы внутри зданий он обходит, глубокую воду переплывает.',
        descEn:
          'The first time in a new zone, the map takes 2–3 minutes to build while the bot stands still. Afterwards, it loads from disk in a couple seconds. It bypasses steep cliffs, walls, and interior clutter, and swims across deep water.',
        icon: Compass,
      },
      {
        titleRu: '2. Свой маршрут',
        titleEn: '2. Custom Route',
        descRu:
          'Нажмите «Записать», пробегите круг сами и сохраните. Бот пойдёт по нему кусками с небольшими случайностями, а в узких местах и у поворотов — точно по вашему следу.',
        descEn:
          'Click "Record", run a loop yourself, and save it. The bot will follow it in segments with subtle natural variations, and follow your exact path through narrow bottlenecks and sharp turns.',
        icon: Route,
      },
      {
        titleRu: '3. Автомаршрут',
        titleEn: '3. Auto Route',
        descRu:
          'Если рядом нет маршрута, бот сам строит круг от места запуска через места появления трав и руды — только тех, что умеет собирать ваш персонаж. Расчёт около минуты, длина — в настройках (30–120 мин). Круг сохраняется как «Автомаршрут» и берётся в следующий раз.',
        descEn:
          'If no recorded route is nearby, the bot autonomously constructs a loop from your starting spot passing through herb and ore spawn locations matching your character’s skills. Calculation takes about a minute, length is set in Settings (30–120 min). The loop is saved as "Auto Route" for future runs.',
        icon: Sparkles,
      },
      {
        titleRu: '4. Сбор по пути',
        titleEn: '4. Gathering En Route',
        descRu:
          'Руду и траву бот видит на миникарте и сворачивает к ней, если крюк недолгий (до ~20 с бега). Поиск трав и руды переключает сам, заранее — по тому, что впереди. Застрял — шаг назад и обход; застрял 3 раза за минуту — останавливается.',
        descEn:
          'The bot spots ore and herbs on the minimap and veers off if the detour is short (up to ~20s run). It switches tracking automatically in advance based on what lies ahead. If stuck, it steps back and takes a detour; if stuck 3 times in a minute, it stops.',
        icon: Layers,
      },
    ],
    tipRu: 'Записывайте маршрут там, где сами любите фармить: бот бежит по вашему следу и выглядит как вы.',
    tipEn: 'Record routes where you enjoy farming yourself: the bot runs your trail and behaves just like you.',
  },

  rotation: {
    titleRu: 'Бой и умения',
    titleEn: 'Combat and Abilities',
    badgeRu: 'Ротация • Лечение • Вода',
    badgeEn: 'Rotation • Healing • Water',
    icon: Crosshair,
    introRu:
      'Бот дерётся с теми, кто напал или попался на пути, всегда до конца боя. Нажимает умения через плату — как настоящая клавиатура.',
    introEn:
      'The bot fights any enemies that attack or cross its path, always to the bitter end. It presses abilities via controller hardware, identical to a real physical keyboard.',
    steps: [
      {
        titleRu: '1. Цепочка умений',
        titleEn: '1. Spell Sequence',
        descRu:
          'Умения идут слева направо, на кулдауне — пропускаются. «Как только готово» — жмётся вне очереди. Конец каста бот видит по игре. Между кастами иногда делает шаг вперёд или назад, как человек.',
        descEn:
          'Abilities fire left-to-right, skipping spells on cooldown. "ASAP" steps trigger out of turn. The bot detects cast completion directly from game memory. Between casts, it occasionally steps forward or backward like a real human player.',
        icon: Zap,
      },
      {
        titleRu: '2. Клавиши',
        titleEn: '2. Keybinds',
        descRu:
          'Подходят цифры, «-», «=» и буквы. Нельзя: W, A, S, D, пробел, Tab и клавиши из настроек (взаимодействие, предыдущая цель, поиск) — бот ими ходит и целится. F1–F12 не подходят.',
        descEn:
          'Numbers, "-", "=", and letters are supported. Prohibited: W, A, S, D, Space, Tab, and control keys from Settings (Interact, Last Target, Tracking) — the bot uses them to move and aim. F1–F12 are not allowed.',
        icon: Crosshair,
      },
      {
        titleRu: '3. Лечение («HP ниже»)',
        titleEn: '3. Healing ("HP below")',
        descRu:
          'Шаг с порогом HP — это хил. В бою бот лечится, только если иначе проиграет гонку: сравнивает, кто кого убьёт быстрее. Вне боя долечивается до 80–98%.',
        descEn:
          'A step with an HP threshold acts as a heal. During combat, the bot only heals if it would lose the DPS race otherwise, comparing time-to-kill. Out of combat, it heals up to 80–98%.',
        icon: Shield,
      },
      {
        titleRu: '4. Вода',
        titleEn: '4. Water',
        descRu:
          'Только вне боя: мана ниже порога — пьёт до 90–100% (не дольше 35 с). Если на хил не хватает маны — пьёт сразу. Напали — дерётся.',
        descEn:
          'Out of combat only: if mana drops below the threshold, it drinks up to 90–100% (max 35s). If there isn’t enough mana to heal, it drinks immediately. If attacked, it engages in combat.',
        icon: Sparkles,
      },
    ],
    tipRu: 'Поставьте хил на «HP ниже 50%» — бот не будет тратить ману, когда моб и так умрёт первым.',
    tipEn: 'Set heals to "HP below 50%" — the bot won’t waste mana when the mob is going to die first anyway.',
  },

  schedule: {
    titleRu: 'Расписание',
    titleEn: 'Schedule',
    badgeRu: 'Неделя • Сессии • Перерывы',
    badgeEn: 'Week • Sessions • Breaks',
    icon: CalendarClock,
    introRu:
      'Бот играет как человек: не каждый день одинаково, с перерывами, и никогда круглые сутки.',
    introEn:
      'The bot plays like a human: varying by day of the week, taking breaks, and never running 24/7.',
    steps: [
      {
        titleRu: '1. Неделя',
        titleEn: '1. Week',
        descRu:
          'Каждый день недели можно настроить отдельно: сколько часов фармить и в какое время. Дни можно выключать совсем (например, выходные). Нажмите «Скопировать день», чтобы быстро размножить настройку на всю неделю.',
        descEn:
          'Each day of the week is configured individually: active hours and start times. Days can be turned off completely (e.g. weekends). Click "Copy day" to quickly duplicate your configuration across the entire week.',
        icon: CalendarClock,
      },
      {
        titleRu: '2. Стили',
        titleEn: '2. Styles',
        descRu:
          'Четыре профиля на выбор: Осторожный (короткие сессии, длинные паузы), Обычный (рекомендуется), Интенсивный (больше фарма, меньше пауз) и Свой (ваши секунды и минуты).',
        descEn:
          'Choose from four behavior profiles: Cautious (short sessions, long breaks), Normal (recommended), Intensive (more farming, fewer pauses), and Custom (fine-tuned timings).',
        icon: Sparkles,
      },
      {
        titleRu: '3. Когда и сколько играть',
        titleEn: '3. Playtime & Schedule',
        descRu:
          'Задайте временные окна, в которые бот может запускаться, и добавьте до 4 интервалов на день. Бот сам слегка сдвигает старт и конец каждого окна, чтобы расписание выглядело естественно.',
        descEn:
          'Set active playtime windows for the day and add up to 4 intervals. The bot slightly varies start and end times so your schedule looks natural.',
        icon: Clock,
      },
      {
        titleRu: '4. Перерывы',
        titleEn: '4. Breaks',
        descRu:
          'Внутри игрового времени бот делает короткие перерывы на несколько минут (отойти от компьютера) и длинные раз в 2–3 сессии (поесть, отдохнуть). Можно включить случайные выходные раз в 10 дней.',
        descEn:
          'During play sessions, the bot takes short pauses for a few minutes (stepping away from the keyboard) and long breaks every 2–3 sessions (meals, rest). You can also enable random days off every 10 days.',
        icon: Clock,
      },
      {
        titleRu: '5. Мягкий конец',
        titleEn: '5. Soft Exit',
        descRu:
          'Когда время сессии вышло, бот не выдёргивает провод: он добивает моба, собирает руду или траву, добегает до безопасного места и только потом выходит.',
        descEn:
          'When session time expires, the bot never pulls the plug: it finishes off the current mob, gathers nearby nodes, runs to a safe location, and only then logs out.',
        icon: Shield,
      },
    ],
    tipRu: 'Не ставьте все дни одинаково — одинаковые дни и выдают бота.',
    tipEn: 'Avoid configuring every day identically — uniform schedules are the easiest way to give away a bot.',
  },

  loot: {
    titleRu: 'Лут',
    titleEn: 'Loot',
    badgeRu: 'Фильтр • Место в сумке',
    badgeEn: 'Filter • Bag Space',
    icon: Coins,
    introRu:
      'Бот не тащит в сумку мусор: с мобов берёт только то, что стоит места в сумке.',
    introEn:
      'The bot never clutters your bags with junk: from slain mobs, it only picks up items worth inventory space.',
    steps: [
      {
        titleRu: '1. Правило',
        titleEn: '1. Rule',
        descRu:
          'С мобов берётся только то, что стоит дороже порога. Предметы дешевле бот оставляет на трупе — сумка не забивается серыми вещами за пару копеек.',
        descEn:
          'Only items valued above the threshold are looted from corpses. Cheaper trash items are left behind, keeping bags free of low-value junk.',
        icon: Shield,
      },
      {
        titleRu: '2. Что берёт всегда',
        titleEn: '2. Always Looted',
        descRu:
          'Травы и руду бот берёт ВСЕГДА, даже если порог высокий: на них он и зарабатывает.',
        descEn:
          'Herbs and mining ores are ALWAYS collected, even with high value thresholds: they are the main source of income.',
        icon: Sparkles,
      },
      {
        titleRu: '3. Авто',
        titleEn: '3. Auto',
        descRu:
          'В режиме «Авто» бот сам прикидывает порог по уровню зоны и вашим свободным слотам. Для большинства зон этого достаточно.',
        descEn:
          'In "Auto" mode, the bot dynamically calculates the threshold based on zone level and available bag slots. This is optimal for most zones.',
        icon: Zap,
      },
      {
        titleRu: '4. Свой порог',
        titleEn: '4. Custom Threshold',
        descRu:
          'Снимите галочку «Авто» и задайте порог в серебре и золоте руками. Например: 5 серебра — всё, что дешевле 5 серебряных монет, останется на мобе.',
        descEn:
          'Uncheck "Auto" to set the threshold manually in gold and silver. For example, 5 silver: anything worth under 5 silver is left on the corpse.',
        icon: Coins,
      },
    ],
    tipRu: 'Начните с «Авто» и посмотрите итог сессии — подправить порог можно всегда.',
    tipEn: 'Start with "Auto" and check your session earnings — you can adjust the threshold at any time.',
  },

  summary: {
    titleRu: 'Итоги и заработок',
    titleEn: 'Summary & Earnings',
    badgeRu: 'Добыча • Цены аукциона • История',
    badgeEn: 'Loot • Auction Prices • History',
    icon: BarChart3,
    introRu:
      'Всё, что персонаж получил за сессию — и со сбора, и с мобов — бот считает по ценам аукциона вашего сервера.',
    introEn:
      'All earnings gathered during the session — both from gathering and mob drops — are valued according to your server auction house prices.',
    steps: [
      {
        titleRu: '1. Сессия сейчас',
        titleEn: '1. Current Session',
        descRu:
          'В карточках в реальном времени: сколько бот работает, сколько золота заработал, темп «в час» и сколько осталось до ближайшего перерыва.',
        descEn:
          'Real-time telemetry cards: bot uptime, total gold earned, "per hour" rate, and countdown to the next scheduled break.',
        icon: Clock,
      },
      {
        titleRu: '2. Цены',
        titleEn: '2. Prices',
        descRu:
          'Цены на руду, траву и предметы бот берёт с аукциона вашего сервера (настраивается в Настройках). Если сервер не найден — считает по базовой цене торговца.',
        descEn:
          'Ore, herb, and drop prices are pulled from your server auction data (configured in Settings). If realm data is unavailable, vendor prices are used.',
        icon: Coins,
      },
      {
        titleRu: '3. История',
        titleEn: '3. History',
        descRu:
          'Календарь слева помнит все прошлые сессии по дням: сколько нафармлено, сколько чистого золота вышло, сколько времени бот был активен.',
        descEn:
          'The sidebar calendar preserves past sessions by date: total farmed value, net gold earned, and total bot uptime.',
        icon: CalendarClock,
      },
      {
        titleRu: '4. Карта прохода',
        titleEn: '4. Farm Map',
        descRu:
          'На карте маршрута видно, где бот подбирал траву и руду, а где дрался с мобами — можно оценить, какая часть круга приносит больше всего.',
        descEn:
          'The route map visually highlights where herbs/ores were gathered and where combat took place — helping identify the most lucrative sections of the loop.',
        icon: Compass,
      },
    ],
    tipRu: 'Пишет «нет цен» — проверьте в Настройках, что найдены ключи и выбран аукцион (или «Авто»).',
    tipEn: 'If it displays "no prices", check Settings to ensure auction keys are detected and realm auction is selected (or set to "Auto").',
  },

  settings: {
    titleRu: 'Настройки и клавиши',
    titleEn: 'Settings & Keybinds',
    badgeRu: 'Клавиши игры • Пауза • Аукцион',
    badgeEn: 'Game Keys • Pause • Auction',
    icon: SlidersHorizontal,
    introRu:
      'Клавиши здесь должны совпадать с клавишами в настройках самой игры — бот нажимает их как вы.',
    introEn:
      'Keybinds configured here must match the key bindings in your World of Warcraft client settings — the bot presses them like a real player.',
    steps: [
      {
        titleRu: '1. Расписание фарма',
        titleEn: '1. Farm Schedule',
        descRu:
          'Включает автоматические сессии по вашему графику, перерывы и шанс случайного выходного. Подробное расписание по дням настраивается во вкладке «Расписание».',
        descEn:
          'Enables automatic farming sessions by schedule, realistic breaks, and random days off. Fine-tune daily hours and windows in the Schedule tab.',
        icon: Clock,
      },
      {
        titleRu: '2. Автомаршрут и аукцион',
        titleEn: '2. Auto Route & Auction',
        descRu:
          'Длина автомаршрута задаёт размер сгенерированного круга (30–120 минут). В блоке аукциона выберите сервер или оставьте «Авто», чтобы бот знал цены вашей фракции.',
        descEn:
          'The route slider configures loop generation length (30–120 minutes). In the auction section, select your server or leave on "Auto" so the bot tracks your faction prices.',
        icon: Coins,
      },
      {
        titleRu: '3. Клавиши игры',
        titleEn: '3. Game Keys',
        descRu:
          '«Взаимодействие с целью» и «Предыдущая цель» настройте в игре на те же клавиши, что указаны тут. Иначе бот не сможет лутать и целиться в моба за спиной.',
        descEn:
          'Configure "Interact With Target" and "Previous Target" in-game to match the keys specified here. Otherwise the bot cannot loot or acquire targets behind it.',
        icon: Sparkles,
      },
      {
        titleRu: '4. Пауза и поиск ресурсов',
        titleEn: '4. Pause & Tracking',
        descRu:
          'Клавиша «Пауза» мгновенно отпускает управление, а F9 и F10 аддон привязывает к поиску трав и минералов автоматически.',
        descEn:
          'The emergency "Pause" key instantly releases control, while F9 and F10 are automatically bound to herb and mineral tracking by the addon.',
        icon: Layers,
      },
    ],
    tipRu: 'Поменяли клавиши — сделайте /reload в игре, иначе аддон помнит старые.',
    tipEn: 'Whenever you change keybindings, run /reload in game chat, otherwise the addon continues using previous bindings.',
  },
};

export const SectionHelpModal: React.FC<SectionHelpModalProps> = ({
  isOpen,
  sectionId,
  onClose,
  onStartTour,
  language = 'ru',
}) => {
  const isRu = language === 'ru';

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        soundFx.playClick();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !sectionId) return null;

  const content = SECTION_HELP_CONTENT[sectionId];
  if (!content) return null;

  const MainIcon = content.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md animate-fadeIn select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          soundFx.playClick();
          onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-2xl max-h-[88vh] flex flex-col rounded-2xl border border-black/15 dark:border-white/15 bg-zinc-900/90 dark:bg-[#09090b]/92 backdrop-blur-2xl shadow-[0_24px_80px_rgba(0,0,0,0.85)] text-zinc-100 overflow-hidden animate-assemble"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Specular top glow line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between p-4 sm:p-5 pb-3 border-b border-black/10 dark:border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-black/30 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 flex items-center justify-center shrink-0 shadow-sm">
              <MainIcon className="w-5 h-5 text-zinc-950 dark:text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-mono font-bold text-zinc-950 dark:text-white">
                  {isRu ? content.titleRu : content.titleEn}
                </h2>
                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-zinc-950/10 dark:bg-white/10 text-zinc-700 dark:text-zinc-300 border border-black/10 dark:border-white/10">
                  {isRu ? 'КАК ЭТО РАБОТАЕТ' : 'HOW IT WORKS'}
                </span>
              </div>
              <p className="text-[11px] font-mono text-zinc-500 mt-0.5">
                {isRu ? content.badgeRu : content.badgeEn}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              soundFx.playClick();
              onClose();
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title={isRu ? 'Закрыть (Esc)' : 'Close (Esc)'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs font-sans">
          {/* Intro description */}
          <div className="p-3.5 rounded-xl bg-black/20 dark:bg-white/[0.03] border border-black/10 dark:border-white/[0.08] text-zinc-700 dark:text-zinc-300 leading-relaxed font-mono text-[11px] sm:text-xs">
            <p>{isRu ? content.introRu : content.introEn}</p>
          </div>

          {/* Detailed step cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {content.steps.map((step, idx) => {
              const StepIcon = step.icon;
              return (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl bg-black/20 dark:bg-white/[0.03] border border-black/10 dark:border-white/[0.08] hover:border-black/20 dark:hover:border-white/20 transition-all flex flex-col gap-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-black/40 dark:bg-white/[0.08] border border-black/10 dark:border-white/10 flex items-center justify-center shrink-0">
                      <StepIcon className="w-3 h-3 text-zinc-900 dark:text-zinc-200" />
                    </span>
                    <h3 className="font-mono font-bold text-xs text-zinc-950 dark:text-white">
                      {isRu ? step.titleRu : step.titleEn}
                    </h3>
                  </div>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {isRu ? step.descRu : step.descEn}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Pro Tip Box */}
          <div className="p-3.5 rounded-xl bg-black/30 dark:bg-white/[0.05] border border-black/15 dark:border-white/15 flex items-start gap-2.5 text-zinc-700 dark:text-zinc-300">
            <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-zinc-950 dark:text-white" />
            <div className="text-[11px] leading-relaxed">
              <strong className="font-mono font-semibold block text-zinc-950 dark:text-white mb-0.5">
                {isRu ? 'Полезный совет:' : 'Pro Tip:'}
              </strong>
              <span>{isRu ? content.tipRu : content.tipEn}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-black/10 dark:border-white/10 flex items-center justify-between gap-3 bg-black/10 dark:bg-white/[0.02] shrink-0">
          <span className="text-[10px] font-mono text-zinc-500 hidden sm:inline">
            {isRu ? 'Нажмите Esc или кликните снаружи для закрытия' : 'Press Esc or click outside to dismiss'}
          </span>

          <div className="flex items-center gap-2 ml-auto">
            {onStartTour && (
              <SpecularButton
                onClick={() => {
                  soundFx.playClick();
                  onClose();
                  onStartTour(sectionId);
                }}
                className="h-8 px-3 rounded-lg text-xs font-mono font-medium cursor-pointer border border-black/15 dark:border-white/15 hover:border-black/30 dark:hover:border-white/30 bg-black/5 dark:bg-white/5 text-zinc-800 dark:text-zinc-200 hover:bg-black/10 dark:hover:bg-white/10 transition-all shadow-none"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1 text-zinc-950 dark:text-white" />
                <span>{isRu ? 'Интерактивный тур' : 'Interactive Tour'}</span>
              </SpecularButton>
            )}

            <SpecularButton
              onClick={() => {
                soundFx.playClick();
                onClose();
              }}
              className="h-8 px-4 rounded-lg text-xs font-mono font-semibold cursor-pointer border border-black/15 dark:border-white/15 hover:border-black/30 dark:hover:border-white/40 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-all shadow-sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
              <span>{isRu ? 'Понятно' : 'Got it'}</span>
            </SpecularButton>
          </div>
        </div>
      </div>
    </div>
  );
};
