
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection, useMemoFirebase, errorEmitter, useUser } from '@/firebase';
import { collection, query, where, doc, writeBatch, increment, getDoc } from 'firebase/firestore';
import type { UserProfile, UserInvestment, Transaction } from '@/lib/types';
import { useCurrency } from '@/context/currency-context';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { FirestorePermissionError } from '@/firebase/errors';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

export function UserPlansModal({ user, isOpen, onOpenChange }: { user: UserProfile, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
    const firestore = useFirestore();
    const { formatCurrency } = useCurrency();
    const { toast } = useToast();
    const [isDeleting, setIsDeleting] = useState<string | null>(null);

    const { user: currentUser } = useUser();
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

    const [key, setKey] = useState(0);
    const forceRefetch = () => setKey(prev => prev + 1);

    useEffect(() => {
        const checkAdminStatus = async () => {
            if (currentUser && firestore) {
                const userDocRef = doc(firestore, 'users', currentUser.uid);
                try {
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        if (userData.isSuperAdmin === true) {
                            setIsSuperAdmin(true);
                        } else {
                            setIsSuperAdmin(false);
                        }
                    } else {
                        setIsSuperAdmin(false);
                    }
                } catch (e) {
                    setIsSuperAdmin(false);
                }
            } else {
                setIsSuperAdmin(false);
            }
        };
        checkAdminStatus();
    }, [currentUser, firestore]);

    const activePlansQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'userInvestments'), where('userId', '==', user.id));
    }, [firestore, user.id, key]);

    const { data: activePlans, isLoading } = useCollection<UserInvestment>(activePlansQuery);
    
    const handleDeletePlan = async (plan: UserInvestment) => {
        if (!firestore) return;
        setIsDeleting(plan.id);
        try {
            const batch = writeBatch(firestore);

            const userRef = doc(firestore, 'users', user.id);
            const walletRef = doc(firestore, `users/${user.id}/wallets/${plan.walletId}`);
            const planRef = doc(firestore, 'userInvestments', plan.id);

            batch.update(userRef, {
                balance: increment(plan.investedAmount)
            });
            batch.update(walletRef, {
                balance: increment(plan.investedAmount)
            });
            
            batch.delete(planRef);
            
            const transactionRef = doc(collection(firestore, `users/${user.id}/wallets/${plan.walletId}/transactions`));
            const transactionData: Omit<Transaction, 'id' | 'status'> & { status: 'completed' } = {
                walletId: plan.walletId,
                type: 'Deposit',
                amount: plan.investedAmount,
                transactionDate: new Date().toISOString(),
                description: `Reembolso por plan eliminado: ${plan.planName}`,
                status: 'completed'
            };
            batch.set(transactionRef, {...transactionData, id: transactionRef.id});

            await batch.commit();

            toast({
                title: 'Plan Eliminado',
                description: `Se ha reembolsado ${formatCurrency(plan.investedAmount)} al balance del usuario.`,
            });
            forceRefetch();

        } catch (error) {
            console.error("Error deleting plan:", error);
            const permissionError = new FirestorePermissionError({
                path: `userInvestments/${plan.id}`,
                operation: 'delete',
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo eliminar el plan.' });
        } finally {
            setIsDeleting(null);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[625px]">
                <DialogHeader>
                    <DialogTitle>Planes de Inversión de {(user.email || '').split('@')[0]}</DialogTitle>
                    <DialogDescription>
                        Visualiza y gestiona los planes de inversión del usuario.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    {isLoading && <p>Cargando planes...</p>}
                    {!isLoading && (!activePlans || activePlans.length === 0) ? (
                        <p className="text-muted-foreground text-center">Este usuario no tiene planes de inversión.</p>
                    ) : (
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {activePlans?.map(plan => (
                                <div key={plan.id} className="flex justify-between items-center p-3 border rounded-lg">
                                    <div>
                                        <p className="font-bold">{plan.planName} - {formatCurrency(plan.investedAmount)}</p>
                                        <p className="text-sm text-muted-foreground">
                                            Iniciado: {plan.startDate ? format(new Date(plan.startDate), "dd MMM yyyy", { locale: es }) : 'N/A'} - 
                                            <span className={`font-semibold ${plan.isActive ? 'text-green-600' : 'text-gray-500'}`}>
                                               {plan.isActive ? ' Activo' : ' Finalizado'}
                                            </span>
                                        </p>
                                    </div>
                                    {isSuperAdmin && (
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" disabled={isDeleting === plan.id}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
                                                    <AlertDialogDescription>
                                                        Esta acción eliminará el plan de inversión y reembolsará el monto invertido
                                                        ({formatCurrency(plan.investedAmount)}) al balance del usuario. Esta acción no se puede deshacer.
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeletePlan(plan)} className="bg-destructive hover:bg-destructive/90">
                                                        {isDeleting === plan.id ? "Eliminando..." : "Sí, eliminar plan"}
                                                    </AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                 <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">Cerrar</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
