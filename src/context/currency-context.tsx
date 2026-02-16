'use client';

import React, { createContext, useState, useContext, useMemo, type ReactNode, useEffect } from 'react';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { AppConfig } from '@/lib/types';


type Currency = 'USD' | 'COP';

interface CurrencyContextType {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  formatCurrency: (value: number, options?: Intl.NumberFormatOptions) => string;
  isLoadingRate: boolean;
  appConfig: AppConfig | null;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<Currency>('COP');
  const firestore = useFirestore();

  const currencyConfigRef = useMemoFirebase(() => {
      if (!firestore) return null;
      return doc(firestore, 'app_config', 'main');
  }, [firestore]);
  const { data: appConfig, isLoading: isLoadingConfig } = useDoc<AppConfig>(currencyConfigRef);

  const formatCurrency = useMemo(() => (value: number, options: Intl.NumberFormatOptions = {}) => {
    const displayCurrency = 'COP'; // Always COP
    
    const defaultOptions: Intl.NumberFormatOptions = {
      style: 'currency',
      currency: displayCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    };

    const finalOptions = { ...defaultOptions, ...options };
    
    const locale = 'es-CO';
    
    return new Intl.NumberFormat(locale, finalOptions).format(value);

  }, []);

  const value = {
    currency,
    setCurrency,
    formatCurrency,
    isLoadingRate: isLoadingConfig,
    appConfig: appConfig ?? null,
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
