import { PriceStatus, LootRow, LootStatus, LootFilterStatus, LootMemory } from '../types';

export const MOCK_PRICE_STATUS: PriceStatus = {
  configured: true,
  keys_error: null,
  region: 'eu',
  house_id: 2,
  house_source: 'auto',
  who: {
    realm: 'Flamegor',
    faction: 'Alliance',
    ruleset: 'pvp',
    auto_house_id: 2,
    note: 'Flamegor (Alliance, PvP)',
  },
  houses: [
    { id: 2, name: 'Альянс (Штормград)', ruleset: 'pvp' },
    { id: 6, name: 'Орда (Оргриммар)', ruleset: 'pvp' },
    { id: 7, name: 'Нейтральный (Кабестан)', ruleset: 'normal' },
  ],
  updated_at_ms: Date.now() - 25 * 60 * 1000,
  loading: false,
  error: null,
  items: 1845,
};

export const MOCK_LOOT_ROWS: LootRow[] = [
  {
    item_id: 22785,
    name: 'Оскверненная трава',
    count: 38,
    price: 4500, // 45с
    value: 171000, // 17з 10с
    vendor: 250,
  },
  {
    item_id: 22786,
    name: 'Сноцвет',
    count: 24,
    price: 6800, // 68с
    value: 163200, // 16з 32с
    vendor: 300,
  },
  {
    item_id: 23424,
    name: 'Руда оскверненного железа',
    count: 42,
    price: 3200, // 32с
    value: 134400, // 13з 44с
    vendor: 200,
  },
  {
    item_id: 23425,
    name: 'Адамантитовая руда',
    count: 18,
    price: 9500, // 95с
    value: 171000, // 17з 10с
    vendor: 450,
  },
  {
    item_id: 23426,
    name: 'Кориевая руда',
    count: 6,
    price: 45000, // 4з 50с
    value: 270000, // 27з
    vendor: 1500,
  },
  {
    item_id: 22787,
    name: 'Дробящий гриб',
    count: 12,
    price: null, // нет цены
    value: null,
    vendor: 180,
  },
];

export const MOCK_LOOT_STATUS: LootStatus = {
  items: MOCK_LOOT_ROWS.slice(0, 4),
  earned_copper: 639600, // 63з 96с
  earned_complete: false,
};

export async function mockGetPriceStatus(): Promise<{ ok: boolean } & PriceStatus> {
  return {
    ok: true,
    ...MOCK_PRICE_STATUS,
  };
}

export async function mockRefreshPrices(): Promise<{ ok: boolean } & PriceStatus> {
  await new Promise((r) => setTimeout(r, 800));
  return {
    ok: true,
    ...MOCK_PRICE_STATUS,
    updated_at_ms: Date.now(),
    loading: false,
  };
}

export async function mockGetLootStatus(minValue: number | null): Promise<LootFilterStatus> {
  const autoThreshold = 12005; // 1з 20с 5м
  if (minValue != null && minValue > autoThreshold) {
    return {
      ok: true,
      active: true,
      thresholdCopper: minValue,
      source: 'floor',
      leftThisSession: 14,
      minValue,
    };
  }
  return {
    ok: true,
    active: true,
    thresholdCopper: autoThreshold,
    source: 'memory',
    leftThisSession: 14,
    minValue,
  };
}

export async function mockGetLootMemory(): Promise<LootMemory> {
  return {
    ok: true,
    updatedAtMs: Date.now() - 18 * 60 * 1000,
    mobs: [
      {
        npcId: 18477,
        name: 'Сквернохвостый сатир',
        zoneId: 3520,
        zone: 'Долина Призрачной Луны',
        kills: 42,
        trusted: true,
        items: [
          { itemId: 21877, name: 'Ткань Пустоты', chance: 0.47, margin: 0.08, perKill: 1.2, priceCopper: 3450, quality: 1, iconUrl: null },
          { itemId: 22575, name: 'Частица тени', chance: 0.24, margin: 0.07, perKill: 0.3, priceCopper: 48200, quality: 2, iconUrl: null },
          { itemId: 27854, name: 'Копченое мясо талбука', chance: 0.14, margin: 0.05, perKill: 0.2, priceCopper: 900, quality: 1, iconUrl: null },
          { itemId: 25440, name: null, chance: 0.09, margin: 0.04, perKill: 0.1, priceCopper: null, quality: null, iconUrl: null },
        ],
      },
      {
        npcId: 19954,
        name: 'Мародер из клана Кровавой Глазницы',
        zoneId: 3518,
        zone: 'Награнд',
        kills: 13,
        trusted: false,
        items: [
          { itemId: 21877, name: 'Ткань Пустоты', chance: 0.38, margin: 0.15, perKill: 0.9, priceCopper: 3450, quality: 1, iconUrl: null },
          { itemId: 25433, name: 'Обсидиановые бусы войны', chance: 0.31, margin: 0.14, perKill: 0.4, priceCopper: null, quality: 3, iconUrl: null },
        ],
      },
    ],
  };
}
