"use client";

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc, getDoc, writeBatch, serverTimestamp, increment, getDocs, limit } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/context/currency-context';
import { Briefcase, PiggyBank, BadgePercent, Calendar, CheckCircle, Wallet, AlertCircle, TrendingUp, Clock } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { addDays, format, formatDistanceToNow, isAfter } from 'date-fns';
import { es } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import type { AppConfig, UserProfile, InvestmentPlan as TInvestmentPlan } from '@/lib/types';
import { Label } from '@/components/ui/label';

type InvestmentPlan = TInvestmentPlan;

type UserWallet = {
  id: string;
  balance: number;
};

const InvestDialog = ({ plan, wallet, onInvested }: { plan: InvestmentPlan, wallet: UserWallet | undefined, onInvested: () => void }) => {
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();

  const isFixedPrice = plan.minInvestment && plan.maxInvestment && plan.minInvestment === plan.maxInvestment;
  
  const investmentAmountCop = isFixedPrice ? (plan.minInvestment ?? 0) : (parseFloat(amount) || 0);

  const dailyEarningCop = investmentAmountCop * (plan.dailyReturnPercentage / 100);
  const weeklyEarningCop = dailyEarningCop * 7;
  const monthlyEarningCop = dailyEarningCop * 30;
  const totalEarningCop = dailyEarningCop * plan.durationDays;

  const handleInvest = async () => {
    if (!user || !firestore || !wallet || !investmentAmountCop || investmentAmountCop <= 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'El monto de inversión no es válido.' });
      return;
    }
    if (investmentAmountCop > wallet.balance) {
      toast({ variant: 'destructive', title: 'Fondos insuficientes', description: `Tu saldo es de ${formatCurrency(wallet.balance)}.` });
      return;
    }
    if (plan.minInvestment && investmentAmountCop < plan.minInvestment) {
        toast({ variant: 'destructive', title: 'Monto muy bajo', description: `La inversión mínima para este plan es de ${formatCurrency(plan.minInvestment)}.` });
        return;
    }
    if (plan.maxInvestment && investmentAmountCop > plan.maxInvestment) {
        toast({ variant: 'destructive', title: 'Monto muy alto', description: `La inversión máxima para este plan es de ${formatCurrency(plan.maxInvestment)}.` });
        return;
    }

    setIsLoading(true);
    onInvested(); // Close dialog immediately
    
    try {
      const batch = writeBatch(firestore);
      const startDate = new Date();
      const endDate = addDays(startDate, plan.durationDays);
      const userRef = doc(firestore, `users/${user.uid}`);

      const investmentRef = doc(collection(firestore, 'userInvestments'));
      batch.set(investmentRef, {
        id: investmentRef.id,
        userId: user.uid,
        walletId: wallet.id,
        planName: plan.name,
        investedAmount: investmentAmountCop,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        lastCollectionDate: startDate.toISOString(), 
        isActive: true,
        // Denormalize plan details for safe deletion
        dailyReturnPercentage: plan.dailyReturnPercentage,
        durationDays: plan.durationDays,
        imageUrl: plan.imageUrl || null,
      });

      const walletRef = doc(firestore, `users/${user.uid}/wallets/${wallet.id}`);
      batch.update(walletRef, { balance: increment(-investmentAmountCop) });
      
      batch.update(userRef, { balance: increment(-investmentAmountCop) });

      const transactionRef = doc(collection(firestore, `users/${user.uid}/wallets/${wallet.id}/transactions`));
      batch.set(transactionRef, {
          id: transactionRef.id,
          walletId: wallet.id,
          transactionDate: startDate.toISOString(),
          amount: -investmentAmountCop,
          description: `Inversión en ${plan.name}`,
          type: 'investment-start',
          status: 'completed',
      });

      // Check for referral commission
      const userDoc = await getDoc(userRef);
      const userData = userDoc.data() as UserProfile;

      if(userData.referredBy && userData.hasInvested === false) { // This is the first investment
          const configDoc = await getDoc(doc(firestore, 'app_config', 'main'));
          const appConfig = configDoc.data() as AppConfig;
          const commissionPercentage = appConfig.referralCommissionPercentage || 0;

          if (commissionPercentage > 0) {
              const referrerQuery = query(collection(firestore, 'users'), where('referralCode', '==', userData.referredBy), limit(1));
              const referrerSnap = await getDocs(referrerQuery);
              
              if (!referrerSnap.empty) {
                  const referrer = referrerSnap.docs[0];
                  const commissionAmount = investmentAmountCop * (commissionPercentage / 100);

                  const referrerWalletQuery = query(collection(firestore, 'users', referrer.id, 'wallets'), limit(1));
                  const referrerWalletSnap = await getDocs(referrerWalletQuery);
                  
                  if (!referrerWalletSnap.empty) {
                      const referrerWallet = referrerWalletSnap.docs[0];

                      batch.update(referrer.ref, { balance: increment(commissionAmount) });
                      batch.update(referrerWallet.ref, { balance: increment(commissionAmount) });

                      const commissionTransactionRef = doc(collection(referrerWallet.ref, 'transactions'));
                      batch.set(commissionTransactionRef, {
                          id: commissionTransactionRef.id,
                          walletId: referrerWallet.id,
                          transactionDate: startDate.toISOString(),
                          amount: commissionAmount,
                          description: `Comisión por referido: ${userData.email}`,
                          type: 'referral-commission',
                          status: 'completed'
                      });
                  }
              }
          }
           // Mark that the user has made their first investment
          batch.update(userRef, { hasInvested: true });
      }

      await batch.commit();
      toast({
        title: "¡Inversión Exitosa!",
        description: `Has invertido ${formatCurrency(investmentAmountCop)} en ${plan.name}.`
      });
    } catch (error: any) {
      console.error("Investment failed: ", error);
      toast({ variant: 'destructive', title: 'Error en la inversión', description: error.message || 'No se pudo completar la operación.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Invertir en {plan.name}</DialogTitle>
        <DialogDescription>
          Tu saldo actual es de {formatCurrency(wallet?.balance ?? 0)}.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        {isFixedPrice ? (
             <div className="space-y-2">
                <Label>Precio del Plan</Label>
                <Input 
                    readOnly 
                    disabled 
                    value={formatCurrency(plan.minInvestment || 0)} 
                    className="text-lg font-bold text-foreground"
                />
            </div>
        ) : (
             <div className="space-y-2">
                <Label htmlFor="investment-amount">Monto a Invertir (COP)</Label>
                <Input
                    id="investment-amount"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder={`Mín: ${formatCurrency(plan.minInvestment || 0)} - Máx: ${formatCurrency(plan.maxInvestment || Infinity)}`}
                />
            </div>
        )}

        {investmentAmountCop > 0 && (
            <Card className="bg-muted">
                <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" />
                        Proyección de Ganancias
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-2 space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Ganancia Diaria</span>
                        <span className="font-bold text-green-600">{formatCurrency(dailyEarningCop)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Ganancia Semanal</span>
                        <span className="font-bold text-green-600">{formatCurrency(weeklyEarningCop)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Ganancia Mensual (30 días)</span>
                        <span className="font-bold text-green-600">{formatCurrency(monthlyEarningCop)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Ganancia Total</span>
                        <span className="font-bold text-green-600">{formatCurrency(totalEarningCop)}</span>
                    </div>
                </CardContent>
            </Card>
        )}
        <Button onClick={handleInvest} disabled={isLoading || investmentAmountCop <= 0} className="w-full">
          {isLoading ? 'Procesando...' : `Confirmar Inversión por ${formatCurrency(investmentAmountCop)}`}
        </Button>
      </div>
    </DialogContent>
  );
};


export default function PlansPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { formatCurrency } = useCurrency();
    const [selectedPlan, setSelectedPlan] = useState<InvestmentPlan | null>(null);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    
    const plansQuery = useMemoFirebase(
        () => (firestore ? query(collection(firestore, "investmentPlans"), where("isActive", "==", true)) : null),
        [firestore]
    );
    const { data: plans, isLoading: isLoadingPlans } = useCollection<InvestmentPlan>(plansQuery);

    const availablePlans = useMemo(() => {
        if (!plans) return [];
        const now = new Date();
        return plans
            .filter(plan => {
                if (!plan.isActive) return false;
                const startDate = plan.availabilityStartDate ? new Date(plan.availabilityStartDate) : null;
                const endDate = plan.availabilityEndDate ? new Date(plan.availabilityEndDate) : null;

                if (startDate && isAfter(now, startDate) === false) return false;
                if (endDate && isAfter(now, endDate)) return false;

                return true;
            })
            .sort((a, b) => {
                const aHasEndDate = !!a.availabilityEndDate;
                const bHasEndDate = !!b.availabilityEndDate;

                if (aHasEndDate && !bHasEndDate) {
                    return -1; // a comes first
                }
                if (!aHasEndDate && bHasEndDate) {
                    return 1; // b comes first
                }

                // If both have or don't have end dates, sort by price
                return (a.minInvestment || 0) - (b.minInvestment || 0);
            });
    }, [plans]);

    const walletsQuery = useMemoFirebase(
      () => (user ? query(collection(firestore, `users/${user.uid}/wallets`)) : null),
      [firestore, user]
    );
    const { data: wallets } = useCollection<UserWallet>(walletsQuery);
    const mainWallet = wallets?.[0];

    const handlePlanClick = (plan: InvestmentPlan) => {
        setSelectedPlan(plan);
        setIsDialogOpen(true);
    };

    const getPlanLimitText = (plan: InvestmentPlan) => {
        if (plan.minInvestment && plan.maxInvestment && plan.minInvestment === plan.maxInvestment) {
            return formatCurrency(plan.minInvestment, { minimumFractionDigits: 0 });
        }
        if (plan.minInvestment && plan.maxInvestment) {
          return `${formatCurrency(plan.minInvestment, { minimumFractionDigits: 0})} - ${formatCurrency(plan.maxInvestment, { minimumFractionDigits: 0})}`;
        }
        if (plan.minInvestment) {
          return `Desde ${formatCurrency(plan.minInvestment, { minimumFractionDigits: 0})}`;
        }
        if (plan.maxInvestment) {
          return `Hasta ${formatCurrency(plan.maxInvestment, { minimumFractionDigits: 0})}`;
        }
        return 'Flexible';
    }


  return (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight font-headline text-primary">Elige tu Estrategia de Inversión</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
            Descubre nuestros planes de inversión diseñados para adaptarse a tus metas financieras. Cada plan ofrece un retorno diario competitivo.
        </p>
      </div>

      <div className="space-y-4">
        {isLoadingPlans && <p className="text-center">Cargando planes...</p>}
        {!isLoadingPlans && (!availablePlans || availablePlans.length === 0) ? (
          <p className="text-muted-foreground text-center">No hay planes de inversión disponibles en este momento.</p>
        ) : (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
              {availablePlans?.map((plan) => {
                const isFixedPrice = plan.minInvestment && plan.maxInvestment && plan.minInvestment === plan.maxInvestment;
                const investmentAmountCop = plan.minInvestment ?? 0;
                const dailyEarningCop = investmentAmountCop * (plan.dailyReturnPercentage / 100);
                const weeklyEarningCop = dailyEarningCop * 7;
                const monthlyEarningCop = dailyEarningCop * 30;
                const totalEarningCop = dailyEarningCop * plan.durationDays;

                return (
                    <DialogTrigger key={plan.id} asChild>
                        <Card onClick={() => handlePlanClick(plan)} className="cursor-pointer overflow-hidden group transition-all hover:shadow-xl hover:-translate-y-1 rounded-lg flex flex-col border-2 border-primary">
                            <CardContent className="p-3 space-y-3 flex flex-col flex-grow">
                                <div className="flex justify-center pt-2">
                                     <Image
                                        src={plan.imageUrl || `https://picsum.photos/seed/${plan.id}/100/100`}
                                        alt={plan.name}
                                        width={100}
                                        height={100}
                                        className="rounded-lg object-cover aspect-square transition-transform group-hover:scale-105"
                                    />
                                </div>
                                <div className="text-center">
                                     <h3 className="text-lg font-bold">{plan.name}</h3>
                                     {plan.availabilityEndDate && (
                                        <Badge variant="destructive" className="mt-1">
                                            Termina {formatDistanceToNow(new Date(plan.availabilityEndDate), { locale: es, addSuffix: true })}
                                        </Badge>
                                    )}
                                </div>
                    
                                 <div className="p-3 rounded-md bg-muted text-center">
                                    <p className="text-xs text-muted-foreground">{isFixedPrice ? 'Precio del Plan' : 'Inversión'}</p>
                                    <p className="text-xl font-bold text-primary">{getPlanLimitText(plan)}</p>
                                </div>
                    
                                <div className="border rounded-lg p-3 space-y-2 flex-grow">
                                    <div className="space-y-1 text-xs">
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground flex items-center gap-1"><BadgePercent className="h-3 w-3" /> Retorno Diario</span>
                                            <span className="font-semibold">{plan.dailyReturnPercentage}%</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3" /> Duración</span>
                                            <span className="font-semibold">{plan.durationDays} días</span>
                                        </div>
                                    </div>
                    
                                    {isFixedPrice && investmentAmountCop > 0 && (
                                        <div className="pt-2">
                                             <p className="font-semibold text-center text-muted-foreground mb-2 flex items-center justify-center gap-1 text-xs">
                                                <TrendingUp className="h-4 w-4 text-primary" />
                                                Proyección
                                            </p>
                                            <div className="space-y-1 text-[10px]">
                                                 <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Diaria</span>
                                                    <span className="font-bold text-green-600">{formatCurrency(dailyEarningCop)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Semanal</span>
                                                    <span className="font-bold text-green-600">{formatCurrency(weeklyEarningCop)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Mensual (30 días)</span>
                                                    <span className="font-bold text-green-600">{formatCurrency(monthlyEarningCop)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Total</span>
                                                    <span className="font-bold text-green-600">{formatCurrency(totalEarningCop)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                    
                                <Button variant="default" size="sm" className="w-full font-bold mt-auto">
                                    Invertir Ahora
                                </Button>
                            </CardContent>
                        </Card>
                    </DialogTrigger>
                )
            })}
            </div>
            {selectedPlan && mainWallet && <InvestDialog plan={selectedPlan} wallet={mainWallet} onInvested={() => setIsDialogOpen(false)} />}
          </Dialog>
        )}
      </div>
    </div>
  );
}
