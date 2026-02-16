"use client";

import { useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from "@/firebase";
import { collection, query, orderBy } from 'firebase/firestore';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { format } from "date-fns";
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrency } from '@/context/currency-context';
import { cn } from '@/lib/utils';
import { 
    ArrowDownCircle, 
    ArrowUpCircle, 
    TrendingUp, 
    TrendingDown, 
    Award, 
    Gift, 
    Send, 
    Hourglass, 
    XCircle, 
    History,
    Edit
} from 'lucide-react';

type Transaction = {
  id: string;
  transactionDate: string;
  type: string;
  amount: number;
  description: string;
  status: 'completed' | 'pending' | 'failed';
  referenceNumber?: string;
};

type DepositRequest = {
  id: string;
  userId: string;
  requestDate: string;
  amount: number;
  networkName: string;
  status: 'pending' | 'approved' | 'rejected';
}

const StatusIndicator = ({ status }: { status: string }) => {
    let config: { label: string; textColor: string };

    switch (status.toLowerCase()) {
      case "completed":
      case "approved":
        config = { label: "Exitoso", textColor: "text-green-600" };
        break;
      case "pending":
      case "in_progress":
        config = { label: "Pendiente", textColor: "text-yellow-600" };
        break;
      case "failed":
      case "rejected":
        config = { label: "Rechazado", textColor: "text-red-600" };
        break;
      default:
        config = { label: status, textColor: "text-gray-500" };
    }
  
    return (
      <span className={cn('text-xs font-semibold', config.textColor)}>
        {config.label}
      </span>
    );
};


const TransactionIcon = ({ type, status, amount, description }: { type: string; status: string; amount: number; description: string }) => {
    const isPositive = amount > 0;
    const effectiveStatus = status.toLowerCase();

    let IconComponent: React.ElementType = History;
    let iconColor = "text-gray-500";
    let bgColor = "bg-gray-100";

    if (description.startsWith("Corrección de saldo")) {
        IconComponent = Edit;
        iconColor = isPositive ? "text-green-600" : "text-red-600";
        bgColor = isPositive ? "bg-green-100" : "bg-red-100";
    } else if (effectiveStatus === 'pending') {
        IconComponent = (type === 'withdrawal-request') ? Send : Hourglass;
        iconColor = "text-yellow-600";
        bgColor = "bg-yellow-100";
    } else if (effectiveStatus === 'failed' || effectiveStatus === 'rejected') {
        IconComponent = XCircle;
        iconColor = "text-red-600";
        bgColor = "bg-red-100";
    } else if (effectiveStatus === 'completed' || effectiveStatus === 'approved') {
        if (isPositive) {
            iconColor = "text-green-600";
            bgColor = "bg-green-100";
            switch(type) {
                case 'deposit-approved':
                case 'Deposit':
                    IconComponent = ArrowDownCircle;
                    break;
                case 'investment-earning':
                    IconComponent = TrendingUp;
                    break;
                case 'referral-commission':
                    IconComponent = Award;
                    break;
                case 'deposit-bonus':
                    IconComponent = Gift;
                    break;
                default:
                    IconComponent = ArrowDownCircle;
            }
        } else { // Negative amount
            iconColor = "text-red-600";
            bgColor = "bg-red-100";
             switch(type) {
                case 'investment-start':
                    IconComponent = TrendingDown;
                    break;
                case 'withdrawal-request':
                case 'Withdrawal':
                    IconComponent = ArrowUpCircle;
                    break;
                default:
                    IconComponent = ArrowUpCircle;
            }
        }
    }

    return (
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', bgColor)}>
            <IconComponent className={cn('h-5 w-5', iconColor)} />
        </div>
    );
};


function TransactionRowSkeleton() {
  return (
    <div className="flex items-center space-x-4 p-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-grow space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
        </div>
        <div className="text-right space-y-2">
            <Skeleton className="h-5 w-16 ml-auto" />
            <Skeleton className="h-4 w-20 ml-auto" />
        </div>
    </div>
  )
}

