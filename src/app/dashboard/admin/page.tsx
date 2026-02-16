'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  collection,
  doc,
  query,
  setDoc,
  deleteDoc,
  getDoc,
  writeBatch,
  addDoc,
  increment,
  updateDoc,
  where,
  orderBy
} from 'firebase/firestore';
import {
  PlusCircle,
  Trash2,
  Save,
  Check,
  X,
  Hourglass,
  Briefcase,
  Pencil,
  Users,
  Banknote,
  Bitcoin,
  Settings,
  Paperclip,
  Percent,
  Clock,
  Calendar,
  Contact,
  Send,
  Loader2,
  MessageSquare,
  Megaphone,
  Gift,
  Download,
  Upload,
  BookOpen,
} from 'lucide-react';
import { useCollection, useFirestore, useUser, useMemoFirebase, useDoc, errorEmitter, useFirebase } from '@/firebase';
import { FirestorePermissionError } from '@/firebase/errors';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useCurrency } from '@/context/currency-context';
import type { AppConfig, WithdrawalConfig, WithdrawalRequest, UserInvestment, InvestmentPlan as TInvestmentPlan, DepositBonusConfig, AppTutorial, TutorialImage } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { getStorage, ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { cn } from '@/lib/utils';


// Types
type DepositMethod = {
  id: string;
  name: string;
  address: string;
  qrCodeUrl: string;
  type: 'crypto' | 'fiat';
};

type DepositRequest = {
  id: string;
  userId: string;
  walletId: string;
  networkName: string;
  amount: number;
  referenceNumber: string;
  proofOfPaymentUrl?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestDate: string;
  decisionDate?: string;
  adminId?: string;
};

type InvestmentPlan = TInvestmentPlan;


const StatusIndicator = ({ status }: { status: string }) => {
    let config: { label: string; color: string };

    switch (status.toLowerCase()) {
      case "completed":
        config = { label: "Completado", color: "bg-green-500" };
        break;
      case "approved":
        config = { label: "Aprobado", color: "bg-green-500" };
        break;
      case "pending":
        config = { label: "Pendiente", color: "bg-yellow-500" };
        break;
      case "in_progress":
        config = { label: "En Progreso", color: "bg-blue-500" };
        break;
      case "failed":
        config = { label: "Fallido", color: "bg-red-500" };
        break;
      case "rejected":
        config = { label: "Rechazado", color: "bg-red-500" };
        break;
      default:
        config = { label: status, color: "bg-gray-500" };
    }
  
    return (
      <div className="inline-flex items-center gap-2">
        <div className={cn('h-2 w-2 rounded-full', config.color)} />
        <span className="capitalize text-sm font-medium">{config.label}</span>
      </div>
    );
};


// Dialog Components
function MethodDialog({
  open,
  onOpenChange,
  method,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  method?: DepositMethod;
}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [type, setType] = useState<'crypto' | 'fiat'>('crypto');
  const [isLoading, setIsLoading] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    if (method) {
      setName(method.name);
      setAddress(method.address || '');
      setQrCodeUrl(method.qrCodeUrl);
      setType(method.type || 'crypto');
    } else {
      setName('');
      setAddress('');
      setQrCodeUrl('');
      setType('crypto');
    }
  }, [method, open]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setQrCodeUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    if (!firestore || !name || !qrCodeUrl) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Por favor completa todos los campos requeridos.',
      });
      setIsLoading(false);
      return;
    }

    const methodId = method?.id || name.toLowerCase().replace(/\s/g, '-');
    const docRef = doc(firestore, 'depositNetworks', methodId);

    try {
      const dataToSave: Omit<DepositMethod, 'id'> = { name, address, qrCodeUrl, type };
      if (type === 'fiat') {
        dataToSave.address = ''; // No address for fiat
      }

      await setDoc(docRef, { ...dataToSave, id: methodId }, { merge: true });
      toast({
        title: 'Éxito',
        description: method
          ? 'El método de depósito ha sido actualizado.'
          : 'El nuevo método de depósito ha sido guardado.',
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al guardar',
        description:
          'No tienes permisos para realizar esta acción. Solo los superadmins pueden modificar métodos.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {method ? 'Editar' : 'Agregar Nuevo'} Método de Depósito
          </DialogTitle>
          <DialogDescription>
            Completa la información para el método de depósito.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del Método</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Nequi, USDT (TRC-20)"
            />
          </div>
          {type === 'crypto' && (
            <div className="space-y-2">
              <Label htmlFor="address">Dirección / Número</Label>
              <Input
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Dirección de billetera o número de teléfono"
              />
            </div>
          )}
           <div className="space-y-2">
             <Label htmlFor="type">Tipo de Método</Label>
              <select id="type" value={type} onChange={(e) => setType(e.target.value as 'crypto' | 'fiat')} className="w-full p-2 border rounded-md">
                  <option value="crypto">Cripto</option>
                  <option value="fiat">Fiat (Nequi)</option>
              </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="qrCodeFile">Imagen del Código QR</Label>
            <Input
              id="qrCodeFile"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            <Save className="mr-2" />
            {isLoading ? 'Guardando...' : 'Guardar Método'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PlanDialog({
  open,
  onOpenChange,
  plan,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan?: InvestmentPlan;
}) {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [percentage, setPercentage] = useState('');
  const [price, setPrice] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const firestore = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    if (plan) {
      setName(plan.name);
      setDuration(plan.durationDays.toString());
      setPercentage(plan.dailyReturnPercentage.toString());
      setPrice(plan.minInvestment?.toString() ?? '');
      setStartDate(plan.availabilityStartDate ? format(new Date(plan.availabilityStartDate), "yyyy-MM-dd'T'HH:mm") : '');
      setEndDate(plan.availabilityEndDate ? format(new Date(plan.availabilityEndDate), "yyyy-MM-dd'T'HH:mm") : '');
      setImageUrl(plan.imageUrl || '');
    } else {
      setName('');
      setDuration('');
      setPercentage('');
      setPrice('');
      setStartDate('');
      setEndDate('');
      setImageUrl('');
    }
  }, [plan, open]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    if (!firestore || !name || !duration || !percentage || !price) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Nombre, Duración, Retorno y Precio son obligatorios.',
      });
      setIsLoading(false);
      return;
    }

    try {
      const investmentPrice = parseFloat(price);
       if (isNaN(investmentPrice) || investmentPrice <= 0) {
        toast({
            variant: 'destructive',
            title: 'Error',
            description: 'El precio debe ser un número positivo.',
          });
        setIsLoading(false);
        return;
      }

      const planData: Omit<InvestmentPlan, 'id' | 'isActive'> = {
        name,
        durationDays: parseInt(duration, 10),
        dailyReturnPercentage: parseFloat(percentage),
        availabilityStartDate: startDate ? new Date(startDate).toISOString() : null,
        availabilityEndDate: endDate ? new Date(endDate).toISOString() : null,
        imageUrl: imageUrl,
        minInvestment: investmentPrice,
        maxInvestment: investmentPrice,
      };

      if (plan) {
        const planRef = doc(firestore, 'investmentPlans', plan.id);
        await setDoc(planRef, planData, { merge: true });
        toast({ title: 'Éxito', description: 'Plan de inversión actualizado.' });
      } else {
        const finalPlanData = { ...planData, isActive: true };
        const collectionRef = collection(firestore, 'investmentPlans');
        const newPlanRef = doc(collectionRef);
        await setDoc(newPlanRef, { ...finalPlanData, id: newPlanRef.id });
        toast({ title: 'Éxito', description: 'Nuevo plan de inversión creado.' });
      }
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al guardar',
        description: error.message || 'No se pudo guardar el plan.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>{plan ? 'Editar' : 'Crear'} Plan de Inversión</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="planName">Nombre del Plan</Label>
            <Input
              id="planName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Plan Básico"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="planImageFile">Imagen del Plan</Label>
            <Input
              id="planImageFile"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="planDuration">Duración (días)</Label>
              <Input
                id="planDuration"
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="Ej: 75"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="planPercentage">Retorno Diario (%)</Label>
              <Input
                id="planPercentage"
                type="number"
                step="0.01"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                placeholder="Ej: 6"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="planPrice">Precio de Inversión (COP)</Label>
            <Input
              id="planPrice"
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Ej: 50000"
            />
          </div>
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Inicio Disponibilidad (Opcional)</Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">Fin Disponibilidad (Opcional)</Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            <Save className="mr-2" />
            {isLoading ? 'Guardando...' : 'Guardar Plan'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}


// Display Components
function UserDisplay({ userId }: { userId: string }) {
  const firestore = useFirestore();
  const [userPhone, setUserPhone] = useState(userId);

  useEffect(() => {
    if (!firestore || !userId) return;

    const getUserPhone = async () => {
      try {
        const userDoc = await getDoc(doc(firestore, 'users', userId));
        if (userDoc.exists()) {
          const email = userDoc.data()?.email;
          if (email && typeof email === 'string') {
            setUserPhone(email.split('@')[0]);
          }
        }
      } catch (error) {
        console.error('Error fetching user:', error);
      }
    };

    getUserPhone();
  }, [firestore, userId]);

  return <span>{userPhone}</span>;
}

function DepositRequests({
  requests,
  onUpdateRequest,
  actionLoading,
}: {
  requests: DepositRequest[] | null;
  onUpdateRequest: (
    requestId: string,
    newStatus: 'approved' | 'rejected'
  ) => Promise<void>;
  actionLoading: string | null;
}) {
  const { formatCurrency } = useCurrency();
  if (!requests || requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 text-center border-2 border-dashed rounded-lg p-12 mt-4">
        <h3 className="text-2xl font-bold tracking-tight">No hay solicitudes</h3>
        <p className="text-sm text-muted-foreground">
          Cuando los usuarios envíen solicitudes, las verás aquí.
        </p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "d MMM, yyyy 'a las' HH:mm", {
      locale: es,
    });
  };

  const isNequiRequest = (networkName: string) => networkName.toLowerCase().includes('nequi');

  return (
    <div className="space-y-4">
      {requests.map((req) => (
        <Card key={req.id}>
          <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-grow space-y-2">
              <div className="flex items-center gap-2">
                <StatusIndicator status={req.status} />
                <p className="text-lg font-bold">
                  {formatCurrency(req.amount)}
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                Red: {req.networkName}
              </p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  Solicitado por: <UserDisplay userId={req.userId} />
                </p>
                <p>Fecha Solicitud: {formatDate(req.requestDate)}</p>
                {req.decisionDate && (
                  <p>Fecha Decisión: {formatDate(req.decisionDate)}</p>
                )}
                {req.adminId && (
                  <p>
                    Procesado por: <UserDisplay userId={req.adminId} />
                  </p>
                )}
                <p className="break-all">Ref: {req.referenceNumber}</p>
              </div>
            </div>
            {req.status === 'pending' && (
              <div className="flex gap-2 self-start sm:self-center">
                <Button
                  size="icon"
                  variant="outline"
                  className="text-green-500 hover:text-green-600 hover:border-green-500"
                  onClick={() => onUpdateRequest(req.id, 'approved')}
                  disabled={actionLoading === req.id}
                >
                  <Check className="h-5 w-5" />
                  <span className="sr-only">Aprobar</span>
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  className="text-red-500 hover:text-red-600 hover:border-red-500"
                  onClick={() => onUpdateRequest(req.id, 'rejected')}
                  disabled={actionLoading === req.id}
                >
                  <X className="h-5 w-5" />
                  <span className="sr-only">Rechazar</span>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

const WithdrawalRequestsTab = () => {
    const firestore = useFirestore();
    const { user } = useUser();
    const { toast } = useToast();
    const { formatCurrency } = useCurrency();
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const requestsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'withdrawalRequests'));
    }, [firestore]);

    const { data: allRequests, isLoading } = useCollection<WithdrawalRequest>(requestsQuery);

    const filterRequests = (status: 'pending' | 'processed') => {
        return allRequests
            ?.filter(r => (status === 'pending' ? r.status === 'pending' : r.status !== 'pending'))
            .sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
    };
    
    const pendingNequi = useMemo(() => filterRequests('pending'), [allRequests]);
    const processedNequi = useMemo(() => filterRequests('processed'), [allRequests]);
    
    const handleUpdateRequest = async (requestId: string, newStatus: 'approved' | 'rejected') => {
        if (!firestore || !user) return;
        setActionLoading(requestId);
    
        const requestRef = doc(firestore, 'withdrawalRequests', requestId);
    
        try {
            const requestSnap = await getDoc(requestRef);
            if (!requestSnap.exists()) throw new Error('La solicitud no existe.');
    
            const requestData = requestSnap.data() as WithdrawalRequest;
            if (requestData.status !== 'pending') {
                toast({ title: 'Acción no permitida', description: 'Esta solicitud ya fue procesada.' });
                return;
            }
    
            const decisionDate = new Date().toISOString();
            const batch = writeBatch(firestore);
    
            batch.update(requestRef, { status: newStatus, decisionDate, adminId: user.uid });
    
            const transactionRef = doc(firestore, `users/${requestData.userId}/wallets/${requestData.walletId}/transactions/${requestData.transactionId}`);
    
            if (newStatus === 'rejected') {
                const userRef = doc(firestore, `users/${requestData.userId}`);
                const walletRef = doc(firestore, `users/${requestData.userId}/wallets/${requestData.walletId}`);
                
                batch.update(walletRef, { balance: increment(requestData.totalAmount) });
                batch.update(userRef, { balance: increment(requestData.totalAmount) });
    
                batch.update(transactionRef, { status: 'failed', description: 'Solicitud de retiro rechazada' });
    
                const refundTransactionRef = doc(collection(firestore, `users/${requestData.userId}/wallets/${requestData.walletId}/transactions`));
                batch.set(refundTransactionRef, {
                    id: refundTransactionRef.id,
                    walletId: requestData.walletId,
                    transactionDate: decisionDate,
                    amount: requestData.totalAmount,
                    description: `Reembolso por retiro rechazado`,
                    type: 'deposit-approved',
                    status: 'completed',
                });
    
            } else {
                batch.update(transactionRef, { status: 'completed', description: `Retiro a ${requestData.walletAddress}` });
            }
    
            await batch.commit();
            toast({ title: 'Éxito', description: `La solicitud de retiro ha sido ${newStatus === 'approved' ? 'aprobada' : 'rechazada'}.` });
    
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message || 'No se pudo procesar la solicitud.' });
        } finally {
            setActionLoading(null);
        }
    };
    
    const formatDate = (date: any) => {
        if (!date) return 'N/A';
        const jsDate = date.toDate ? date.toDate() : new Date(date);
        return format(jsDate, "d MMM, yyyy 'a las' HH:mm", { locale: es });
    };

    const RequestList = ({ requests }: { requests: WithdrawalRequest[] | undefined }) => (
        <div className="space-y-4">
            {requests?.map(req => {
                 const feeAmountDisplay = formatCurrency(req.feeAmount);
                 const netAmountDisplay = formatCurrency(req.netAmount);

                return (
                    <Card key={req.id}>
                        <CardContent className="p-4 flex flex-col sm:flex-row items-start justify-between gap-4">
                            <div className="flex-grow space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className='flex items-center gap-2'>
                                        <StatusIndicator status={req.status} />
                                        <p className="text-sm font-bold text-muted-foreground">Solicitado por: {req.userEmail.split('@')[0]}</p>
                                    </div>
                                    {req.status === 'pending' && (
                                        <div className="flex gap-2 self-start sm:self-center">
                                            <Button size="icon" variant="outline" onClick={() => handleUpdateRequest(req.id, 'approved')} disabled={!!actionLoading} className="text-green-500 h-8 w-8"><Check className="h-4 w-4" /></Button>
                                            <Button size="icon" variant="outline" onClick={() => handleUpdateRequest(req.id, 'rejected')} disabled={!!actionLoading} className="text-red-500 h-8 w-8"><X className="h-4 w-4" /></Button>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="text-xs text-muted-foreground space-y-1">
                                    <p>Destino: <span className='font-mono'>{req.walletAddress}</span></p>
                                    {req.nequiOwnerName && <p>Titular: <span className='font-semibold'>{req.nequiOwnerName}</span></p>}
                                    <p>Fecha Solicitud: {formatDate(req.requestDate)}</p>
                                    {req.decisionDate && <p>Fecha Decisión: {formatDate(req.decisionDate)}</p>}
                                </div>

                                <div className="p-3 bg-muted rounded-md text-sm space-y-1 text-muted-foreground">
                                    <div className="flex justify-between"><span>Monto Solicitado:</span> <span className='font-medium'>{formatCurrency(req.totalAmount)}</span></div>
                                    <div className="flex justify-between"><span>Comisión:</span> <span className='font-medium'>{feeAmountDisplay}</span></div>
                                    <div className="flex justify-between font-bold text-foreground"><span>Total a Pagar (COP):</span> <span>{netAmountDisplay}</span></div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )
            })}
             {!requests || requests.length === 0 && <p className="text-muted-foreground text-sm">No hay solicitudes en esta categoría.</p>}
        </div>
    );

    if (isLoading) return <p>Cargando solicitudes de retiro...</p>;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Solicitudes de Retiro a Nequi</CardTitle>
                <CardDescription>Aprueba o rechaza los retiros de los usuarios.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    <div>
                        <h4 className="mb-2 text-md font-semibold text-muted-foreground">Pendientes</h4>
                        <RequestList requests={pendingNequi} />
                    </div>
                        <div>
                        <h4 className="mt-6 mb-2 text-md font-semibold text-muted-foreground">Procesadas</h4>
                        <RequestList requests={processedNequi} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};


const ConfigTab = () => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { firebaseApp } = useFirebase();

    // General App Config
    const appConfigRef = useMemoFirebase(() => doc(firestore, 'app_config', 'main'), [firestore]);
    const { data: appConfig, isLoading: isLoadingAppConfig } = useDoc<AppConfig>(appConfigRef);

    const [exchangeRate, setExchangeRate] = useState('');
    const [referralCommission, setReferralCommission] = useState('');
    const [whatsappGroup, setWhatsappGroup] = useState('');
    const [whatsappNumber, setWhatsappNumber] = useState('');
    const [telegramGroup, setTelegramGroup] = useState('');
    const [announcementMessage, setAnnouncementMessage] = useState('');
    const [announcementEnabled, setAnnouncementEnabled] = useState(false);
    const [isSavingAppConfig, setIsSavingAppConfig] = useState(false);
    
    // APK Upload State
    const [apkFile, setApkFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    
    // Earnings Claim Commission Config
    const [earningsCommission, setEarningsCommission] = useState('');
    const [earningsCommissionEnabled, setEarningsCommissionEnabled] = useState(false);

    // Predefined Deposit Amounts
    const [predefinedAmounts, setPredefinedAmounts] = useState<string[]>(Array(6).fill(''));

    // Registration Bonus
    const [registrationBonus, setRegistrationBonus] = useState('');
    const [registrationBonusEnabled, setRegistrationBonusEnabled] = useState(false);

    useEffect(() => {
        if (appConfig) {
            setExchangeRate(appConfig.cop_exchange_rate?.toString() || '');
            setReferralCommission(appConfig.referralCommissionPercentage?.toString() || '');
            setWhatsappGroup(appConfig.support_whatsapp_group || '');
            setWhatsappNumber(appConfig.support_whatsapp_number || '');
            setTelegramGroup(appConfig.support_telegram_group || '');
            setAnnouncementMessage(appConfig.announcement_message || '');
            setAnnouncementEnabled(appConfig.announcement_enabled || false);
            setEarningsCommission(appConfig.earningsClaimCommissionPercentage?.toString() || '');
            setEarningsCommissionEnabled(appConfig.earningsClaimCommissionEnabled || false);
            const amounts = appConfig.predefinedDepositAmounts || [];
            setPredefinedAmounts(Array.from({ length: 6 }, (_, i) => amounts[i]?.toString() || ''));
            setRegistrationBonus(appConfig.registrationBonus?.toString() || '');
            setRegistrationBonusEnabled(appConfig.registrationBonusEnabled || false);
        }
    }, [appConfig]);

    // Withdrawal Config
    const withdrawalConfigRef = useMemoFirebase(() => doc(firestore, 'withdrawal_config', 'main'), [firestore]);
    const { data: withdrawalConfig, isLoading: isLoadingWithdrawalConfig } = useDoc<WithdrawalConfig>(withdrawalConfigRef);

    const [minWithdrawal, setMinWithdrawal] = useState('');
    const [feePercentage, setFeePercentage] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [dailyLimit, setDailyLimit] = useState('');
    const [allowedDays, setAllowedDays] = useState<string[]>([]);
    const [isSavingWithdrawalConfig, setIsSavingWithdrawalConfig] = useState(false);

    const daysOfWeek = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

    useEffect(() => {
        if (withdrawalConfig) {
            setMinWithdrawal(withdrawalConfig.minWithdrawal?.toString() || '');
            setFeePercentage((withdrawalConfig.feePercentage * 100)?.toString() || '');
            setStartTime(withdrawalConfig.startTime || '');
            setEndTime(withdrawalConfig.endTime || '');
            setDailyLimit(withdrawalConfig.dailyLimit?.toString() || '');
            setAllowedDays(withdrawalConfig.allowedDays || []);
        }
    }, [withdrawalConfig]);

    // Deposit Bonus Config
    const depositBonusConfigRef = useMemoFirebase(() => doc(firestore, 'deposit_bonus_config', 'main'), [firestore]);
    const { data: depositBonusConfig, isLoading: isLoadingDepositBonusConfig } = useDoc<DepositBonusConfig>(depositBonusConfigRef);
    
    const [bonusPercentage, setBonusPercentage] = useState('');
    const [bonusEnabled, setBonusEnabled] = useState(false);
    const [isSavingBonusConfig, setIsSavingBonusConfig] = useState(false);

    useEffect(() => {
        if (depositBonusConfig) {
            setBonusPercentage(depositBonusConfig.percentage?.toString() || '');
            setBonusEnabled(depositBonusConfig.isActive || false);
        }
    }, [depositBonusConfig]);


    const handleSaveAppConfig = async () => {
        if (!firestore) return;
        setIsSavingAppConfig(true);
        try {
            const newConfig: Partial<AppConfig> = {
                support_whatsapp_group: whatsappGroup,
                support_whatsapp_number: whatsappNumber,
                support_telegram_group: telegramGroup,
                announcement_message: announcementMessage,
                announcement_enabled: announcementEnabled,
                earningsClaimCommissionEnabled: earningsCommissionEnabled,
                predefinedDepositAmounts: predefinedAmounts.map(a => parseFloat(a)).filter(a => !isNaN(a) && a > 0),
                registrationBonusEnabled: registrationBonusEnabled,
            };
            
            const rate = parseFloat(exchangeRate);
            if (!isNaN(rate) && rate > 0) newConfig.cop_exchange_rate = rate;

            const refCommission = parseFloat(referralCommission);
            if(!isNaN(refCommission) && refCommission >= 0) newConfig.referralCommissionPercentage = refCommission;

            const earnCommission = parseFloat(earningsCommission);
            if(!isNaN(earnCommission) && earnCommission >= 0) newConfig.earningsClaimCommissionPercentage = earnCommission;

            const regBonus = parseFloat(registrationBonus);
            if(!isNaN(regBonus) && regBonus >= 0) newConfig.registrationBonus = regBonus;

            await setDoc(doc(firestore, 'app_config', 'main'), newConfig, { merge: true });
            toast({ title: "Éxito", description: "La configuración general ha sido actualizada." });
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo guardar la configuración." });
        } finally {
            setIsSavingAppConfig(false);
        }
    };
    
    const handleApkUpload = () => {
        if (!apkFile || !firebaseApp) {
            toast({ variant: 'destructive', title: 'Error', description: 'Por favor, selecciona un archivo APK para subir.' });
            return;
        }

        setIsUploading(true);
        const storage = getStorage(firebaseApp);
        const fileRef = storageRef(storage, `apks/${apkFile.name}`);
        const uploadTask = uploadBytesResumable(fileRef, apkFile);

        uploadTask.on('state_changed',
            (snapshot) => {
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                setUploadProgress(progress);
            },
            (error) => {
                console.error("Upload failed:", error);
                toast({ variant: 'destructive', title: 'Error de subida', description: 'No se pudo subir el archivo. Revisa los permisos de almacenamiento.' });
                setIsUploading(false);
            },
            () => {
                getDownloadURL(uploadTask.snapshot.ref).then(async (downloadURL) => {
                    await setDoc(doc(firestore, 'app_config', 'main'), { apkDownloadUrl: downloadURL }, { merge: true });
                    toast({ title: 'Éxito', description: 'El archivo APK ha sido subido y el enlace de descarga ha sido guardado.' });
                    setIsUploading(false);
                    setApkFile(null);
                });
            }
        );
    };

    const handleSaveWithdrawalConfig = async () => {
        if (!firestore) return;
        setIsSavingWithdrawalConfig(true);
        try {
            const newConfig: Partial<WithdrawalConfig> = {
                minWithdrawal: parseFloat(minWithdrawal) || 0,
                feePercentage: (parseFloat(feePercentage) || 0) / 100,
                startTime,
                endTime,
                dailyLimit: parseInt(dailyLimit) || 0,
                allowedDays,
            };
            await setDoc(doc(firestore, 'withdrawal_config', 'main'), newConfig, { merge: true });
            toast({ title: "Éxito", description: "La configuración de retiros ha sido actualizada." });
        } catch(error: any) {
             toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo guardar la configuración de retiros." });
        } finally {
            setIsSavingWithdrawalConfig(false);
        }
    };
    
    const handleSaveBonusConfig = async () => {
        if (!firestore) return;
        setIsSavingBonusConfig(true);
        try {
            const percentage = parseFloat(bonusPercentage);
            if (isNaN(percentage) || percentage < 0) {
                 toast({ variant: "destructive", title: "Error", description: "El porcentaje debe ser un número positivo." });
                 setIsSavingBonusConfig(false);
                 return;
            }
            const newConfig: DepositBonusConfig = {
                isActive: bonusEnabled,
                percentage: percentage,
            };
            await setDoc(doc(firestore, 'deposit_bonus_config', 'main'), newConfig, { merge: true });
            toast({ title: "Éxito", description: "La configuración de bonificación por depósito ha sido actualizada." });
        } catch (error: any) {
             toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo guardar la configuración de bonificación." });
        } finally {
            setIsSavingBonusConfig(false);
        }
    };

    if (isLoadingAppConfig || isLoadingWithdrawalConfig || isLoadingDepositBonusConfig) {
        return <p>Cargando configuración...</p>
    }

    return (
        <div className="space-y-8">
             <Card>
                <CardHeader>
                    <CardTitle className='flex items-center gap-2'><Gift /> Bono de Registro</CardTitle>
                    <CardDescription>Otorga un saldo inicial a los nuevos usuarios al registrarse.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="registration-bonus">Monto del Bono (COP)</Label>
                        <Input id="registration-bonus" type="number" value={registrationBonus} onChange={(e) => setRegistrationBonus(e.target.value)} placeholder="Ej: 5000" disabled={isSavingAppConfig}/>
                    </div>
                     <div className="flex items-center space-x-2">
                        <Switch id="registration-bonus-enabled" checked={registrationBonusEnabled} onCheckedChange={setRegistrationBonusEnabled} disabled={isSavingAppConfig} />
                        <Label htmlFor="registration-bonus-enabled">Activar bono de registro</Label>
                    </div>
                     <Button onClick={handleSaveAppConfig} disabled={isSavingAppConfig}>
                        <Save className="mr-2 h-4 w-4" />
                        {isSavingAppConfig ? "Guardando..." : "Guardar Bono de Registro"}
                     </Button>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle className='flex items-center gap-2'><Gift /> Bonificación por Depósito</CardTitle>
                    <CardDescription>Otorga un porcentaje extra a los usuarios cuando depositen.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="bonus-percentage">Porcentaje de Bonificación (%)</Label>
                        <div className="relative">
                            <Input id="bonus-percentage" type="number" value={bonusPercentage} onChange={(e) => setBonusPercentage(e.target.value)} placeholder="Ej: 10" disabled={isSavingBonusConfig} className="pl-8"/>
                            <Percent className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        </div>
                    </div>
                     <div className="flex items-center space-x-2">
                        <Switch id="bonus-enabled" checked={bonusEnabled} onCheckedChange={setBonusEnabled} disabled={isSavingBonusConfig} />
                        <Label htmlFor="bonus-enabled">Activar bonificación por depósito</Label>
                    </div>
                     <Button onClick={handleSaveBonusConfig} disabled={isSavingBonusConfig}>
                        <Save className="mr-2 h-4 w-4" />
                        {isSavingBonusConfig ? "Guardando..." : "Guardar Bonificación"}
                     </Button>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle>Anuncios Globales</CardTitle>
                    <CardDescription>Muestra un banner con un mensaje a todos los usuarios en el dashboard.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="announcement-message">Mensaje del Anuncio</Label>
                        <Textarea id="announcement-message" value={announcementMessage} onChange={(e) => setAnnouncementMessage(e.target.value)} placeholder="Ej: Mantenimiento programado para el domingo a las 10 PM." disabled={isSavingAppConfig} />
                    </div>
                    <div className="flex items-center space-x-2">
                        <Switch id="announcement-enabled" checked={announcementEnabled} onCheckedChange={setAnnouncementEnabled} disabled={isSavingAppConfig} />
                        <Label htmlFor="announcement-enabled">Mostrar anuncio</Label>
                    </div>
                     <Button onClick={handleSaveAppConfig} disabled={isSavingAppConfig}>
                        <Save className="mr-2 h-4 w-4" />
                        {isSavingAppConfig ? "Guardando..." : "Guardar Anuncio"}
                     </Button>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>Descarga de la App</CardTitle>
                    <CardDescription>Sube el archivo APK de la aplicación para que los usuarios puedan descargarlo.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="apk-file">Archivo APK</Label>
                        <Input 
                            id="apk-file" 
                            type="file" 
                            accept=".apk"
                            onChange={(e) => setApkFile(e.target.files ? e.target.files[0] : null)} 
                            disabled={isUploading}
                        />
                    </div>
                    {isUploading && (
                         <div className="space-y-2">
                             <Progress value={uploadProgress} className="w-full" />
                             <p className='text-sm text-muted-foreground text-center'>{Math.round(uploadProgress)}%</p>
                         </div>
                    )}
                    {appConfig?.apkDownloadUrl && !isUploading && (
                        <div className="text-sm text-green-600 flex items-center gap-2">
                            <Check className='h-4 w-4'/>
                            <a href={appConfig.apkDownloadUrl} target="_blank" rel="noopener noreferrer" className="underline">Enlace de descarga actual guardado</a>
                        </div>
                    )}
                     <Button onClick={handleApkUpload} disabled={isUploading || !apkFile}>
                        <Upload className="mr-2 h-4 w-4" />
                        {isUploading ? `Subiendo...` : "Subir y Guardar Enlace"}
                     </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Montos de Recarga Rápida</CardTitle>
                    <CardDescription>Configura los 6 montos predefinidos para la página de depósito.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {predefinedAmounts.map((amount, index) => (
                            <div key={index} className="space-y-2">
                                <Label htmlFor={`predefined-amount-${index}`}>Monto {index + 1} (COP)</Label>
                                <Input
                                    id={`predefined-amount-${index}`}
                                    type="number"
                                    value={amount}
                                    onChange={(e) => {
                                        const newAmounts = [...predefinedAmounts];
                                        newAmounts[index] = e.target.value;
                                        setPredefinedAmounts(newAmounts);
                                    }}
                                    placeholder="Ej: 50000"
                                    disabled={isSavingAppConfig}
                                />
                            </div>
                        ))}
                    </div>
                     <Button onClick={handleSaveAppConfig} disabled={isSavingAppConfig} className="mt-6">
                        <Save className="mr-2 h-4 w-4" />
                        {isSavingAppConfig ? "Guardando..." : "Guardar Montos de Recarga"}
                     </Button>
                </CardContent>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>Comisión por Ganancia de Referidos</CardTitle>
                    <CardDescription>Otorga una comisión cuando un referido reclama sus ganancias diarias.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="earnings-commission-percentage">Porcentaje de Comisión (%)</Label>
                        <div className="relative">
                            <Input id="earnings-commission-percentage" type="number" value={earningsCommission} onChange={(e) => setEarningsCommission(e.target.value)} placeholder="Ej: 2" disabled={isSavingAppConfig} className="pl-8"/>
                            <Percent className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        </div>
                    </div>
                     <div className="flex items-center space-x-2">
                        <Switch id="earnings-commission-enabled" checked={earningsCommissionEnabled} onCheckedChange={setEarningsCommissionEnabled} disabled={isSavingAppConfig} />
                        <Label htmlFor="earnings-commission-enabled">Activar comisión por ganancias de referidos</Label>
                    </div>
                     <Button onClick={handleSaveAppConfig} disabled={isSavingAppConfig}>
                        <Save className="mr-2 h-4 w-4" />
                        {isSavingAppConfig ? "Guardando..." : "Guardar Comisión por Ganancias"}
                     </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Configuración General</CardTitle>
                    <CardDescription>Ajusta los parámetros globales de la aplicación.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="exchange-rate">Tasa de Cambio (1 USD a COP)</Label>
                        <Input id="exchange-rate" type="number" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} placeholder="Ej: 3950" disabled={isSavingAppConfig}/>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="referral-commission">Porcentaje de Comisión por Primera Inversión (%)</Label>
                        <div className="relative">
                            <Input id="referral-commission" type="number" value={referralCommission} onChange={(e) => setReferralCommission(e.target.value)} placeholder="Ej: 5" disabled={isSavingAppConfig} className="pl-8"/>
                            <Percent className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-muted-foreground">La comisión se aplica sobre la primera inversión del referido.</p>
                    </div>
                     <Button onClick={handleSaveAppConfig} disabled={isSavingAppConfig}>
                        <Save className="mr-2 h-4 w-4" />
                        {isSavingAppConfig ? "Guardando..." : "Guardar Configuración General"}
                     </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Configuración de Soporte</CardTitle>
                    <CardDescription>Configura los enlaces de soporte para los usuarios.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="whatsapp-number">Número de WhatsApp</Label>
                        <Input id="whatsapp-number" type="text" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="Ej: +1234567890" disabled={isSavingAppConfig}/>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="whatsapp-group">Enlace Grupo de WhatsApp</Label>
                        <Input id="whatsapp-group" type="url" value={whatsappGroup} onChange={(e) => setWhatsappGroup(e.target.value)} placeholder="https://chat.whatsapp.com/..." disabled={isSavingAppConfig}/>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="telegram-group">Enlace Grupo de Telegram</Label>
                        <Input id="telegram-group" type="url" value={telegramGroup} onChange={(e) => setTelegramGroup(e.target.value)} placeholder="https://t.me/..." disabled={isSavingAppConfig}/>
                    </div>
                     <Button onClick={handleSaveAppConfig} disabled={isSavingAppConfig}>
                        <Save className="mr-2 h-4 w-4" />
                        {isSavingAppConfig ? "Guardando..." : "Guardar Configuración de Soporte"}
                     </Button>
                </CardContent>
            </Card>

            <Card>
                 <CardHeader>
                    <CardTitle>Configuración de Retiros</CardTitle>
                    <CardDescription>Define las reglas para los retiros de fondos de los usuarios.</CardDescription>
                </CardHeader>
                 <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label htmlFor="min-withdrawal">Monto Mínimo de Retiro (COP)</Label>
                            <Input id="min-withdrawal" type="number" value={minWithdrawal} onChange={(e) => setMinWithdrawal(e.target.value)} placeholder="Ej: 50000" disabled={isSavingWithdrawalConfig}/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="fee-percentage">Comisión por Retiro (%)</Label>
                             <Input id="fee-percentage" type="number" value={feePercentage} onChange={(e) => setFeePercentage(e.target.value)} placeholder="Ej: 5" disabled={isSavingWithdrawalConfig}/>
                        </div>
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div className="space-y-2">
                            <Label htmlFor="start-time">Hora de Inicio de Retiros</Label>
                            <Input id="start-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} disabled={isSavingWithdrawalConfig}/>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="end-time">Hora de Fin de Retiros</Label>
                            <Input id="end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={isSavingWithdrawalConfig}/>
                        </div>
                     </div>
                     <div className="space-y-2">
                        <Label htmlFor="daily-limit">Límite de Retiros Diarios por Usuario</Label>
                        <Input id="daily-limit" type="number" value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} placeholder="Ej: 1" disabled={isSavingWithdrawalConfig}/>
                    </div>
                     <div className="space-y-3">
                        <Label>Días de Retiro Permitidos</Label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {daysOfWeek.map(day => (
                                <div key={day} className="flex items-center space-x-2">
                                    <Checkbox 
                                        id={`day-${day}`} 
                                        checked={allowedDays.includes(day)}
                                        onCheckedChange={(checked) => {
                                            setAllowedDays(prev => checked ? [...prev, day] : prev.filter(d => d !== day))
                                        }}
                                        disabled={isSavingWithdrawalConfig}
                                    />
                                    <Label htmlFor={`day-${day}`} className="text-sm font-normal">{day}</Label>
                                </div>
                            ))}
                        </div>
                     </div>
                      <Button onClick={handleSaveWithdrawalConfig} disabled={isSavingWithdrawalConfig}>
                        <Save className="mr-2 h-4 w-4" />
                        {isSavingWithdrawalConfig ? "Guardando..." : "Guardar Configuración de Retiros"}
                      </Button>
                 </CardContent>
            </Card>
        </div>
    )
}

function TutorialDialog({
  open,
  onOpenChange,
  tutorial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tutorial?: AppTutorial;
  onSave: () => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [order, setOrder] = useState('');
  const [images, setImages] = useState<TutorialImage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const firestore = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    if (tutorial) {
      setTitle(tutorial.title);
      setContent(tutorial.content);
      setOrder(tutorial.order.toString());
      setImages(tutorial.images || []);
    } else {
      setTitle('');
      setContent('');
      setOrder('0');
      setImages([]);
    }
  }, [tutorial, open]);

  const handleAddImage = () => {
    setImages([...images, { url: '', caption: '' }]);
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleImageFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const newImages = [...images];
        newImages[index].url = reader.result as string;
        setImages(newImages);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCaptionChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    index: number
  ) => {
    const newImages = [...images];
    newImages[index].caption = e.target.value;
    setImages(newImages);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    if (!firestore || !title || !content) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Título y contenido son obligatorios.',
      });
      setIsLoading(false);
      return;
    }

    try {
      const tutorialData = {
        title,
        content,
        order: parseInt(order, 10) || 0,
        images: images.filter((img) => img.url),
      };

      if (tutorial) {
        const tutorialRef = doc(firestore, 'tutorials', tutorial.id);
        await setDoc(tutorialRef, tutorialData, { merge: true });
        toast({ title: 'Éxito', description: 'Entrada del tutorial actualizada.' });
      } else {
        const collectionRef = collection(firestore, 'tutorials');
        const newTutorialRef = doc(collectionRef);
        await setDoc(newTutorialRef, { ...tutorialData, id: newTutorialRef.id });
        toast({ title: 'Éxito', description: 'Nueva entrada del tutorial creada.' });
      }
      onSave();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al guardar',
        description: error.message || 'No se pudo guardar la entrada del tutorial.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>{tutorial ? 'Editar' : 'Crear'} Entrada de Tutorial</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-4">
            <div className="space-y-2">
              <Label htmlFor="tutorialTitle">Título</Label>
              <Input
                id="tutorialTitle"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: ¿Cómo invertir?"
                disabled={isLoading}
              />
            </div>
            
            <div className="space-y-4">
              <Label>Imágenes del Tutorial</Label>
              {images.map((image, index) => (
                  <div key={index} className="space-y-2 rounded-md border p-4 relative">
                      <Button variant="ghost" size="icon" onClick={() => handleRemoveImage(index)} className="absolute top-2 right-2 h-6 w-6 text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4" />
                      </Button>
                      <div className="space-y-2">
                          <Label htmlFor={`image-caption-${index}`}>Texto sobre la imagen (Opcional)</Label>
                          <Input
                              id={`image-caption-${index}`}
                              value={image.caption}
                              onChange={(e) => handleCaptionChange(e, index)}
                              placeholder="Describe esta imagen o paso"
                              disabled={isLoading}
                          />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor={`image-file-${index}`}>Archivo de Imagen</Label>
                          <Input
                              id={`image-file-${index}`}
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleImageFileChange(e, index)}
                              disabled={isLoading}
                          />
                      </div>
                      {image.url && (
                          <div className="mt-2 relative h-24 w-24">
                              <Image src={image.url} alt={`Previsualización ${index + 1}`} layout="fill" className="rounded-md object-contain"/>
                          </div>
                      )}
                  </div>
              ))}
              <Button type="button" variant="outline" onClick={handleAddImage} disabled={isLoading} className="w-full">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Añadir otra imagen
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tutorialContent">Contenido Principal</Label>
              <Textarea
                id="tutorialContent"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Explica el paso a paso aquí..."
                className="min-h-[200px]"
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tutorialOrder">Orden</Label>
              <Input
                id="tutorialOrder"
                type="number"
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                placeholder="0"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                  Las entradas se ordenan de menor a mayor.
              </p>
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            <Save className="mr-2" />
            {isLoading ? 'Guardando...' : 'Guardar Entrada'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}


