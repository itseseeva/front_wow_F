export interface ChainStep {
  id: string;
  key: string;
  castTimeSeconds: number;
  skillCooldownSeconds: number;
  repeatCount?: number;
  independent?: boolean;
  actionType?: 'press';
  hpBelowPercent?: number | null;
}

export interface ComboChain {
  id: string;
  name: string;
  order: number;
  cooldown: number;
  triggerAfterChainId: string;
  steps: ChainStep[];
}

export const DEFAULT_COMBO_CHAINS: ComboChain[] = [
  {
    id: "chain_1",
    name: "Ротация умений",
    order: 1,
    cooldown: 0,
    triggerAfterChainId: "always",
    steps: [
      {
        id: "step_1",
        key: "1",
        castTimeSeconds: 1.5,
        skillCooldownSeconds: 0,
        repeatCount: 1,
        independent: false,
        actionType: 'press',
      },
      {
        id: "step_2",
        key: "3",
        castTimeSeconds: 1.5,
        skillCooldownSeconds: 0,
        repeatCount: 1,
        independent: false,
        actionType: 'press',
      },
    ],
  },
];
