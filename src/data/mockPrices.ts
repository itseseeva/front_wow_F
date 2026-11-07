import { PriceStatus, LootRow, LootStatus } from '../types';

export const MOCK_PRICE_STATUS: PriceStatus = {
  configured: true,
  keys_error: null,
  region: 'eu',
  house_id: 2,
  houses: [
    { id: 2, name: 'Альянс (Штормград) / Alliance (Stormwind)' },
    { id: 6, name: 'Орда (Оргриммар) / Horde (Orgrimmar)' },
    { id: 7, name: 'Нейтральный (Кабестан) / Neutral (Ratchet)' },
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
