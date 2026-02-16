export type Transaction = {
  id: string;
  date: string;
  type: 'Sent' | 'Received';
  asset: string;
  amount: number;
  usdValue: number;
  address: string;
  status: 'Completed' | 'Pending' | 'Failed';
};

export const mockTransactions: Transaction[] = [];

export type Address = {
  id: string;
  name: string;
  address: string;
  asset: 'BTC' | 'ETH' | 'USDT';
};

export const mockAddresses: Address[] = [];
