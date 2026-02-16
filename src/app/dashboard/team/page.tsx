'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Users, DollarSign, Copy, User } from 'lucide-react';
import { useCurrency } from '@/context/currency-context';
import type { UserProfile, Transaction } from '@/lib/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { UserPlansModal } from '@/app/dashboard/components/UserPlansModal';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { generateReferralCodeFromUID } from "@/lib/referral";
import { useToast } from "@/hooks/use-toast";


const ReferralSection = () => {
    const { user, isUserLoading } = useUser();
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
            title: "¡Enlace Copiado!",
            description: "Tu enlace de referido ha sido copiado.",
        });
    };

    return (
        <Card className="w-full shadow-lg bg-gradient-to-r from-primary to-blue-700 text-white">
            <CardHeader>
                <div className="flex items-center gap-4">
                    <div className="bg-white/20 p-3 rounded-full">
                        <Users className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <CardTitle className="text-white">Invita y Gana</CardTitle>
                        <CardDescription className="text-blue-200">Comparte tu enlace de referido con amigos.</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div>
                    <Label className="text-blue-200">Tu enlace de referido:</Label>
                    <div className="flex items-center gap-2 mt-1">
                        <Input
                            readOnly
                            value={isUserLoading ? "Cargando..." : referralLink}
                            placeholder="Generando tu enlace..."
                            className="bg-white/10 border-0 text-white placeholder:text-blue-300"
                        />
                        <Button variant="ghost" size="icon" onClick={handleCopy} disabled={!referralLink || isUserLoading} className="hover:bg-white/20">
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

const TeamPage = () => {
  const { user } = useUser();
  const firestore = useFirestore();
  const { formatCurrency } = useCurrency();
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [isPlansModalOpen, setIsPlansModalOpen] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, `users/${user.uid}`) : null),
    [firestore, user]
  );
  const { data: currentUserProfile } = useDoc<UserProfile>(userDocRef);


  const referralsQuery = useMemoFirebase(() => {
    if (!firestore || !currentUserProfile?.referralCode) return null;
    return query(collection(firestore, 'users'), where('referredBy', '==', currentUserProfile.referralCode));
  }, [firestore, currentUserProfile]);
  const { data: referredUsers, isLoading: isLoadingReferrals } = useCollection<UserProfile>(referralsQuery);

    const commissionsQuery = useMemoFirebase(() => {
      if(!firestore || !user) return null;
       const walletRef = collection(firestore, `users/${user.uid}/wallets`);
        return query(walletRef);
    }, [firestore, user]);
    
    const {data: wallets} = useCollection(commissionsQuery);
    const mainWallet = wallets?.[0];

    const commissionTransactionsQuery = useMemoFirebase(() => {
        if(!mainWallet) return null;
        return query(collection(firestore, `users/${user.uid}/wallets/${mainWallet.id}/transactions`), where('type', '==', 'referral-commission'));
    }, [mainWallet]);

    const { data: commissionTransactions } = useCollection<Transaction>(commissionTransactionsQuery);


  const totalCommissions = useMemo(() => {
    return commissionTransactions?.reduce((acc, curr) => acc + curr.amount, 0) || 0;
  }, [commissionTransactions]);

  const teamBalance = useMemo(() => {
    return referredUsers?.reduce((acc, curr) => acc + (curr.balance ?? 0), 0) || 0;
  }, [referredUsers]);

  const handleViewPlans = (referredUser: UserProfile) => {
    setSelectedUser(referredUser);
    setIsPlansModalOpen(true);
  };


  return (
    <>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Mi Equipo de Referidos</h1>
        
        <ReferralSection />

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Referidos Totales</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{referredUsers?.length ?? 0}</div>
              <p className="text-xs text-muted-foreground">Usuarios que has invitado</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Comisiones Ganadas</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalCommissions)}</div>
              <p className="text-xs text-muted-foreground">Ganancias totales por tu equipo</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Balance del Equipo</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(teamBalance)}</div>
              <p className="text-xs text-muted-foreground">Suma de saldos de tus referidos</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Miembros del Equipo</CardTitle>
            <CardDescription>
              Aquí puedes ver los usuarios que se han unido con tu código.
            </CardDescription>
          </CardHeader>
          <CardContent>
              {isLoadingReferrals ? <p>Cargando miembros...</p> : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {referredUsers && referredUsers.length > 0 ? (
                      referredUsers.map(referredUser => (
                      <Card key={referredUser.id} className="flex flex-col">
                        <CardHeader className="flex-row items-center gap-4 pb-4">
                           <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                              <User className="h-5 w-5 text-muted-foreground" />
                           </div>
                           <div>
                              <p className="font-bold">{referredUser.email.split('@')[0]}</p>
                              <p className="text-xs text-muted-foreground">
                                  Registro: {format(new Date((referredUser as any).registrationDate), 'dd MMM yyyy', { locale: es })}
                              </p>
                           </div>
                        </CardHeader>
                        <CardContent className="flex-grow">
                           <div className="flex justify-between items-center p-3 bg-muted rounded-md">
                              <span className="text-sm text-muted-foreground">Balance</span>
                              <span className="font-bold">{formatCurrency(referredUser.balance ?? 0)}</span>
                           </div>
                        </CardContent>
                        <CardFooter>
                            <Button variant="outline" size="sm" className="w-full" onClick={() => handleViewPlans(referredUser)}>
                                Ver Planes
                            </Button>
                        </CardFooter>
                      </Card>
                      ))
                  ) : (
                      <div className="col-span-full text-center text-muted-foreground py-8">
                          Aún no tienes referidos. ¡Comparte tu enlace!
                      </div>
                  )}
              </div>
              )}
          </CardContent>
        </Card>
      </div>
      
      {selectedUser && isPlansModalOpen && (
        <UserPlansModal 
            user={selectedUser}
            isOpen={isPlansModalOpen}
            onOpenChange={setIsPlansModalOpen}
        />
      )}
    </>
  );
};

export default TeamPage;