const TutorialTab = () => {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [key, setKey] = useState(0); // To force refetch
    const forceRefetch = () => setKey(prev => prev + 1);

    const tutorialsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'tutorials'), orderBy('order'));
    }, [firestore, key]);

    const { data: tutorials, isLoading } = useCollection<AppTutorial>(tutorialsQuery);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedTutorial, setSelectedTutorial] = useState<AppTutorial | undefined>(undefined);

    const handleOpenDialog = (tutorial?: AppTutorial) => {
        setSelectedTutorial(tutorial);
        setIsDialogOpen(true);
    };

    const handleDelete = async (tutorialId: string) => {
        if (!firestore || !window.confirm('¿Estás seguro de que quieres eliminar esta entrada?')) return;
        
        try {
            await deleteDoc(doc(firestore, 'tutorials', tutorialId));
            toast({ title: 'Éxito', description: 'Entrada eliminada.' });
            forceRefetch();
        } catch (error: any) {
            toast({ variant: "destructive", title: "Error", description: error.message || "No se pudo eliminar la entrada." });
        }
    };

    return (
        <>
            <Card>
                <CardHeader className="flex flex-row items-start justify-between">
                    <div>
                        <CardTitle>Gestionar Tutorial</CardTitle>
                        <CardDescription>Crea y edita las guías de uso de la aplicación.</CardDescription>
                    </div>
                    <Button onClick={() => handleOpenDialog()} size="sm">
                        <PlusCircle className="mr-2" /> Crear Entrada
                    </Button>
                </CardHeader>
                <CardContent>
                    {isLoading && <p>Cargando tutorial...</p>}
                    <div className="space-y-4">
                        {tutorials && tutorials.length > 0 ? (
                            tutorials.map(tutorial => (
                                <div key={tutorial.id} className="flex items-start justify-between p-4 rounded-lg border bg-card">
                                    <div className="prose dark:prose-invert max-w-none w-full">
                                        <h4 className="font-semibold text-lg mt-0 mb-2">{tutorial.title}</h4>
                                        {tutorial.images && tutorial.images.length > 0 && (
                                            <div className="space-y-4 my-4">
                                                {tutorial.images.map((image, index) => (
                                                    <div key={index}>
                                                        {image.caption && <p className="font-semibold text-muted-foreground !my-1">{image.caption}</p>}
                                                        <div className="relative aspect-video w-full max-w-sm">
                                                            <Image
                                                                src={image.url}
                                                                alt={image.caption || tutorial.title}
                                                                fill
                                                                className="rounded-md object-contain"
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{tutorial.content}</p>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(tutorial)}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(tutorial.id)} className="text-destructive hover:text-destructive">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            !isLoading && <p className="text-muted-foreground text-center py-4">No hay entradas en el tutorial todavía.</p>
                        )}
                    </div>
                </CardContent>
            </Card>
            <TutorialDialog
                open={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                tutorial={selectedTutorial}
                onSave={forceRefetch}
            />
        </>
    );
}

// Main Page Component
export default function AdminPage() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isDepositAdmin, setIsDepositAdmin] = useState(false);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);
  const [openMethodDialog, setOpenMethodDialog] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<
    DepositMethod | undefined
  >(undefined);
  const [openPlanDialog, setOpenPlanDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<InvestmentPlan | undefined>(
    undefined
  );
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Data queries
  const methodsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'depositNetworks')) : null),
    [firestore]
  );
  const {
    data: methods,
    isLoading: isLoadingMethods,
    error: errorMethods,
  } = useCollection<DepositMethod>(methodsQuery);

  const depositRequestsQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'depositRequests')) : null),
    [firestore]
  );
  const {
    data: allRequests,
    isLoading: isLoadingRequests,
    error: errorRequests,
  } = useCollection<DepositRequest>(depositRequestsQuery);

  const plansQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'investmentPlans')) : null),
    [firestore]
  );
  const {
    data: plans,
    isLoading: isLoadingPlans,
    error: errorPlans,
  } = useCollection<InvestmentPlan>(plansQuery);

  // Memoized request filtering
  const pendingRequests = useMemo(
    () => allRequests?.filter((r) => r.status === 'pending'),
    [allRequests]
  );
  const processedRequests = useMemo(
    () => allRequests?.filter((r) => r.status !== 'pending').sort((a, b) => new Date(b.decisionDate!).getTime() - new Date(a.decisionDate!).getTime()),
    [allRequests]
  );

  // Permission check effect
  React.useEffect(() => {
    const checkAdminStatus = async () => {
      if (user && firestore) {
        const userDocRef = doc(firestore, 'users', user.uid);
        try {
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
             const userData = userDoc.data();
             setIsSuperAdmin(userData.isSuperAdmin === true);
             setIsDepositAdmin(userData.isDepositAdmin === true);
          } else {
            setIsSuperAdmin(false);
            setIsDepositAdmin(false);
          }
        } catch (e) {
          console.error('Error checking admin status:', e);
          setIsSuperAdmin(false);
          setIsDepositAdmin(false);
        }
      } else {
        setIsSuperAdmin(false);
        setIsDepositAdmin(false);
      }
      setIsLoadingPermissions(false);
    };
    checkAdminStatus();
  }, [user, firestore]);

  // Handler Functions
  const handleOpenMethodDialog = (method?: DepositMethod) => {
    setSelectedMethod(method);
    setOpenMethodDialog(true);
  };

  const handleDeleteMethod = async (methodId: string) => {
    if (
      !firestore ||
      !window.confirm('¿Estás seguro de que quieres eliminar este método?')
    )
      return;
    const docRef = doc(firestore, 'depositNetworks', methodId);
    try {
      await deleteDoc(docRef);
      toast({
        title: 'Eliminado',
        description: 'El método de depósito ha sido eliminado.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error al eliminar',
        description: 'No tienes permisos para realizar esta acción.',
      });
    }
  };

  const handleUpdateRequest = async (
    requestId: string,
    newStatus: 'approved' | 'rejected'
  ) => {
    if (!firestore || !user || actionLoading) return;
    setActionLoading(requestId);

    const requestRef = doc(firestore, 'depositRequests', requestId);

    try {
      const requestSnap = await getDoc(requestRef);
      if (!requestSnap.exists()) throw new Error('La solicitud no existe.');

      const requestData = requestSnap.data() as DepositRequest;
      if (requestData.status !== 'pending') {
        toast({
          title: 'Acción no permitida',
          description: 'Esta solicitud ya ha sido procesada.',
        });
        setActionLoading(null);
        return;
      }

      const decisionDate = new Date().toISOString();
      const adminId = user.uid;
      const batch = writeBatch(firestore);

      batch.update(requestRef, { status: newStatus, decisionDate, adminId });

      if (newStatus === 'approved') {
        const userRef = doc(firestore, `users/${requestData.userId}`);
        const walletRef = doc(
          firestore,
          `users/${requestData.userId}/wallets/${requestData.walletId}`
        );
        const transactionRef = doc(
          collection(
            firestore,
            `users/${requestData.userId}/wallets/${requestData.walletId}/transactions`
          )
        );
        
        const amountToCredit = requestData.amount;
        
        // Check for deposit bonus
        const bonusConfigDoc = await getDoc(doc(firestore, 'deposit_bonus_config', 'main'));
        let finalAmountToCredit = amountToCredit;
        let bonusApplied = false;

        if (bonusConfigDoc.exists()) {
            const bonusConfig = bonusConfigDoc.data() as DepositBonusConfig;
            if (bonusConfig.isActive && bonusConfig.percentage > 0) {
                const bonusAmount = amountToCredit * (bonusConfig.percentage / 100);
                finalAmountToCredit += bonusAmount;
                bonusApplied = true;

                // Create a separate transaction for the bonus
                const bonusTransactionRef = doc(collection(firestore, `users/${requestData.userId}/wallets/${requestData.walletId}/transactions`));
                batch.set(bonusTransactionRef, {
                  id: bonusTransactionRef.id,
                  walletId: requestData.walletId,
                  transactionDate: decisionDate,
                  amount: bonusAmount,
                  description: `Bonificación por depósito (${bonusConfig.percentage}%)`,
                  type: 'deposit-bonus',
                  status: 'completed',
                });
            }
        }
        

        batch.update(walletRef, { balance: increment(finalAmountToCredit) });
        batch.update(userRef, { balance: increment(finalAmountToCredit) });
        
        batch.set(transactionRef, {
          id: transactionRef.id,
          walletId: requestData.walletId,
          transactionDate: decisionDate,
          amount: amountToCredit,
          description: `Depósito aprobado desde ${requestData.networkName}`,
          type: 'deposit-approved',
          status: 'completed',
          referenceNumber: requestData.referenceNumber, // Add reference number
        });

        await batch.commit();

        let successMessage = `Depósito aprobado y saldo actualizado por ${formatCurrency(amountToCredit)}.`;
        if (bonusApplied) {
            successMessage += ` Se añadió una bonificación.`;
        }

        toast({
          title: 'Éxito',
          description: successMessage,
        });
      } else {
        // Rejected
        await batch.commit();
        toast({
          title: 'Solicitud Rechazada',
          description: 'El depósito ha sido marcado como rechazado.',
        });
      }
    } catch (error: any) {
      console.error('Error processing request: ', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'No se pudo procesar la solicitud.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenPlanDialog = (plan?: InvestmentPlan) => {
    setSelectedPlan(plan);
    setOpenPlanDialog(true);
  };

  const handleDeletePlan = async (planId: string) => {
    if (!firestore || !window.confirm('¿Estás seguro de que quieres eliminar este plan? Esta acción no se puede deshacer y no afectará a las inversiones ya existentes.')) return;
    const docRef = doc(firestore, 'investmentPlans', planId);
    try {
      await deleteDoc(docRef);
      toast({
        title: 'Plan Eliminado',
        description: 'El plan de inversión ha sido eliminado y no estará disponible para nuevas inversiones.',
      });
    } catch(error: any) {
      const permissionError = new FirestorePermissionError({
        path: docRef.path,
        operation: 'delete',
      });
      errorEmitter.emit('permission-error', permissionError);
      toast({ variant: "destructive", title: "Error", description: "No tienes permisos para realizar esta acción." });
    }
  };

  const getPlanLimitText = (plan: InvestmentPlan) => {
    if (plan.minInvestment && plan.maxInvestment && plan.minInvestment === plan.maxInvestment) {
      return `Precio: ${formatCurrency(plan.minInvestment)}`;
    }
    if (plan.minInvestment && plan.maxInvestment) {
      return `Min: ${formatCurrency(
        plan.minInvestment
      )} - Max: ${formatCurrency(plan.maxInvestment)}`;
    }
    if (plan.minInvestment) {
      return `Mínimo: ${formatCurrency(plan.minInvestment)}`;
    }
    if (plan.maxInvestment) {
      return `Máximo: ${formatCurrency(plan.maxInvestment)}`;
    }
    return 'Sin límites';
  };

  // Render logic
  if (isLoadingPermissions) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
        <p>Verificando permisos...</p>
      </div>
    );
  }

  if (!isSuperAdmin && !isDepositAdmin) {
    return (
      <div className="flex flex-col items-center gap-8 text-center">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Acceso Denegado</CardTitle>
            <CardDescription>No tienes los permisos necesarios.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Esta área es solo para administradores.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const adminTabs = [
    { value: "deposits", label: "Depósitos", role: ['isSuperAdmin', 'isDepositAdmin'], icon: Upload },
    { value: "withdrawals", label: "Retiros", role: ['isSuperAdmin', 'isDepositAdmin'], icon: Send },
    { value: "plans", label: "Planes", role: ['isSuperAdmin', 'isDepositAdmin'], icon: Briefcase },
    { value: "users", label: "Usuarios", role: ['isSuperAdmin'], icon: Users },
    { value: "tutorial", label: "Tutorial", role: ['isSuperAdmin', 'isDepositAdmin'], icon: BookOpen },
    { value: "methods", label: "Métodos", role: ['isSuperAdmin'], icon: Paperclip },
    { value: "config", label: "Configuración", role: ['isSuperAdmin'], icon: Settings },
  ];

  const visibleTabs = adminTabs.filter(tab => {
      if (isSuperAdmin) return true;
      if (isDepositAdmin && tab.role.includes('isDepositAdmin')) return true;
      return false;
  }).sort((a, b) => {
      const order = {
        deposits: 1,
        withdrawals: 2,
        plans: 3,
        users: 4,
        tutorial: 5,
        methods: 6,
        config: 7
      };
      return order[a.value as keyof typeof order] - order[b.value as keyof typeof order];
  });


  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            Panel de Administrador
          </h1>
          <p className="text-muted-foreground">
            Gestiona la aplicación y las solicitudes de los usuarios.
          </p>
        </div>
      </div>

      <Tabs defaultValue={visibleTabs[0].value} className="w-full">
        <div className="overflow-x-auto pb-2">
          <TabsList className="flex w-max justify-start">
            {visibleTabs.map(tab => (
              <TabsTrigger key={tab.value} value={tab.value} className="flex-shrink-0">
                  {tab.icon && <tab.icon className="mr-2 h-4 w-4" />}
                  {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="deposits">
          <Card>
            <CardHeader>
              <CardTitle>Solicitudes de Depósito</CardTitle>
              <CardDescription>
                Aprueba o rechaza los depósitos de los usuarios.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingRequests && <p>Cargando solicitudes...</p>}
              {errorRequests && (
                <p className="text-destructive">Error al cargar solicitudes.</p>
              )}
              <h3 className="mb-4 text-lg font-semibold flex items-center gap-2">
                <Hourglass className="h-5 w-5" /> Pendientes
              </h3>
              <DepositRequests
                requests={pendingRequests}
                onUpdateRequest={handleUpdateRequest}
                actionLoading={actionLoading}
              />
              <h3 className="mt-8 mb-4 text-lg font-semibold">Procesadas</h3>
              <DepositRequests
                requests={processedRequests}
                onUpdateRequest={handleUpdateRequest}
                actionLoading={actionLoading}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals">
            <WithdrawalRequestsTab />
        </TabsContent>

        <TabsContent value="plans">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle>Planes de Inversión</CardTitle>
                <CardDescription>
                  Crea y edita los planes de inversión disponibles.
                </CardDescription>
              </div>
              <Button onClick={() => handleOpenPlanDialog()} size="sm">
                <PlusCircle className="mr-2" /> Crear Plan
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingPlans && <p>Cargando planes...</p>}
              {errorPlans && (
                <p className="text-destructive">Error al cargar planes.</p>
              )}
              <div className="space-y-4">
                {plans && plans.length > 0 ? (
                  plans.map((plan) => (
                    <div
                      key={plan.id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card"
                    >
                      <div className="flex items-center gap-4">
                        <Image src={plan.imageUrl || 'https://picsum.photos/seed/plan/64/64'} alt={plan.name} width={48} height={48} className="rounded-md" />
                        <div className="flex-1">
                          <p className="font-semibold">{plan.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {plan.durationDays} días - {plan.dailyReturnPercentage}%
                            diario
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {getPlanLimitText(plan)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <div className="flex items-center space-x-2">
                            <Switch
                                id={`active-switch-${plan.id}`}
                                checked={plan.isActive}
                                disabled
                            />
                            <Label htmlFor={`active-switch-${plan.id}`} className="text-sm font-medium">
                                {plan.isActive ? 'Activo' : 'Inactivo'}
                            </Label>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenPlanDialog(plan)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="sr-only">Editar Plan</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePlan(plan.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Eliminar Plan</span>
                        </Button>
                      </div>
                    </div>
                  ))
                ) : (
                  !isLoadingPlans && (
                    <p>No hay planes de inversión configurados.</p>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="tutorial">
          <TutorialTab />
        </TabsContent>

        {isSuperAdmin && (
          <>
            <TabsContent value="users">
              <Card>
                <CardHeader>
                  <CardTitle>Gestión de Usuarios</CardTitle>
                  <CardDescription>
                    Navega a la sección dedicada para gestionar a todos los
                    usuarios.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/dashboard/admin/users" passHref>
                    <Button className="w-full">
                      <Users className="mr-2 h-4 w-4" />
                      Ir a Gestión de Usuarios
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="methods">
              <Card>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle>Métodos de Depósito</CardTitle>
                    <CardDescription>
                      Configura los métodos para depósitos (Cripto y Nequi).
                    </CardDescription>
                  </div>
                  <Button onClick={() => handleOpenMethodDialog()} size="sm">
                    <PlusCircle className="mr-2" /> Agregar Método
                  </Button>
                </CardHeader>
                <CardContent>
                  {isLoadingMethods && <p>Cargando métodos...</p>}
                  {errorMethods && (
                    <p className="text-destructive">Error al cargar métodos.</p>
                  )}
                  <div className="space-y-4">
                    {methods && methods.length > 0 ? (
                      methods.map((method) => (
                        <div
                          key={method.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card"
                        >
                          <div className="flex items-center gap-4">
                            {method.type === 'fiat' ? <Banknote className="h-6 w-6 text-green-500" /> : <Bitcoin className="h-6 w-6 text-orange-500"/>}
                            <div>
                              <p className="font-semibold">{method.name}</p>
                              {method.address && (
                                <p className="text-sm text-muted-foreground break-all">
                                  {method.address}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenMethodDialog(method)}
                            >
                              <Pencil className="h-4 w-4" />
                              <span className="sr-only">Editar</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteMethod(method.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Eliminar</span>
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      !isLoadingMethods && (
                        <p>No hay métodos de depósito configurados.</p>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

             <TabsContent value="config">
                <ConfigTab />
            </TabsContent>
          </>
        )}
      </Tabs>

      <MethodDialog
        open={openMethodDialog}
        onOpenChange={setOpenMethodDialog}
        method={selectedMethod}
      />
      <PlanDialog
        open={openPlanDialog}
        onOpenChange={setOpenPlanDialog}
        plan={selectedPlan}
      />
    </div>
  );
}
