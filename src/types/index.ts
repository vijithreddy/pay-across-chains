export type Tab = "race" | "migration";

export type MigrationCard = {
  title: string;
  description: string;
  evmCode: string;
  tempoCode: string;
  evmHighlight: number[];
  tempoHighlight: number[];
};
