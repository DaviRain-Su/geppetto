import { api } from "encore.dev/api";

interface EscrowStatusResponse {
  program_id: string;
  cluster: string;
  status: string;
}

export const status = api(
  { expose: true, method: "GET", path: "/escrow/status" },
  async (): Promise<EscrowStatusResponse> => {
    return {
      program_id: process.env.PROGRAM_ID ?? "",
      cluster: process.env.SOLANA_CLUSTER ?? "devnet",
      status: "ok",
    };
  },
);
