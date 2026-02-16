'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import type { AppTutorial } from '@/lib/types';
import { BookOpen, Loader2 } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function TutorialPage() {
    const firestore = useFirestore();

    const tutorialsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'tutorials'), orderBy('order'));
    }, [firestore]);

    const { data: tutorials, isLoading } = useCollection<AppTutorial>(tutorialsQuery);

    return (
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight font-headline flex items-center gap-2">
                    <BookOpen /> Tutorial de la Aplicación
                </h1>
                <p className="text-muted-foreground">
                    Encuentra respuestas a preguntas frecuentes y aprende a usar la plataforma.
                </p>
            </div>

            <Card>
                <CardContent className="pt-6">
                    {isLoading && (
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Cargando tutorial...</span>
                        </div>
                    )}
                    {!isLoading && (!tutorials || tutorials.length === 0) ? (
                        <p className="text-center text-muted-foreground">
                            El tutorial aún no está disponible. Vuelve a intentarlo más tarde.
                        </p>
                    ) : (
                        <Accordion type="single" collapsible className="w-full">
                            {tutorials?.map((item) => (
                                <AccordionItem value={item.id} key={item.id}>
                                    <AccordionTrigger className="text-lg">{item.title}</AccordionTrigger>
                                    <AccordionContent>
                                        {item.images && item.images.length > 0 && (
                                            <div className="space-y-6 mb-4">
                                                {item.images.map((image, index) => (
                                                    <div key={index}>
                                                        {image.caption && (
                                                            <p className="mb-2 font-semibold text-foreground">{image.caption}</p>
                                                        )}
                                                        <div className="relative h-64 w-full">
                                                            <Image
                                                                src={image.url}
                                                                alt={image.caption || item.title}
                                                                fill
                                                                className="rounded-lg object-contain"
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        <div className="prose dark:prose-invert max-w-none text-base text-muted-foreground whitespace-pre-wrap">
                                            {item.content}
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            ))}
                        </Accordion>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
