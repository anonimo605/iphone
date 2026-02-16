
'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
} from "@/components/ui/alert-dialog"
import { Button } from '@/components/ui/button';
import { useFirestore, useCollection, useMemoFirebase, useAuth, errorEmitter } from '@/firebase';
import { collection, query, doc, writeBatch, serverTimestamp, increment, orderBy, where, updateDoc, getDocs, deleteDoc } from 'firebase/firestore';
import type { UserProfile, UserInvestment, Transaction, UserWallet } from '@/lib/types';
import { useCurrency } from '@/context/currency-context';
import { useToast } from '@/hooks/use-toast';
import { Trash2, ArrowDownLeft, ArrowUpRight, Award, TrendingDown, Gift, Edit, Search, UserCog, KeyRound, Hash, Info } from 'lucide-react';
import { format, isValid } from 'date-fns';
import { es } from 'date-fns/locale';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { FirestorePermissionError } from '@/firebase/errors';
import { UserPlansModal } from '@/app/dashboard/components/UserPlansModal';


function EditBalanceModal({ user, isOpen, onOpenChange, onBalanceUpdate }: { user: UserProfile, isOpen: boolean, onOpenChange: (open: boolean) => void, onBalanceUpdate: () => void }) {
    const firestore = useFirestore();
    const { formatCurrency } = useCurrency();
    const { toast } = useToast();

    const [action, setAction] = useState<'add' | 'subtract' | 'set'>('add');
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const currentBalance = user.balance ?? 0;
    const numericAmount = parseFloat(amount) || 0;

    const newBalance = useMemo(() => {
        switch (action) {
            case 'add': return currentBalance + numericAmount;
            case 'subtract': return currentBalance - numericAmount;
            case 'set': return numericAmount;
            default: return currentBalance;
        }
    }, [action, currentBalance, numericAmount]);

    const handleSubmit = async () => {
        if (!firestore || !user) return;
        if (numericAmount <= 0) {
            toast({ variant: 'destructive', title: 'Monto Inválido', description: 'El monto debe ser mayor a cero.' });
            return;
        }
        if (!reason.trim()) {
            toast({ variant: 'destructive', title: 'Razón Requerida', description: 'Debes proporcionar una razón para el ajuste.' });
            return;
        }
        setIsSubmitting(true);

        try {
            const batch = writeBatch(firestore);
            
            // Update user document
            const userRef = doc(firestore, 'users', user.id);
            batch.update(userRef, { balance: newBalance });

            // Update wallet document
            const walletsQuery = query(collection(firestore, 'users', user.id, 'wallets'));
            const walletSnapshot = await getDocs(walletsQuery);
            if (!walletSnapshot.empty) {
                const walletDoc = walletSnapshot.docs[0];
                batch.update(walletDoc.ref, { balance: newBalance });

                // Log the transaction in the wallet's subcollection
                const transactionRef = doc(collection(walletDoc.ref, 'transactions'));
                 const amountToLog = newBalance - currentBalance;
                const transactionData: Omit<Transaction, 'id' | 'status'> & { status: 'completed' | 'pending' | 'failed' } = {
                    walletId: walletDoc.id,
                    transactionDate: new Date().toISOString(),
                    amount: amountToLog,
                    description: `Corrección de saldo: ${reason}`,
                    type: amountToLog > 0 ? 'Deposit' : 'Withdrawal',
                    status: 'completed',
                };
                batch.set(transactionRef, {...transactionData, id: transactionRef.id });
            }


            await batch.commit();

            toast({
                title: 'Saldo Actualizado',
                description: `El nuevo saldo de ${(user.email || '').split('@')[0]} es ${formatCurrency(newBalance)}.`,
            });
            onBalanceUpdate();
            onOpenChange(false);

        } catch (error) {
            console.error("Error updating balance:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'No se pudo actualizar el saldo.' });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    return (
         <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) {
                // Reset state on close
                setAmount('');
                setReason('');
                setAction('add');
            }
            onOpenChange(open);
        }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar Saldo de {(user.email || '').split('@')[0]}</DialogTitle>
                    <DialogDescription>
                        Añade, resta o establece un nuevo saldo para el usuario. Cada acción quedará registrada.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-6">
                    <div className="space-y-2">
                        <Label>Balance Actual</Label>
                        <Input readOnly disabled value={formatCurrency(currentBalance)} className="font-bold" />
                    </div>
                     <div className="space-y-3">
                        <Label>Acción</Label>
                         <RadioGroup onValueChange={(value) => setAction(value as any)} value={action} className="grid grid-cols-3 gap-4">
                            <div>
                                <RadioGroupItem value="add" id="add" className="peer sr-only" />
                                <Label htmlFor="add" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                    Añadir
                                </Label>
                            </div>
                            <div>
                                <RadioGroupItem value="subtract" id="subtract" className="peer sr-only" />
                                <Label htmlFor="subtract" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                    Restar
                                </Label>
                            </div>
                             <div>
                                <RadioGroupItem value="set" id="set" className="peer sr-only" />
                                <Label htmlFor="set" className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                    Establecer
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="amount">Monto (USD)</Label>
                        <Input 
                            id="amount" 
                            type="number" 
                            placeholder="Ej: 100.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="reason">Razón del Ajuste</Label>
                        <Textarea 
                            id="reason" 
                            placeholder="Ej: Bono por rendimiento, corrección de depósito..."
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                        />
                    </div>

                    <Card className="bg-muted">
                        <CardContent className="p-4">
                             <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Nuevo Balance</span>
                                <span className="font-bold text-lg">{formatCurrency(newBalance)}</span>
                            </div>
                        </CardContent>
                    </Card>

                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary" disabled={isSubmitting}>Cancelar</Button>
                    </DialogClose>
                    <Button onClick={handleSubmit} disabled={isSubmitting}>
                        {isSubmitting ? 'Actualizando...' : 'Confirmar Ajuste'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )

}

function ManageRolesModal({ user, isOpen, onOpenChange, onRolesUpdate }: { user: UserProfile, isOpen: boolean, onOpenChange: (open: boolean) => void, onRolesUpdate: () => void }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [isSuperAdmin, setIsSuperAdmin] = useState(user.isSuperAdmin || false);
    const [isDepositAdmin, setIsDepositAdmin] = useState(user.isDepositAdmin || false);

    const handleSave = async () => {
        if (!firestore) return;
        setIsSubmitting(true);
        try {
            const userRef = doc(firestore, 'users', user.id);
            await updateDoc(userRef, {
                isSuperAdmin,
                isDepositAdmin
            });
            toast({
                title: 'Roles actualizados',
                description: `Se han actualizado los roles para ${(user.email || '').split('@')[0]}.`
            });
            onRolesUpdate();
            onOpenChange(false);
        } catch (error) {
            console.error('Error updating roles', error);
            toast({
                variant: 'destructive',
                title: 'Error',
                description: 'No se pudieron actualizar los roles.'
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Gestionar Roles de {(user.email || '').split('@')[0]}</DialogTitle>
                    <DialogDescription>
                        Asigna o revoca permisos de administrador.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-4">
                    <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="super-admin" className="text-base">
                                Super Administrador
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                Acceso total a todas las funciones de administración.
                            </p>
                        </div>
                        <Switch
                            id="super-admin"
                            checked={isSuperAdmin}
                            onCheckedChange={setIsSuperAdmin}
                        />
                    </div>
                     <div className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                            <Label htmlFor="deposit-admin" className="text-base">
                                Admin de Depósitos
                            </Label>
                             <p className="text-sm text-muted-foreground">
                                Solo puede aprobar o rechazar depósitos.
                            </p>
                        </div>
                        <Switch
                            id="deposit-admin"
                            checked={isDepositAdmin}
                            onCheckedChange={setIsDepositAdmin}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="secondary">Cancelar</Button>
                    </DialogClose>
                    <Button onClick={handleSave} disabled={isSubmitting}>
                        {isSubmitting ? "Guardando..." : "Guardar Cambios"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function UserTransactionsModalClean({ user, isOpen, onOpenChange }: { user: UserProfile, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
    const firestore = useFirestore();
    const { formatCurrency } = useCurrency();

    const walletsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users', user.id, 'wallets'));
    }, [firestore, user.id]);

    const { data: wallets } = useCollection<UserWallet>(walletsQuery);
    const mainWallet = wallets?.[0];

    const transactionsQuery = useMemoFirebase(() => {
        if (!firestore || !mainWallet) return null;
        return query(collection(firestore, `users/${user.id}/wallets/${mainWallet.id}/transactions`), orderBy('transactionDate', 'desc'));
    }, [firestore, user.id, mainWallet]);

    const { data: transactions, isLoading } = useCollection<Transaction>(transactionsQuery);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[725px]">
                <DialogHeader>
                    <DialogTitle>Transacciones de {(user.email || '').split('@')[0]}</DialogTitle>
                    <DialogDescription>
                        Historial de transacciones de la billetera.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                     {isLoading && <p>Cargando transacciones...</p>}
                    {!isLoading && (!transactions || transactions.length === 0) ? (
                        <p className="text-muted-foreground text-center">Este usuario no tiene transacciones.</p>
                    ) : (
                         <div className="space-y-2 max-h-96 overflow-y-auto">
                            {transactions?.map(t => (
                                <div key={t.id} className="flex justify-between items-start p-3 border-b last:border-b-0">
                                    <div className="flex items-start gap-3 flex-grow">
                                        <div className="flex-grow">
                                            <p className="font-semibold">{(t.description || '').replace(/(\S+)@email\.com/g, '$1')}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {isValid(new Date(t.transactionDate)) ? format(new Date(t.transactionDate), "dd MMM yyyy, HH:mm", { locale: es }) : 'Fecha inválida'}
                                            </p>
                                        </div>
                                    </div>
                                     <div className="flex items-center gap-2">
                                        <p className={`font-bold text-right ${t.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {t.amount > 0 ? '+' : ''}{formatCurrency(t.amount)}
                                        </p>
                                    </div>
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

function ReferredUserRow({ referredUser }: { referredUser: UserProfile }) {
    const { formatCurrency } = useCurrency();
    const [isPlansModalOpen, setIsPlansModalOpen] = useState(false);

    return (
        <>
            <div className="flex justify-between items-center p-3 border-b last:border-b-0">
                <div>
                    <p className="font-semibold">{(referredUser.email || '').split('@')[0]}</p>
                    <p className="text-xs text-muted-foreground">Balance: {formatCurrency(referredUser.balance ?? 0)}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setIsPlansModalOpen(true)}>
                    Ver Planes
                </Button>
            </div>
            {isPlansModalOpen && (
                <UserPlansModal
                    user={referredUser}
                    isOpen={isPlansModalOpen}
                    onOpenChange={setIsPlansModalOpen}
                />
            )}
        </>
    );
}

function UserReferralsModal({ user, isOpen, onOpenChange }: { user: UserProfile, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
    const firestore = useFirestore();

    const referralsQuery = useMemoFirebase(() => {
        if (!firestore || !user.referralCode) return null;
        return query(collection(firestore, 'users'), where('referredBy', '==', user.referralCode));
    }, [firestore, user.referralCode]);

    const { data: referredUsers, isLoading } = useCollection<UserProfile>(referralsQuery);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[725px]">
                <DialogHeader>
                    <DialogTitle>Referidos de {(user.email || '').split('@')[0]}</DialogTitle>
                    <DialogDescription>
                        Gestiona los usuarios referidos y sus planes de inversión.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    {isLoading && <p>Cargando referidos...</p>}
                    {!isLoading && (!referredUsers || referredUsers.length === 0) ? (
                        <p className="text-muted-foreground text-center">Este usuario no tiene referidos.</p>
                    ) : (
                        <div className="space-y-2 max-h-96 overflow-y-auto">
                            {referredUsers?.map(referredUser => (
                                <ReferredUserRow key={referredUser.id} referredUser={referredUser} />
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
    );
}


function UserRow({ user, onForceRefetch }: { user: UserProfile; onForceRefetch: () => void }) {
    const { formatCurrency } = useCurrency();
    const [isPlansModalOpen, setIsPlansModalOpen] = useState(false);
    const [isTransactionsModalOpen, setIsTransactionsModalOpen] = useState(false);
    const [isReferralsModalOpen, setIsReferralsModalOpen] = useState(false);
    const [isEditBalanceModalOpen, setIsEditBalanceModalOpen] = useState(false);
    const [isManageRolesModalOpen, setIsManageRolesModalOpen] = useState(false);
    const { toast } = useToast();
    const auth = useAuth();

    return (
        <>
            <TableRow>
                <TableCell>
                    <div className="font-medium">{(user.email || '').split('@')[0]}</div>
                    <div className="text-sm text-muted-foreground">{user.id}</div>
                </TableCell>
                <TableCell>{user.referredBy || 'N/A'}</TableCell>
                <TableCell className="text-right font-medium">
                    {formatCurrency(user.balance ?? 0)}
                </TableCell>
                <TableCell className="text-right space-x-2">
                     <Button variant="outline" size="sm" onClick={() => setIsManageRolesModalOpen(true)}>
                        <UserCog className="mr-2 h-3 w-3" /> Gestionar Roles
                    </Button>
                     <Button variant="outline" size="sm" onClick={() => setIsEditBalanceModalOpen(true)}>
                        <Edit className="mr-2 h-3 w-3" /> Editar Saldo
                    </Button>
                     <Button variant="outline" size="sm" onClick={() => setIsTransactionsModalOpen(true)}>
                        Ver Transacciones
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsPlansModalOpen(true)}>
                        Ver Planes
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setIsReferralsModalOpen(true)} disabled={!user.referralCode}>
                        Ver Referidos
                    </Button>
                </TableCell>
            </TableRow>
            {isPlansModalOpen && (
                <UserPlansModal 
                    user={user} 
                    isOpen={isPlansModalOpen} 
                    onOpenChange={setIsPlansModalOpen} 
                />
            )}
             {isTransactionsModalOpen && (
                <UserTransactionsModalClean 
                    user={user} 
                    isOpen={isTransactionsModalOpen} 
                    onOpenChange={setIsTransactionsModalOpen} 
                />
            )}
            {isReferralsModalOpen && (
                <UserReferralsModal
                    user={user}
                    isOpen={isReferralsModalOpen}
                    onOpenChange={setIsReferralsModalOpen}
                />
            )}
             {isEditBalanceModalOpen && (
                <EditBalanceModal
                    user={user}
                    isOpen={isEditBalanceModalOpen}
                    onOpenChange={setIsEditBalanceModalOpen}
                    onBalanceUpdate={onForceRefetch}
                />
             )}
              {isManageRolesModalOpen && (
                <ManageRolesModal
                    user={user}
                    isOpen={isManageRolesModalOpen}
                    onOpenChange={setIsManageRolesModalOpen}
                    onRolesUpdate={onForceRefetch}
                />
             )}
        </>
    );
}

function MassBalanceUpdate({ allUsers, onUpdateComplete }: { allUsers: UserProfile[], onUpdateComplete: () => void }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [action, setAction] = useState<'add' | 'subtract'>('add');
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { formatCurrency } = useCurrency();

    const handleMassUpdate = async () => {
        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            toast({ variant: 'destructive', title: 'Monto Inválido', description: 'El monto debe ser un número positivo.' });
            return;
        }
        if (!reason.trim()) {
            toast({ variant: 'destructive', title: 'Razón Requerida', description: 'Debes proporcionar una razón para el ajuste masivo.' });
            return;
        }
        if (!firestore || allUsers.length === 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'No se encontraron usuarios para actualizar.' });
            return;
        }

        setIsSubmitting(true);

        try {
            const amountToApply = action === 'add' ? numericAmount : -numericAmount;
            
            // We need to commit in chunks of 500
            const CHUNK_SIZE = 499; // Firestore batch limit is 500 writes, 2 writes per user (user, transaction)
            for (let i = 0; i < allUsers.length; i += CHUNK_SIZE) {
                const chunk = allUsers.slice(i, i + CHUNK_SIZE);
                const batch = writeBatch(firestore);

                for (const user of chunk) {
                    const userRef = doc(firestore, 'users', user.id);
                    batch.update(userRef, { balance: increment(amountToApply) });

                    // Find wallet and update it
                    const walletsQuery = query(collection(firestore, 'users', user.id, 'wallets'));
                    const walletSnapshot = await getDocs(walletsQuery);
                    if (!walletSnapshot.empty) {
                        const walletDoc = walletSnapshot.docs[0];
                        batch.update(walletDoc.ref, { balance: increment(amountToApply) });
                        
                        // Log transaction in wallet
                        const transactionRef = doc(collection(walletDoc.ref, 'transactions'));
                        const transactionData: Omit<Transaction, 'id' | 'status'> & { status: 'completed' } = {
                            walletId: walletDoc.id,
                            transactionDate: new Date().toISOString(),
                            amount: amountToApply,
                            description: `Ajuste masivo: ${reason}`,
                            type: amountToApply > 0 ? 'Deposit' : 'Withdrawal',
                            status: 'completed',
                        };
                        batch.set(transactionRef, { ...transactionData, id: transactionRef.id });
                    }
                }
                await batch.commit();
            }

            toast({
                title: 'Actualización Masiva Completa',
                description: `Se ha ${action === 'add' ? 'añadido' : 'restado'} ${formatCurrency(numericAmount)} al balance de ${allUsers.length} usuarios.`,
            });
            onUpdateComplete();
            setAmount('');
            setReason('');

        } catch (error) {
             const firstUserId = allUsers[0]?.id || 'unknown_user';
            const permissionError = new FirestorePermissionError({
                path: `users/${firstUserId}`, // Approximate path
                operation: 'update',
                requestResourceData: { balance: `increment(${action === 'add' ? numericAmount : -numericAmount})` },
            });
            errorEmitter.emit('permission-error', permissionError);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Ajuste de Saldo Masivo</CardTitle>
                <CardDescription>
                    Añade o resta saldo a todos los usuarios de la plataforma simultáneamente. Esta acción es irreversible.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-3">
                    <Label>Acción</Label>
                    <RadioGroup onValueChange={(value) => setAction(value as any)} value={action} className="grid grid-cols-2 gap-4">
                        <div>
                            <RadioGroupItem value="add" id="mass-add" className="peer sr-only" />
                            <Label htmlFor="mass-add" className="flex items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                Añadir Saldo
                            </Label>
                        </div>
                        <div>
                            <RadioGroupItem value="subtract" id="mass-subtract" className="peer sr-only" />
                            <Label htmlFor="mass-subtract" className="flex items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                Restar Saldo
                            </Label>
                        </div>
                    </RadioGroup>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="mass-amount">Monto (USD)</Label>
                    <Input
                        id="mass-amount"
                        type="number"
                        placeholder="Ej: 10.00"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        disabled={isSubmitting}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="mass-reason">Razón del Ajuste</Label>
                    <Input
                        id="mass-reason"
                        placeholder="Ej: Bono de aniversario"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        disabled={isSubmitting}
                    />
                </div>
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                       <Button className="w-full" disabled={isSubmitting || !amount || !reason}>
                            Aplicar a Todos los Usuarios
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>¿Estás absolutamente seguro?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta acción modificará el balance de <strong>{allUsers.length} usuarios</strong> y no se puede deshacer.
                                Se {action === 'add' ? 'añadirá' : 'restará'} <strong>{amount} USD</strong> a cada uno.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleMassUpdate} disabled={isSubmitting}>
                                {isSubmitting ? 'Procesando...' : 'Sí, confirmar y aplicar'}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    );
}

export default function UsersPage() {
    const firestore = useFirestore();
    const { formatCurrency } = useCurrency();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [key, setKey] = useState(0); 
    const forceRefetch = () => setKey(prev => prev + 1);

    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'));
    }, [firestore, key]);

    const { data: users, isLoading, error } = useCollection<UserProfile>(usersQuery);

    const filteredUsers = useMemo(() => {
        if (!users) return [];
        return users.filter(user =>
            (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (user.id && user.id.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }, [users, searchTerm]);

    const totalBalance = useMemo(() => {
        return users?.reduce((acc, user) => acc + (user.balance ?? 0), 0) ?? 0;
    }, [users]);

    return (
        <div className="space-y-6">
            <MassBalanceUpdate allUsers={users || []} onUpdateComplete={forceRefetch} />
            <Card>
                <CardHeader>
                    <CardTitle>Gestión de Usuarios</CardTitle>
                    <CardDescription>
                        Visualiza y gestiona todos los usuarios de la plataforma.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    Total de Usuarios
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{users?.length ?? 0}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">
                                    Balance Total en Plataforma
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{formatCurrency(totalBalance)}</div>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="mb-4 relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por correo o ID..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-8"
                        />
                    </div>

                    {isLoading && <p>Cargando usuarios...</p>}
                    {error && <p className="text-destructive">Error: {error.message}</p>}
                    {!isLoading && (!users || users.length === 0) && (
                        <p className="text-muted-foreground text-center py-4">No se encontraron usuarios.</p>
                    )}
                    {users && users.length > 0 && (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Usuario</TableHead>
                                    <TableHead>Referido Por</TableHead>
                                    <TableHead className="text-right">Balance</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredUsers.map(user => (
                                    <UserRow key={user.id} user={user} onForceRefetch={forceRefetch} />
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
