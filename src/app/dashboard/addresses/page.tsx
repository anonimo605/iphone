'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  useUser,
  useFirestore,
  useDoc,
  useMemoFirebase,
  useCollection,
} from '@/firebase';
import {
  doc,
  updateDoc,
  writeBatch,
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  increment,
  addDoc,
  getCountFromServer,
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  AlertCircle,
  Banknote,
  Clock,
  Contact,
  Edit,
  Loader2,
  Save,
  Send,
  CheckCircle,
  Wallet,
  Info,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCurrency } from '@/context/currency-context';
import type {
  UserProfile,
  WithdrawalConfig,
  WithdrawalRequest,
} from '@/lib/types';
import { format } from 'date-fns';

const nequiFormSchema = z.object({
  withdrawalNequi: z.string().optional(),
  nequiOwnerName: z.string().optional(),
});

function WithdrawalAddresses() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  // State to control edit modes
  const [isEditingNequi, setIsEditingNequi] = useState(false);

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, `users/${user.uid}`) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: isLoadingProfile } =
    useDoc<UserProfile>(userDocRef);

  const nequiForm = useForm<z.infer<typeof nequiFormSchema>>({
    resolver: zodResolver(nequiFormSchema),
    defaultValues: {
      withdrawalNequi: '',
      nequiOwnerName: '',
    },
  });

  useEffect(() => {
    if (userProfile) {
      nequiForm.reset({
        withdrawalNequi: userProfile.withdrawalNequi || '',
        nequiOwnerName: userProfile.nequiOwnerName || '',
      });
    }
  }, [userProfile, nequiForm]);

  async function onNequiSubmit(values: z.infer<typeof nequiFormSchema>) {
    if (!userDocRef) return;
    try {
      await updateDoc(userDocRef, values);
      toast({
        title: 'Éxito',
        description: 'Tu información de Nequi ha sido actualizada.',
      });
      setIsEditingNequi(false); // Hide form on success
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo actualizar tu información de Nequi.',
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mis Direcciones de Retiro</CardTitle>
        <CardDescription>
          Gestiona tus cuentas para recibir fondos. Asegúrate de que la
          información sea correcta.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {/* Nequi Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Banknote className="text-green-500" /> Nequi
            </CardTitle>
            {!isEditingNequi && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsEditingNequi(true)}
              >
                <Edit className="h-4 w-4" />
                <span className="sr-only">Editar Nequi</span>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isLoadingProfile ? (
              <Loader2 className="animate-spin" />
            ) : isEditingNequi ? (
              <Form {...nequiForm}>
                <form
                  onSubmit={nequiForm.handleSubmit(onNequiSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={nequiForm.control}
                    name="withdrawalNequi"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número Nequi</FormLabel>
                        <FormControl>
                          <Input placeholder="Tu número de Nequi" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={nequiForm.control}
                    name="nequiOwnerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre del Titular (Nequi)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Nombre completo del dueño de la cuenta"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="ghost"
                      type="button"
                      onClick={() => setIsEditingNequi(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={nequiForm.formState.isSubmitting}
                    >
                      {nequiForm.formState.isSubmitting ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        'Guardar'
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            ) : (
              <div>
                {userProfile?.withdrawalNequi ? (
                  <div>
                    <p className="font-mono text-sm">
                      {userProfile.withdrawalNequi}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {userProfile.nequiOwnerName}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No has agregado una cuenta Nequi.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </CardContent>
    </Card>
  );
}

function WithdrawalRequestForm({
  userProfile,
  config,
}: {
  userProfile: UserProfile;
  config: WithdrawalConfig;
}) {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const walletsQuery = useMemoFirebase(
    () => (user ? query(collection(firestore, `users/${user.uid}/wallets`)) : null),
    [firestore, user]
  );
  const { data: wallets } = useCollection(walletsQuery);
  const mainWallet = wallets?.[0];

  // --- Calculation Logic ---
  const totalAmountInCop = parseFloat(amount) || 0;
  const feeInCop = totalAmountInCop * config.feePercentage;
  const netAmountInCop = totalAmountInCop - feeInCop;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = 'Nequi';
    if (!user || !firestore || !mainWallet || totalAmountInCop <= 0) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Por favor, completa todos los campos correctamente.',
      });
      return;
    }

    const minWithdrawalCop = config.minWithdrawal;

    if (totalAmountInCop < minWithdrawalCop) {
      toast({
        variant: 'destructive',
        title: 'Monto muy bajo',
        description: `El monto mínimo para retirar es de ${formatCurrency(
          minWithdrawalCop
        )}.`,
      });
      return;
    }
    if (totalAmountInCop > mainWallet.balance) {
      toast({
        variant: 'destructive',
        title: 'Fondos insuficientes',
        description: `Tu saldo es de ${formatCurrency(mainWallet.balance)}.`,
      });
      return;
    }

    setIsLoading(true);

    try {
      const todayString = format(new Date(), 'yyyy-MM-dd');
      const requestsTodayQuery = query(
        collection(firestore, 'withdrawalRequests'),
        where('userId', '==', user.uid),
        where('requestDay', '==', todayString)
      );
      const requestsTodaySnapshot = await getCountFromServer(requestsTodayQuery);
      const dailyCount = requestsTodaySnapshot.data().count;

      if (dailyCount >= config.dailyLimit) {
        toast({
          variant: 'destructive',
          title: 'Límite alcanzado',
          description: 'Has alcanzado tu límite de retiros por hoy.',
        });
        setIsLoading(false);
        return;
      }

      const walletAddress = userProfile.withdrawalNequi;
      if (!walletAddress) {
        toast({
          variant: 'destructive',
          title: 'Error',
          description:
            'La dirección de retiro no está configurada para este método.',
        });
        setIsLoading(false);
        return;
      }

      const batch = writeBatch(firestore);

      const transactionRef = doc(
        collection(firestore, `users/${user.uid}/wallets/${mainWallet.id}/transactions`)
      );
      batch.set(transactionRef, {
        id: transactionRef.id,
        walletId: mainWallet.id,
        transactionDate: new Date().toISOString(),
        amount: -totalAmountInCop,
        description: `Solicitud de retiro a ${walletAddress}`,
        type: 'withdrawal-request',
        status: 'pending',
      });

      const requestRef = doc(collection(firestore, 'withdrawalRequests'));

      const requestData: any = {
        id: requestRef.id,
        userId: user.uid,
        userEmail: user.email,
        walletId: mainWallet.id,
        netAmount: netAmountInCop,
        feeAmount: feeInCop,
        totalAmount: totalAmountInCop,
        method,
        walletAddress,
        status: 'pending',
        requestDate: new Date().toISOString(),
        requestDay: todayString, // Add the simple date string
        transactionId: transactionRef.id,
        nequiOwnerName: userProfile.nequiOwnerName,
      };

      batch.set(requestRef, requestData);

      const walletRefToUpdate = doc(
        firestore,
        `users/${user.uid}/wallets/${mainWallet.id}`
      );
      batch.update(walletRefToUpdate, {
        balance: increment(-totalAmountInCop),
      });

      // Also update the user's main balance field
      const userRef = doc(firestore, `users/${user.uid}`);
      batch.update(userRef, {
          balance: increment(-totalAmountInCop),
      });


      await batch.commit();

      toast({
        title: 'Solicitud Enviada',
        description: 'Tu solicitud de retiro ha sido enviada para su revisión.',
      });
      setAmount('');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo procesar la solicitud.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!userProfile) return <Loader2 className="animate-spin" />;

  const balanceToShow = formatCurrency(mainWallet?.balance || 0);

  const minWithdrawalDisplay = formatCurrency(config.minWithdrawal);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Retirar a Nequi (COP)
        </CardTitle>
        <CardDescription>
          Disponible: <span className="font-bold">{balanceToShow}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount-nequi">
              Monto a Retirar (COP)
            </Label>
            <Input
              id="amount-nequi"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Mínimo ${minWithdrawalDisplay}`}
            />
          </div>
          {totalAmountInCop > 0 && (
            <div className="p-3 bg-muted rounded-md text-sm space-y-2">
              <div className="flex justify-between">
                <span>Monto Solicitado:</span>
                <span>
                  {formatCurrency(totalAmountInCop)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Comisión ({config.feePercentage * 100}%):</span>
                <span>- {formatCurrency(feeInCop)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Total a Recibir:</span>
                <span>
                  {formatCurrency(netAmountInCop)}
                </span>
              </div>
            </div>
          )}
          <Button
            type="submit"
            className="w-full"
            disabled={
              isLoading ||
              !amount ||
              !userProfile.withdrawalNequi
            }
          >
            {isLoading ? (
              <Loader2 className="mr-2 animate-spin" />
            ) : (
              <Send className="mr-2" />
            )}
            Solicitar Retiro
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function WithdrawalStatus({ config }: { config: WithdrawalConfig }) {
  const [status, setStatus] = useState<{
    isOpen: boolean;
    message: string;
    remainingTime?: string;
  }>({ isOpen: false, message: '' });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkStatus = () => {
      setIsLoading(false);
      const now = new Date();
      const dayNames = [
        'Domingo',
        'Lunes',
        'Martes',
        'Miércoles',
        'Jueves',
        'Viernes',
        'Sábado',
      ];
      const currentDay = dayNames[now.getDay()];

      if (!config.allowedDays?.includes(currentDay)) {
        setStatus({
          isOpen: false,
          message: 'Los retiros no están disponibles hoy.',
        });
        return;
      }

      const [startH, startM] = config.startTime.split(':').map(Number);
      const [endH, endM] = config.endTime.split(':').map(Number);
      const startTime = new Date(now);
      startTime.setHours(startH, startM, 0, 0);
      const endTime = new Date(now);
      endTime.setHours(endH, endM, 0, 0);

      if (now < startTime) {
        const diff = startTime.getTime() - now.getTime();
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        setStatus({
          isOpen: false,
          message: `Los retiros abren en:`,
          remainingTime: `${hours}h ${minutes}m`,
        });
        return;
      }

      if (now > endTime) {
        setStatus({
          isOpen: false,
          message: 'El horario de retiros por hoy ha finalizado.',
        });
        return;
      }

      setStatus({ isOpen: true, message: 'Los retiros están abiertos.' });
    };

    if (config) {
      const interval = setInterval(checkStatus, 60000); // Check every minute
      checkStatus(); // Initial check

      return () => clearInterval(interval);
    } else {
      setIsLoading(false);
    }
  }, [config]);

  if (isLoading) {
    return (
      <div className="p-4 rounded-lg flex items-center justify-between bg-muted/50 text-muted-foreground">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin" />
          <p className="text-sm font-medium">Verificando estado...</p>
        </div>
      </div>
    );
  }

  if (!config || !status.message) return null;

  return (
    <div
      className={`p-4 rounded-lg flex items-center justify-between ${
        status.isOpen
          ? 'bg-green-500/10 text-green-700'
          : 'bg-destructive/10 text-destructive'
      }`}
    >
      <div className="flex items-center gap-3">
        {status.isOpen ? (
          <CheckCircle className="h-5 w-5" />
        ) : (
          <Clock className="h-5 w-5" />
        )}
        <p className="text-sm font-medium">{status.message}</p>
      </div>
      {status.remainingTime && (
        <p className="text-sm font-bold">{status.remainingTime}</p>
      )}
    </div>
  );
}

export default function WithdrawPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(
    () => (user ? doc(firestore, `users/${user.uid}`) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: isLoadingProfile } =
    useDoc<UserProfile>(userDocRef);

  const configRef = useMemoFirebase(
    () => doc(firestore, 'withdrawal_config', 'main'),
    [firestore]
  );
  const { data: config, isLoading: isLoadingConfig } =
    useDoc<WithdrawalConfig>(configRef);

  const isLoading = isUserLoading || isLoadingProfile || isLoadingConfig;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2">
          <Send /> Retirar Fondos
        </h1>
        <p className="text-muted-foreground">
          Gestiona tus direcciones y solicita retiros a tus cuentas externas.
        </p>
      </div>

      {isLoading && <Loader2 className="mx-auto my-8 h-8 w-8 animate-spin" />}

      {!isLoading && config && userProfile ? (
        <>
          <WithdrawalStatus config={config} />
          <div className="grid md:grid-cols-1 gap-8 max-w-md mx-auto w-full">
            <WithdrawalRequestForm
              userProfile={userProfile}
              config={config}
            />
          </div>
          <WithdrawalAddresses />
        </>
      ) : (
        !isLoading && (
          <div className="p-4 rounded-lg bg-destructive/10 text-destructive text-center text-sm">
            La función de retiros no está configurada por el administrador en
            este momento.
          </div>
        )
      )}
    </div>
  );
}
