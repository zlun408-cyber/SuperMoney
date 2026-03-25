export type FundCode = string;

export interface PositionInput {
  amount?: number;
  cost?: number;
  estimatedNav?: number;
  shares?: number;
}

export interface PositionSummary {
  isComputable: boolean;
  currentValue: number | null;
  profit: number | null;
}
