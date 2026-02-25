export interface CreditData {
  current: number;
}

export interface CreditsContextValue {
  credits: CreditData | null;
  isLoading: boolean;
  fetchCredits: (userId: string) => Promise<void>;
  hasFetchedCredits: boolean;
  checkCreditsForService: (
    serviceName: string,
  ) => Promise<{ hasEnough: boolean; requiredCredits: number; currentCredits: number }>;
  updateCreditsLocally: (newCredits: number) => void;
  deductCreditsLocally: (amount: number) => void;
}
