"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  PlusCircle,
  Send,
  Users2,
  Copy,
  ArrowDownLeft,
  ArrowUpRight,
  History,
  Wallet
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import Link from 'next/link';

import { useFirestore, useMemoFirebase, useUser, useDoc, useCollection } from "@/firebase";
import { doc, collection, query, orderBy, limit } from "firebase/firestore";
import { useCurrency } from "@/context/currency-context";
import { generateReferralCodeFromUID } from "@/lib/referral";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import type { Transaction, UserProfile as UserProfileType } from '@/lib/types';

const ReferralSection = () => {
    const { user } = useUser();
    const { toast } = useToast();
    const [referralLink, setReferralLink] = useState('');

    useEffect(() => {
        if (user) {
            const ownReferralCode = generateReferralCodeFromUID(user.uid);
            const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
            setReferralLink(`${baseUrl}/?ref=${ownReferralCode}`);
        }
    }, [user]);

    const handleCopy = () => {
        if (!referralLink) return;
        navigator.clipboard.writeText(referralLink);
        toast({
            title: "Enlace copiado",
            description: "Tu enlace de referido ha sido copiado.",
        })
    };

    return (
        <Card className="h-full border-2 border-primary">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Users2 className="text-primary" /> Invita y Gana</CardTitle>
                <CardDescription>Comparte tu enlace de referido y gana comisiones.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex space-x-2">
                    <Input value={referralLink} readOnly placeholder="Generando tu enlace..." />
                    <Button onClick={handleCopy} variant="outline" size="icon">
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

const RecentTransactions = () => {
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
        user && mainWallet ? query(collection(firestore, `users/${user.uid}/wallets/${mainWallet.id}/transactions`), orderBy("transactionDate", "desc"), limit(5)) : null, 
        [user, mainWallet, firestore]
    );
    const { data: transactions, isLoading } = useCollection<Transaction>(transactionsQuery);

    return (
        <Card className="h-full border-2 border-primary">
            <CardHeader>
                <CardTitle>Actividad Reciente</CardTitle>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                           <div key={i} className="flex items-center space-x-4">
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-[150px]" />
                                    <Skeleton className="h-4 w-[100px]" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (!transactions || transactions.length === 0) ? (
                     <div className="text-center text-muted-foreground py-8">
                        <History className="mx-auto h-12 w-12 text-gray-400" />
                        <p className="mt-2 text-sm">No hay transacciones recientes.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {transactions?.map(t => (
                            <div key={t.id} className="flex items-center">
                                <div className="flex-shrink-0">
                                    <div className="p-2 rounded-full bg-primary/10">
                                       {t.amount > 0 ? <ArrowDownLeft className="h-4 w-4 text-primary" /> : <ArrowUpRight className="h-4 w-4 text-primary" />}
                                    </div>
                                </div>
                                <div className="ml-4 flex-grow">
                                    <p className="text-sm font-medium leading-none">{(t.description || '').replace(/(\S+)@email\.com/g, '$1')}</p>
                                    <p className="text-sm text-muted-foreground">{format(new Date(t.transactionDate), "d MMM, yyyy", { locale: es })}</p>
                                </div>
                                <div className={`ml-auto font-medium ${t.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {t.amount > 0 ? '+' : ''}{formatCurrency(t.amount)}
                                </div>
                            </div>
                        ))}
                         {transactions && transactions.length > 0 &&
                            <Button variant="ghost" className="w-full mt-2 text-primary hover:text-primary" asChild>
                                <Link href="/dashboard/transactions">Ver todo</Link>
                            </Button>
                        }
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function Dashboard() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { formatCurrency } = useCurrency();
  
  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, `users/${user.uid}`) : null),
    [firestore, user]
  );
  const { data: userProfile } = useDoc<UserProfileType>(userDocRef);

  const balanceUSD = userProfile?.balance ?? 0;
  const userName = userProfile?.email?.split('@')[0] ?? 'Usuario';
  
  return (
    <div className="flex flex-1 flex-col gap-6 md:gap-8">
       <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Hola, {userName}</h1>
        <p className="text-muted-foreground">
          Bienvenido de nuevo a tu panel de control.
        </p>
      </div>

      <Card className="shadow-lg col-span-full bg-gradient-to-br from-primary to-blue-700 text-primary-foreground dark:from-primary dark:to-blue-900">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-blue-200 flex items-center gap-2"><Wallet/> Saldo Total</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold">
            {formatCurrency(balanceUSD)}
          </div>
          <p className="text-xs text-blue-200 mt-1">
            Tu valor neto total en la plataforma.
          </p>
        </CardContent>
        <CardFooter className="flex gap-2">
            <Button asChild className="bg-white text-primary hover:bg-white/90">
                <Link href="/dashboard/deposit">
                    <PlusCircle className="mr-2 h-4 w-4"/> Depositar
                </Link>
            </Button>
            <Button asChild variant="ghost" className="hover:bg-white/20 text-white">
                <Link href="/dashboard/addresses">
                    <Send className="mr-2 h-4 w-4"/> Retirar
                </Link>
            </Button>
        </CardFooter>
      </Card>
      
      <div className="grid gap-4 md:grid-cols-2">
        <RecentTransactions />
        <ReferralSection />
      </div>
    </div>
  );
}
