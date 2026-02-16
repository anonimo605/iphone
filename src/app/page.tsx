'use client';

import { useState, useEffect, Suspense } from "react";
import Image from 'next/image';
import { useRouter, useSearchParams } from "next/navigation";
import { Wallet, UserPlus, Phone, Lock, Hash, DollarSign, ShieldCheck, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, useFirestore } from "@/firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { generateReferralCodeFromUID } from "@/lib/referral";
import type { AppConfig } from '@/lib/types';

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isSignUp, setIsSignUp] = useState(false);

  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");

  useEffect(() => {
    const refFromUrl = searchParams.get('ref');
    if (refFromUrl) {
      setReferralCode(refFromUrl);
      setIsSignUp(true);
    }
  }, [searchParams]);

  const formatEmailFromPhone = (phone: string) => `${phone}@email.com`;

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !firestore) return;
    if (password !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "Error de registro",
        description: "Las contraseñas no coinciden.",
      });
      return;
    }
    try {
      const email = formatEmailFromPhone(phoneNumber);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const ownReferralCode = generateReferralCodeFromUID(user.uid);

      const userDocRef = doc(firestore, "users", user.uid);
      const userData = {
        id: user.uid,
        email: user.email,
        firstName: "",
        lastName: "",
        registrationDate: new Date().toISOString(),
        isSuperAdmin: false,
        referralCode: ownReferralCode,
        referredBy: referralCode || null,
        balance: 0,
        hasInvested: false,
      };
      await setDoc(userDocRef, userData);

      const walletId = doc(doc(firestore, 'users', user.uid), 'wallets', 'main').id;
      const walletDocRef = doc(firestore, `users/${user.uid}/wallets`, walletId);
      const walletData = {
        id: walletId,
        userId: user.uid,
        name: "Billetera Principal",
        balance: 0, 
        creationDate: new Date().toISOString(),
      };
      await setDoc(walletDocRef, walletData);

      router.push("/dashboard");
    } catch (error: any) {
      let description = "No se pudo crear la cuenta. Por favor, inténtalo de nuevo.";
      if (error.code === 'auth/email-already-in-use') {
        description = "Este número de teléfono ya está registrado. Por favor, inicia sesión.";
      }
      toast({
        variant: "destructive",
        title: "Error de registro",
        description: description,
      });
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth) return;
    try {
      const email = formatEmailFromPhone(phoneNumber);
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/dashboard");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error al iniciar sesión",
        description: "Las credenciales son incorrectas. Inténtalo de nuevo.",
      });
    }
  };

  return (
    <div className="w-full flex min-h-screen items-center justify-center py-12">
        <div className="mx-auto grid w-[380px] gap-6">
          <div className="flex justify-center items-center">
            <Smartphone className="h-24 w-24 text-primary" />
          </div>
          <div className="grid gap-2 text-center">
             <h2 className="text-2xl font-bold">
                {isSignUp ? "Crea una cuenta" : "Bienvenido de nuevo"}
              </h2>
              <p className="text-balance text-muted-foreground">
                {isSignUp ? "Ingresa tus datos para unirte." : "Accede a tu cuenta para continuar."}
              </p>
          </div>

          {isSignUp ? (
             <form onSubmit={handleSignUp} className="grid gap-4">
               <div className="grid gap-2">
                  <Label htmlFor="phone-number">Número de Teléfono</Label>
                  <Input
                    id="phone-number"
                    type="tel"
                    placeholder="Tu número de teléfono"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Crea una contraseña segura"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                 <div className="grid gap-2">
                  <Label htmlFor="confirm-password">Repetir Contraseña</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="Confirma tu contraseña"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
                 <div className="grid gap-2">
                  <Label htmlFor="referral">Código de Referido (Opcional)</Label>
                  <Input
                    id="referral"
                    type="text"
                    placeholder="Introduce el código de referido"
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full">
                  Registrarse
                </Button>
             </form>
          ) : (
            <form onSubmit={handleSignIn} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="phone-number-signin">Número de Teléfono</Label>
                <Input
                  id="phone-number-signin"
                  type="tel"
                  placeholder="Tu número de teléfono"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center">
                  <Label htmlFor="password-signin">Contraseña</Label>
                </div>
                <Input
                  id="password-signin"
                  type="password"
                  placeholder="Introduce tu contraseña"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full">
                Iniciar Sesión
              </Button>
            </form>
          )}

           <div className="mt-4 flex justify-center items-center gap-2 text-sm text-green-600 font-medium">
             <ShieldCheck className="h-4 w-4" />
             <span>Verificado</span>
           </div>

           <div className="mt-2 text-center text-sm">
            {isSignUp ? "¿Ya tienes una cuenta?" : "¿No tienes una cuenta?"}{" "}
            <button onClick={() => setIsSignUp(!isSignUp)} className="underline font-semibold text-primary">
              {isSignUp ? "Inicia Sesión" : "Regístrate"}
            </button>
          </div>
        </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <AuthPageContent />
    </Suspense>
  );
}
