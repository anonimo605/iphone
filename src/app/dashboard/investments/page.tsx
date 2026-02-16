"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc, writeBatch, getDoc, increment, getDocs, limit } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/context/currency-context';
import { Zap, Clock, Activity, DollarSign, Calendar } from 'lucide-react';
import { differenceInHours } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import type { UserInvestment, UserProfile, AppConfig } from '@/lib/types';


const ActiveInvestmentCard = ({ investment, onClaimSuccess }: { investment: UserInvestment, onClaimSuccess: () => void }) => {
    const { formatCurrency, appConfig } = useCurrency();
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [timeRemaining, setTimeRemaining] = useState('');
    const [canCollect, setCanCollect] = useState(false);

    const dailyEarning = investment.investedAmount * (investment.dailyReturnPercentage / 100);
    const totalEarning = dailyEarning * investment.durationDays;

    useEffect(() => {
        const interval = setInterval(() => {
            const now = new Date();
            if (!investment.lastCollectionDate) {
                setTimeRemaining("Sincronizando...");
                setCanCollect(false);
                return;
            }
            const lastCollection = new Date(investment.lastCollectionDate);
            const collectionReadyDate = new Date(lastCollection.getTime() + 24 * 60 * 60 * 1000);
            
            if (now >= collectionReadyDate) {
                setCanCollect(true);
                setTimeRemaining("Listo para recolectar");
                clearInterval(interval);
            } else {
                setCanCollect(false);
                const diff = collectionReadyDate.getTime() - now.getTime();
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                setTimeRemaining(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [investment.lastCollectionDate]);


    const handleCollect = async () => {
        if (!user || !firestore || !canCollect || !appConfig) {
             toast({ variant: 'destructive', title: 'Error', description: 'No se puede recolectar en este momento.' });
             return;
        }

        setIsLoading(true);
        try {
            const hoursSinceLastCollection = investment.lastCollectionDate ? differenceInHours(new Date(), new Date(investment.lastCollectionDate)) : 24;
            if(hoursSinceLastCollection < 24) {
                 toast({ variant: 'destructive', title: 'Aún no puedes recolectar', description: `Espera el tiempo restante.` });
                 setIsLoading(false);
                 return;
            }

            if (dailyEarning <= 0) {
                 throw new Error("No se pudo calcular la ganancia diaria.");
            }

            const batch = writeBatch(firestore);
            const now = new Date().toISOString();
            
            const investmentRef = doc(firestore, 'userInvestments', investment.id);
            batch.update(investmentRef, { lastCollectionDate: now });
            
            const walletRef = doc(firestore, `users/${user.uid}/wallets/${investment.walletId}`);
            batch.update(walletRef, { balance: increment(dailyEarning) });
            
            const userRef = doc(firestore, `users/${user.uid}`);
            batch.update(userRef, { balance: increment(dailyEarning) });

            const transactionRef = doc(collection(firestore, `users/${user.uid}/wallets/${investment.walletId}/transactions`));
            batch.set(transactionRef, {
                id: transactionRef.id,
                walletId: investment.walletId,
                transactionDate: now,
                amount: dailyEarning,
                description: `Ganancia diaria de ${investment.planName}`,
                type: 'investment-earning',
                status: 'completed'
            });
            
             // Residual earning for referrer
            const userDoc = await getDoc(userRef);
            const userData = userDoc.data() as UserProfile;

            if (userData.referredBy && appConfig.earningsClaimCommissionEnabled && appConfig.earningsClaimCommissionPercentage && appConfig.earningsClaimCommissionPercentage > 0) {
                 const commissionPercentage = appConfig.earningsClaimCommissionPercentage / 100;
                 const commissionAmount = dailyEarning * commissionPercentage;

                const referrerQuery = query(collection(firestore, 'users'), where('referralCode', '==', userData.referredBy), limit(1));
                const referrerSnap = await getDocs(referrerQuery);

                if (!referrerSnap.empty && commissionAmount > 0) {
                    const referrerDoc = referrerSnap.docs[0];
                    const referrerWalletQuery = query(collection(firestore, 'users', referrerDoc.id, 'wallets'), limit(1));
                    const referrerWalletSnap = await getDocs(referrerWalletQuery);

                     if (!referrerWalletSnap.empty) {
                        const referrerWalletDoc = referrerWalletSnap.docs[0];
                        batch.update(referrerDoc.ref, { balance: increment(commissionAmount) });
                        batch.update(referrerWalletDoc.ref, { balance: increment(commissionAmount) });

                        const commissionTransactionRef = doc(collection(referrerWalletDoc.ref, 'transactions'));
                        batch.set(commissionTransactionRef, {
                            id: commissionTransactionRef.id,
                            walletId: referrerWalletDoc.id,
                            transactionDate: now,
                            amount: commissionAmount,
                            description: `Comisión por ganancia de referido: ${userData.email.split('@')[0]}`,
                            type: 'referral-commission',
                            status: 'completed'
                        });
                    }
                }
            }


            await batch.commit();
            toast({ title: '¡Ganancias Recolectadas!', description: `Has ganado ${formatCurrency(dailyEarning)}.` });
            onClaimSuccess();
        } catch (error: any) {
            console.error('Collection failed:', error);
            toast({ variant: 'destructive', title: 'Error al recolectar', description: error.message });
        } finally {
            setIsLoading(false);
        }
    };

     if (!investment.lastCollectionDate || !investment.endDate) {
        return (
             <Card className="bg-card/50 overflow-hidden">
                <CardContent className="p-6 text-center text-muted-foreground">
                    Sincronizando datos del plan...
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="bg-card/50 overflow-hidden">
             <div className="relative aspect-video w-full">
                <Image src={investment.imageUrl || `https://picsum.photos/seed/${investment.id}/600/400`} alt={investment.planName} fill style={{objectFit: 'cover'}} />
            </div>
            <div className='p-6'>
                <CardHeader className="p-0 pb-4">
                    <CardTitle className="flex justify-between items-center">
                        <span>{investment.planName}</span>
                        <Badge variant="default">Activo</Badge>
                    </CardTitle>
                    <CardDescription>Invertido: {formatCurrency(investment.investedAmount)}</CardDescription>
                </CardHeader>
                <CardContent className="p-0 space-y-4">
                     <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground flex items-center gap-1.5"><DollarSign className="h-4 w-4" /> Ganancia Diaria</span>
                            <span className="font-bold">{formatCurrency(dailyEarning)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Ganancia Total del Ciclo</span>
                            <span className="font-bold">{formatCurrency(totalEarning)}</span>
                        </div>
                    </div>

                    <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                            <Clock className="h-5 w-5 text-primary"/>
                            <span className="text-sm font-medium">Próxima recolección:</span>
                        </div>
                        <span className="text-sm font-bold">{timeRemaining}</span>
                    </div>

                    <Button onClick={handleCollect} disabled={!canCollect || isLoading} className="w-full">
                        <Zap className="mr-2 h-4 w-4"/>
                        {isLoading ? 'Recolectando...' : 'Recolectar Ganancias'}
                    </Button>

                     <div className="text-xs text-muted-foreground text-center">
                        Vence el {new Date(investment.endDate).toLocaleDateString('es-ES')}
                    </div>
                </CardContent>
            </div>
        </Card>
    )
}

export default function InvestmentsPage() {
    const { user } = useUser();
    const firestore = useFirestore();
    const [key, setKey] = useState(0); // Add a key to force re-fetch
    const forceRefetch = () => setKey(prev => prev + 1);

    const userInvestmentsQuery = useMemoFirebase(
      () => (user ? query(collection(firestore, 'userInvestments'), where('userId', '==', user.uid), where('isActive', '==', true)) : null),
      [firestore, user, key] // Add key to dependencies
    );
    const { data: activeInvestments, isLoading: isLoadingInvestments } = useCollection<UserInvestment>(userInvestmentsQuery);

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2"><Activity/> Mis Inversiones Activas</h1>
                <p className="text-muted-foreground">
                    Gestiona tus inversiones activas y recolecta tus ganancias diarias.
                </p>
            </div>

            {isLoadingInvestments && <p>Cargando tus inversiones...</p>}
            
            {activeInvestments && activeInvestments.length > 0 ? (
                <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        {activeInvestments.map(inv => <ActiveInvestmentCard key={inv.id} investment={inv} onClaimSuccess={forceRefetch} />)}
                    </div>
                </div>
            ) : !isLoadingInvestments && (
                 <div className="flex flex-col items-center justify-center gap-4 text-center border-2 border-dashed rounded-lg p-12 mt-4">
                    <h3 className="text-2xl font-bold tracking-tight">No tienes inversiones activas</h3>
                    <p className="text-sm text-muted-foreground">
                        Visita la sección de "Invertir" para empezar a invertir.
                    </p>
                </div>
            )}
        </div>
    );
}