export default function TransactionsPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { formatCurrency } = useCurrency();

  const mainWalletQuery = useMemoFirebase(() => 
    user ? query(collection(firestore, `users/${user.uid}/wallets`)) : null, 
    [user, firestore]
  );
  const { data: wallets } = useCollection(mainWalletQuery);
  const mainWallet = wallets?.[0];

  const transactionsQuery = useMemoFirebase(() => 
    user && mainWallet ? query(collection(firestore, `users/${user.uid}/wallets/${mainWallet.id}/transactions`), orderBy("transactionDate", "desc")) : null, 
    [user, mainWallet, firestore]
  );
  const { data: transactions, isLoading: isLoadingTransactions } = useCollection<Transaction>(transactionsQuery);

  const depositRequestsQuery = useMemoFirebase(() =>
    user ? query(collection(firestore, 'depositRequests'), orderBy("requestDate", "desc")) : null,
    [user, firestore]
  );
  const { data: depositRequests, isLoading: isLoadingRequests } = useCollection<DepositRequest>(depositRequestsQuery);
  
  const userDepositRequests = useMemo(() => {
    if (!depositRequests || !user) return [];
    return depositRequests.filter(req => req.userId === user.uid);
  }, [depositRequests, user]);
  
  const combinedHistory = useMemo(() => {
    const transactionItems = (transactions || []).map(t => {
        let description = (t.description || '').replace(/(\S+)@email\.com/g, '$1');

        if (t.type === 'deposit-approved' && t.referenceNumber) {
          description = `Depósito aprobado (Ref: ${t.referenceNumber})`;
        } else if (t.type === 'withdrawal-request') {
          description = `Solicitud de retiro`
        }

        return {
          id: t.id,
          date: t.transactionDate,
          description: description,
          amount: t.amount,
          status: t.status as 'completed' | 'pending' | 'failed',
          type: t.type,
          isNequi: false,
        }
      });
      
    const pendingAndRejectedDeposits = (userDepositRequests || [])
      .filter(req => req.status === 'pending' || req.status === 'rejected')
      .map(req => ({
        id: req.id,
        date: req.requestDate,
        description: `Solicitud de depósito via ${req.networkName}`,
        amount: req.amount,
        status: req.status as 'pending' | 'rejected',
        type: 'deposit' as const,
        isNequi: req.networkName.toLowerCase().includes('nequi'),
      }));
      
    const allItems: (typeof transactionItems[0] | typeof pendingAndRejectedDeposits[0])[] = [...transactionItems, ...pendingAndRejectedDeposits];
    allItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return allItems;
  }, [transactions, userDepositRequests]);

  const isLoading = isLoadingTransactions || isLoadingRequests;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2">
            <History className="h-7 w-7"/> Historial de Transacciones
        </h1>
        <p className="text-muted-foreground">
          Revisa el registro completo de tus movimientos.
        </p>
      </div>
      <Card>
        <CardContent className="pt-6">
          {!isLoading && combinedHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 text-center border-2 border-dashed rounded-lg p-12">
              <h3 className="text-2xl font-bold tracking-tight">
                No tienes transacciones
              </h3>
              <p className="text-sm text-muted-foreground">
                Comienza a depositar fondos para ver tu historial.
              </p>
            </div>
          ) : (
             <div className="space-y-2">
                {isLoading ? (
                  <>
                    <TransactionRowSkeleton />
                    <TransactionRowSkeleton />
                    <TransactionRowSkeleton />
                    <TransactionRowSkeleton />
                    <TransactionRowSkeleton />
                  </>
                ) : (
                   combinedHistory.map((item) => {
                       const isNequiDepositRequest = item.type === 'deposit' && item.isNequi;
                        let amountDisplay;

                        if (isNequiDepositRequest) {
                            amountDisplay = formatCurrency(item.amount, { currency: 'COP', isValueInSourceCurrency: true });
                        } else if (item.amount > 0) {
                            const prefix = item.type !== 'deposit' ? '+' : '';
                            amountDisplay = `${prefix}${formatCurrency(item.amount, { currency: 'USD' })}`;
                        } else {
                            amountDisplay = formatCurrency(item.amount, { currency: 'USD' });
                        }

                       return (
                            <div key={item.id} className="flex items-center space-x-4 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                                <TransactionIcon type={item.type} status={item.status} amount={item.amount} description={item.description} />
                                <div className="flex-grow">
                                    <p className="font-semibold text-sm">{item.description}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {format(new Date(item.date), "d MMMM yyyy, HH:mm", { locale: es })}
                                    </p>
                                </div>
                                <div className="text-right">
                                <p className={`font-bold text-md ${item.amount > 0 ? 'text-green-600' : item.amount < 0 ? 'text-red-600' : 'text-foreground'}`}>
                                    {amountDisplay}
                                </p>
                                <StatusIndicator status={item.status} />
                                </div>
                            </div>
                        )
                    })
                )}
             </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    