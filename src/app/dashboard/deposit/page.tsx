'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronLeft, Send, Info, Banknote } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFirestore, useUser, useMemoFirebase, useCollection } from '@/firebase';
import { collection, addDoc, where, query } from 'firebase/firestore';
import { useCurrency } from '@/context/currency-context';
import { useToast } from '@/hooks/use-toast';

type DepositMethod = {
  id: string;
  name: string;
  address: string;
  qrCodeUrl: string;
  type: 'crypto' | 'fiat';
};

type UserWallet = {
  id: string;
  userId: string;
  name: string;
  balance: number;
  creationDate: string;
}


const NequiDepositContent = () => {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();
    const { formatCurrency, appConfig } = useCurrency();

    const [amount, setAmount] = useState("");
    const [referenceNumber, setReferenceNumber] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState<'amount' | 'payment'>('amount');

    const nequiQuery = useMemoFirebase(
        () => (firestore ? query(collection(firestore, "depositNetworks"), where("type", "==", "fiat")) : null),
        [firestore]
    );
    const { data: nequiNetworks, isLoading: isLoadingNequi } = useCollection<DepositMethod>(nequiQuery);
    const nequiMethod = nequiNetworks?.[0];

    const walletsQuery = useMemoFirebase(
        () => (user ? query(collection(firestore, `users/${user.uid}/wallets`)) : null),
        [firestore, user]
    );
    const { data: wallets } = useCollection<UserWallet>(walletsQuery);
    const mainWallet = wallets?.[0];

    const predefinedAmounts = appConfig?.predefinedDepositAmounts?.filter(a => a > 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !user || !mainWallet || !amount || !referenceNumber || !nequiMethod) {
            toast({ variant: "destructive", title: "Error", description: "Por favor completa todos los campos." });
            return;
        }
        setIsLoading(true);

        try {
            const depositRequestsRef = collection(firestore, 'depositRequests');
            await addDoc(depositRequestsRef, {
                userId: user.uid,
                walletId: mainWallet.id,
                networkName: nequiMethod.name,
                amount: parseFloat(amount),
                referenceNumber,
                status: 'pending',
                requestDate: new Date().toISOString(),
            });

            toast({ title: "Solicitud Enviada", description: "Tu solicitud de depósito se está procesando." });
            router.push('/dashboard');
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo enviar la solicitud." });
        } finally {
            setIsLoading(false);
        }
    };
    
    const amountInCop = parseFloat(amount) || 0;

    const handleContinue = () => {
        if (amountInCop > 0) {
            setStep('payment');
        } else {
            toast({ variant: 'destructive', title: "Monto inválido", description: "Ingresa un monto válido para continuar." });
        }
    };

    if (isLoadingNequi) return <p>Cargando información...</p>;
    if (!nequiMethod) return <p className="text-destructive">El método de pago Nequi no está configurado por el administrador.</p>;
    
    if (step === 'amount') {
        return (
            <div className="space-y-6">
                <div>
                    <h3 className="text-lg font-semibold">1. Elige el monto a recargar</h3>
                    <p className="text-sm text-muted-foreground">Selecciona un monto rápido o ingresa una cantidad personalizada.</p>
                </div>
                {predefinedAmounts && predefinedAmounts.length > 0 && (
                     <>
                        <Label>O elige un monto rápido</Label>
                        <div className="grid grid-cols-3 gap-2">
                            {predefinedAmounts.map((predefinedAmount) => (
                                <Button
                                    key={predefinedAmount}
                                    type="button"
                                    variant={amount === predefinedAmount.toString() ? "default" : "outline"}
                                    onClick={() => setAmount(predefinedAmount.toString())}
                                >
                                    {formatCurrency(predefinedAmount)}
                                </Button>
                            ))}
                        </div>
                    </>
                )}
                <div className="space-y-2 pt-2">
                    <Label htmlFor="amount-nequi">Cantidad a Depositar (COP)</Label>
                    <Input
                        id="amount-nequi"
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Ingresa un monto"
                    />
                </div>
                <Button onClick={handleContinue} disabled={amountInCop <= 0} className="w-full">
                    Continuar
                </Button>
            </div>
        );
    }
    
    if (step === 'payment') {
        return (
             <form onSubmit={handleSubmit} className="space-y-6">
                 <div>
                    <h3 className="text-lg font-semibold">2. Realiza el pago a Nequi</h3>
                    <Alert className="mt-2">
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                            Envía la cantidad exacta de <span className="font-bold text-primary">{formatCurrency(amountInCop)}</span> a la siguiente cuenta y luego registra el número de referencia para finalizar.
                        </AlertDescription>
                    </Alert>
                </div>

                <div className="flex flex-col items-center gap-4 text-center">
                    <div className="p-4 bg-white rounded-lg">
                        <Image
                            src={nequiMethod.qrCodeUrl}
                            data-ai-hint="qr code"
                            alt="QR Code de Nequi"
                            width={240}
                            height={240}
                        />
                    </div>
                </div>
                
                <div className="space-y-2">
                    <Label htmlFor="reference-nequi">Número de Referencia del Pago</Label>
                    <Input
                        id="reference-nequi"
                        type="text"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        placeholder="ID o número de referencia de la transacción"
                        required
                    />
                </div>
                
                <div className='flex items-center gap-2'>
                    <Button variant="outline" onClick={() => setStep('amount')} className="w-full">
                        <ChevronLeft className="mr-2 h-4 w-4" /> Atrás
                    </Button>
                    <Button type="submit" disabled={isLoading || !referenceNumber} className="w-full">
                        {isLoading ? 'Enviando...' : <><Send className="mr-2 h-4 w-4" /> Finalizar Depósito</>}
                    </Button>
                </div>
            </form>
        );
    }

    return null;
}

export default function DepositPage() {
    const router = useRouter();

    const title = 'Depositar con Nequi';
    const description = 'Sigue los pasos para completar tu depósito de forma segura.';

    return (
        <div className="flex flex-col gap-4">
             <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ChevronLeft className="h-6 w-6" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight font-headline">{title}</h1>
                    <p className="text-muted-foreground">
                        {description}
                    </p>
                </div>
            </div>
            <Card>
                <CardContent className="pt-6">
                    <NequiDepositContent />
                </CardContent>
            </Card>
        </div>
    );
}