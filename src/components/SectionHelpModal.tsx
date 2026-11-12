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

export type HelpSectionId = 'routes' | 'rotation' | 'schedule' | 'summary' | 'settings';

interface SectionHelpModalProps {
  isOpen: boolean;
  sectionId: HelpSectionId | null;
  onClose: () => void;
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
    titleRu: 'Навигация и автомаршруты',
    titleEn: 'Navigation & Auto Routes',
    badgeRu: '3D NavMesh • Сбор руды и трав',
    badgeEn: '3D NavMesh • Ore & Herb Gathering',
    icon: Route,
    introRu:
      'Раздел отвечает за перемещение персонажа по игровому миру, поиск ресурсов и безопасный обход любых препятствий на трёхмерной навигационной сетке зоны.',
    steps: [
      {
        titleRu: 'Готовые и циклические маршруты',
        titleEn: 'Ready & Cyclic Routes',
        descRu:
          'Выберите любой маршрут из списка слева. Тип «Круг» заставляет бота непрерывно наматывать круги по точкам респауна ресурсов. Когда круг заканчивается, бот бесшовно идёт на следующий.',
        descEn:
          'Select any route from the list. "Loop" type makes the bot cycle nodes continuously. Once finished, it seamlessly starts the next loop.',
        icon: Route,
      },
      {
        titleRu: 'Кнопка «Автомаршрут»',
        titleEn: '«Auto Route» Button',
        descRu:
          'Нажмите «Автомаршрут» слева от записи. Бот исследует окружающую местность вокруг персонажа, находит скопления руды и трав и сам генерирует идеальный замкнутый круг фарма с заданной в настройках длительностью (30–120 мин).',
        descEn:
          'Click «Auto Route» next to Record. The bot scans nearby terrain around your character, detects gathering nodes, and builds an optimal loop matching your duration setting.',
        icon: Compass,
      },
      {
        titleRu: 'Запись собственного маршрута',
        titleEn: 'Recording Custom Route',
        descRu:
          'Нажмите «Записать маршрут», перейдите в игру и пробегите персонажем нужный круг. Бот в реальном времени запишет точки пути, рассчитает тайминги и сохранит маршрут.',
        descEn:
          'Click «Record Route», run your desired loop in game, and save. The bot records waypoints, calculates run times, and saves the loop automatically.',
        icon: Layers,
      },
      {
        titleRu: '3D-рельеф и защита от застреваний',
        titleEn: '3D Terrain & Navmesh Protection',
        descRu:
          'Перед стартом бот загружает карту высот зоны (тайлы, деревья, строения). Это гарантирует, что персонаж оббегает скалы, реки и стены без ручного вмешательства.',
        descEn:
          'Before starting, the bot loads zone terrain geometry (tiles, trees, buildings), preventing character collision and getting stuck.',
        icon: Shield,
      },
    ],
    tipRu:
      'Для лучшего фарма используйте «Автомаршрут» прямо на месте старта — бот сам выберет наиболее прибыльные точки и исключит опасные зоны с сильными мобами.',
    tipEn:
      'For best farming results, use Auto Route right where you stand — the bot chooses the most profitable nodes while avoiding dangerous monster clusters.',
  },

  rotation: {
    titleRu: 'Боевая ротация и умения',
    titleEn: 'Combat Rotation & Spells',
    badgeRu: 'Spell Engine • Тайминги • Автокаст',
    badgeEn: 'Spell Engine • Timings • Autocast',
    icon: Crosshair,
    introRu:
      'Настройка боевого поведения персонажа при столкновении с врагами во время сбора ресурсов. Бот мгновенно переключается в бой, если на него напали.',
    steps: [
      {
        titleRu: 'Цепочка заклинаний',
        titleEn: 'Spell Sequence Chain',
        descRu:
          'Заклинания выполняются по порядку слева направо. Нажмите на любой слот, чтобы открыть его параметры (время каста, кулдаун, пороги HP/MP).',
        descEn:
          'Spells are cast from left to right. Click any slot to configure cast times, cooldowns, and health/mana triggers.',
        icon: Zap,
      },
      {
        titleRu: 'Привязка клавиш на панели',
        titleEn: 'Keybinding Action Bar Slots',
        descRu:
          'В нижней панели нажмите кнопку «[КЛАВИША]» и нажмите нужную кнопку на клавиатуре (поддерживаются 1–9, Q/E/R/F, тильда ` и F1–F12). Клавиша привяжется моментально.',
        descEn:
          'In the bottom panel, click «[KEY]» and press any keyboard button (1–9, letters, backtick `, F1–F12). Keybind updates instantly.',
        icon: Sparkles,
      },
      {
        titleRu: 'Тайминги каста и кулдауны',
        titleEn: 'Cast Times & Skill Cooldowns',
        descRu:
          'Для мгновенных заклинаний укажите время каста 0–0.5 с. Для поддерживаемых или длинных заклинаний укажите их точное время каста из игры, а кулдаун защитит от спама одной кнопкой.',
        descEn:
          'For instant spells use 0–0.5s cast time. For channeled or casted spells specify in-game duration; cooldown prevents key spamming.',
        icon: Clock,
      },
      {
        titleRu: 'Слот для воды (манареген)',
        titleEn: 'Water Slot (Mana Regen)',
        descRu:
          'Для мана-классов доступен специальный синий слот воды. Если мана падает ниже заданного процента, бот выходит из боя, садится и пьёт воду до восстановления.',
        descEn:
          'Special water slot for mana users: when mana drops below threshold, the bot exits combat, sits, and drinks until restored.',
        icon: Layers,
      },
    ],
    tipRu:
      'Если у вас есть защитный щит или исцеление, добавьте условие «HP < 50%» — бот применит способность только тогда, когда здоровье действительно просядет.',
    tipEn:
      'If you have shields or heals, set the «HP < 50%» threshold — the bot will only trigger them when health drops into danger zone.',
  },

  schedule: {
    titleRu: 'Расписание и защита от детекта',
    titleEn: 'Schedule & Anti-Detection',
    badgeRu: 'Humanizer • Окна часов • Перерывы',
    badgeEn: 'Humanizer • Time Windows • Breaks',
    icon: CalendarClock,
    introRu:
      'Система имитации живого игрока по дням недели. Бот не играет круглосуточно, а следует естественному человеческому распорядку дня с паузами и перерывами.',
    steps: [
      {
        titleRu: 'Недельный календарь (Пн–Вс)',
        titleEn: 'Weekly Calendar (Mon–Sun)',
        descRu:
          'Для каждого дня недели можно настроить отдельные часы активности. В неактивные часы бот безопасно выходит из игры или ожидает следующего окна.',
        descEn:
          'Set active hours for each day of the week. Outside active hours, the bot safely logs out or idles until the next window.',
        icon: CalendarClock,
      },
      {
        titleRu: 'Стили игры (пресеты)',
        titleEn: 'Play Styles & Presets',
        descRu:
          'Выберите готовый стиль: «Обычный игрок» (сбалансированные сессии), «Хардкорный фармер» (максимальная плотность фарма) или «Ночной призрак» (тихий ночной сбор при пустом сервере).',
        descEn:
          'Choose a preset: «Casual Player» (balanced sessions), «Hardcore Farmer» (max density), or «Night Ghost» (quiet nocturnal runs).',
        icon: Sparkles,
      },
      {
        titleRu: 'Короткие и длинные перерывы',
        titleEn: 'Short & Long Breaks',
        descRu:
          'Короткие перерывы (1–5 мин) между кругами маршрута имитируют отвлечение на чай или перекур. Длинные перерывы (20–60 мин) каждые несколько сессий имитируют приём пищи или отдых.',
        descEn:
          'Short breaks (1–5m) between loops mimic quick AFK breaks. Long breaks (20–60m) every few sessions mimic meals and downtime.',
        icon: Clock,
      },
      {
        titleRu: 'Безопасное завершение боя',
        titleEn: 'Safe Combat Finishing',
        descRu:
          'Когда наступает время перерыва, бот не бросает персонажа в бою — он сначала добивает текущего монстра, собирает добычу и только в безопасном месте делает паузу.',
        descEn:
          'When break time arrives, the bot never stops mid-fight: it finishes combat, loots the mob, and only pauses in a safe spot.',
        icon: Shield,
      },
    ],
    tipRu:
      'Рекомендуем использовать пресет «Обычный игрок» с 2 окнами в день — такой профиль абсолютно неотличим от активности реального геймера.',
    tipEn:
      'We recommend the «Casual Player» style with 2 daily windows — this pattern looks 100% indistinguishable from a real player.',
  },

  summary: {
    titleRu: 'Статистика, лут и аналитика',
    titleEn: 'Statistics, Loot & Analytics',
    badgeRu: 'Live Telemetry • Цены аукциона • Календарь',
    badgeEn: 'Live Telemetry • Auction Prices • Calendar',
    icon: BarChart3,
    introRu:
      'Полная финансовая и маршрутная телеметрия ваших сессий. Считает каждый куст травы и жилу руды по рыночным ценам игрового аукциона.',
    steps: [
      {
        titleRu: 'Живая статистика сессии',
        titleEn: 'Live Session Telemetry',
        descRu:
          'Карточки в реальном времени показывают время работы, статус бота, заработанные деньги (в золоте, серебре и меди) и точный темп «Золото в час».',
        descEn:
          'Real-time HUD cards show active run time, bot phase, total earned money (gold, silver, copper), and live «Gold per Hour» rate.',
        icon: Coins,
      },
      {
        titleRu: 'Таймер «До перерыва»',
        titleEn: '«Until Break» Countdown',
        descRu:
          'Показывает обратный отсчёт до следующей паузы по расписанию фарма, чтобы вы всегда знали, когда бот сделает перекур.',
        descEn:
          'Countdown timer to the next scheduled break so you always know when the bot will pause for a rest.',
        icon: Clock,
      },
      {
        titleRu: 'Подсчёт добычи по аукциону',
        titleEn: 'Auction Loot Value Tracking',
        descRu:
          'Бот автоматически подтягивает цены аукционного дома вашего сервера и фракции. Каждый сорванный цветок сразу конвертируется в реальную стоимость.',
        descEn:
          'The bot tracks realm auction house prices. Every harvested herb and mined ore is immediately calculated into current market value.',
        icon: Sparkles,
      },
      {
        titleRu: 'Месячный календарь и история',
        titleEn: 'Monthly History & Calendar',
        descRu:
          'В календаре слева можно выбрать любой день прошедшего месяца, посмотреть историю запусков, суммарное время и общий заработанный капитал.',
        descEn:
          'Use the sidebar calendar to inspect any past day of the month, see total farming hours, session logs, and accumulated wealth.',
        icon: BarChart3,
      },
    ],
    tipRu:
      'Если в карточке «Золото в час» написано «нет цен», зайдите в Настройки и проверьте, выбран ли аукционный дом вашего игрового сервера.',
    tipEn:
      'If the «Gold per Hour» card shows «no prices», visit Settings and ensure your realm auction house is properly selected.',
  },

  settings: {
    titleRu: 'Глобальные настройки и бинды',
    titleEn: 'Global Settings & Keybinds',
    badgeRu: 'Хоткеи бота • Аддон WoW • Аукцион',
    badgeEn: 'Bot Hotkeys • WoW Addon • Auction',
    icon: SlidersHorizontal,
    introRu:
      'Настройка связи между клиентом World of Warcraft и ботом: горячие клавиши управления, аддон отслеживания ресурсов и выбор сервера аукциона.',
    steps: [
      {
        titleRu: 'Клавиши бота и клиента',
        titleEn: 'Bot & Game Hotkeys',
        descRu:
          '«Предыдущая цель» и «Взаимодействие с целью» должны совпадать с назначенными в настройках игры (Параметры → Управление). Клавиша F5 запускает и останавливает бота.',
        descEn:
          '«Previous Target» and «Interact With Target» must match your in-game keybindings. F5 hotkey starts and stops the bot globally.',
        icon: Sparkles,
      },
      {
        titleRu: 'Клавиша «Пауза» (Pause)',
        titleEn: '«Pause» Hotkey (Pause)',
        descRu:
          'Клавиша экстренной паузы. При нажатии бот мгновенно отпускает кнопки и замирает, отдавая управление вам. Нажмите ещё раз, чтобы продолжить с того же места.',
        descEn:
          'Emergency pause key: immediately releases keys and pauses bot, giving you control. Press again to resume from the exact spot.',
        icon: Clock,
      },
      {
        titleRu: 'Поиск трав и минералов',
        titleEn: 'Herbalism & Mining Radar',
        descRu:
          'Аддон бота сам привяжет заклинания поиска к клавишам F9 и F10 — выносить их на панель не нужно. Бот циклически переключает поиск, чтобы видеть и руду, и траву.',
        descEn:
          'The bot addon automatically binds tracking spells to F9 & F10. It cycles radar modes so you track herbs and mineral nodes simultaneously.',
        icon: Layers,
      },
      {
        titleRu: 'Длина автомаршрута и Аукцион',
        titleEn: 'Auto Route Duration & Auction',
        descRu:
          'Ползунок задаёт длину автомаршрута (от 30 до 120 минут). В блоке аукциона выберите ваш игровой сервер (или оставьте «Авто»), чтобы бот правильно считал золото.',
        descEn:
          'The slider configures auto route length (30–120 mins). In Auction section, pick your realm or leave on Auto for accurate loot values.',
        icon: Coins,
      },
    ],
    tipRu:
      'После изменения клавиш поиска трав или минералов обязательно напишите в чате игры команду /reload, чтобы аддон применил новые бинды.',
    tipEn:
      'After changing herb or mineral search keys, type /reload in in-game chat so the addon applies updated bindings.',
  },
};

export const SectionHelpModal: React.FC<SectionHelpModalProps> = ({
  isOpen,
  sectionId,
  onClose,
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
          <div className="p-3.5 rounded-xl bg-amber-500/10 dark:bg-amber-500/10 border border-amber-500/25 flex items-start gap-2.5 text-amber-600 dark:text-amber-300">
            <Lightbulb className="w-4 h-4 shrink-0 mt-0.5 text-amber-500 dark:text-amber-400" />
            <div className="text-[11px] leading-relaxed">
              <strong className="font-mono font-semibold block text-amber-700 dark:text-amber-200 mb-0.5">
                {isRu ? 'Полезный совет:' : 'Pro Tip:'}
              </strong>
              <span>{isRu ? content.tipRu : content.tipEn}</span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-black/10 dark:border-white/10 flex items-center justify-between bg-black/10 dark:bg-white/[0.02] shrink-0">
          <span className="text-[10px] font-mono text-zinc-500">
            {isRu ? 'Нажмите Esc или кликните снаружи для закрытия' : 'Press Esc or click outside to dismiss'}
          </span>

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
  );
};
