'use client';

import type { Timestamp } from 'firebase/firestore';

export interface UserProfile {
    id: string;
    email: string;
    balance?: number;
    referredBy?: string | null;
    referralCode?: string;
    isSuperAdmin?: boolean;
    isDepositAdmin?: boolean;
    withdrawalNequi?: string;
    nequiOwnerName?: string;
    hasInvested?: boolean;
}

export interface UserWallet {
    id: string;
    userId: string;
    name: string;
    balance: number;
    creationDate: string;
}

export interface Transaction {
    id: string;
    walletId: string;
    type: 'deposit-approved' | 'investment-start' | 'investment-earning' | 'Withdrawal' | 'Deposit' | 'Reward' | 'referral-commission' | 'withdrawal-request' | 'deposit-bonus';
    amount: number;
    transactionDate: string; 
    description: string;
    status: 'Completed' | 'Pending' | 'Failed' | 'completed' | 'pending' | 'failed';
    referenceNumber?: string;
}


export interface InvestmentPlan {
    id: string;
    name: string;
    durationDays: number;
    dailyReturnPercentage: number;
    isActive: boolean;
    minInvestment?: number;
    maxInvestment?: number;
    availabilityStartDate?: string | null;
    availabilityEndDate?: string | null;
    imageUrl?: string;
};

export type UserInvestment = {
  id: string;
  userId: string;
  walletId: string;
  planId: string;
  planName: string; 
  investedAmount: number;
  startDate: string;
  endDate: string;
  lastCollectionDate: string;
  isActive: boolean;
  // Denormalized fields
  dailyReturnPercentage: number;
  durationDays: number;
  imageUrl?: string;
};

export type WithdrawalRequest = {
    id: string;
    userId: string;
    userEmail: string;
    netAmount: number;
    feeAmount: number;
    totalAmount: number;
    method: 'Nequi';
    walletAddress: string;
    status: 'pending' | 'approved' | 'rejected' | 'in_progress';
    requestDate: any; // Using `any` to accommodate both string and Timestamp
    processedAt?: Timestamp;
    transactionId: string;
    nequiOwnerName?: string;
    adminId?: string;
    decisionDate?: string;
};

export type WithdrawalConfig = {
    minWithdrawal: number;
    feePercentage: number;
    allowedDays: string[]; // e.g., ["Monday", "Tuesday"]
    startTime: string; // e.g., "09:00"
    endTime: string;   // e.g., "17:00"
    dailyLimit: number;
};

export type AppConfig = {
    cop_exchange_rate?: number;
    referralCommissionPercentage?: number;
    support_whatsapp_group?: string;
    support_whatsapp_number?: string;
    support_telegram_group?: string;
    announcement_message?: string;
    announcement_enabled?: boolean;
    apkDownloadUrl?: string;
    earningsClaimCommissionPercentage?: number;
    earningsClaimCommissionEnabled?: boolean;
    predefinedDepositAmounts?: number[];
    registrationBonus?: number;
    registrationBonusEnabled?: boolean;
};

export interface DepositBonusConfig {
    isActive: boolean;
    percentage: number;
}

export interface TutorialImage {
    url: string;
    caption?: string;
}

export interface AppTutorial {
    id: string;
    title: string;
    content: string;
    order: number;
    images?: TutorialImage[];
}
