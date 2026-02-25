"use client";

import { Coins } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/tailwind/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/tailwind/ui/table";
import { TooltipProvider } from "@/components/tailwind/ui/tooltip";

import { LocalModelsIndicator } from "../models/components/LocalModelsIndicator";
import { ServiceRow } from "./ServiceRow";
import type { Model, ModelPricing } from "../models/types";
import type { OcrModel } from "../models/stores/ocrModelsStore";

export interface Service {
    id: string;
    serviceName: string;
    serviceDescription: string;
    serviceCategory: string;
    isActive: boolean;
    availableModels: Model[] | OcrModel[];
    currentDefaultModel: string | undefined;
    onModelChange: (modelId: string) => Promise<void> | void;
    pricingType: keyof ModelPricing;
    calculateCredits: (price: string, model?: any) => number;
}

interface ServiceTableProps {
    services: Service[];
    localModelsCount: number;
}

export function ServiceTable({ services, localModelsCount }: ServiceTableProps) {




    return (
        <TooltipProvider>
            <Card className="bg-gray-50 dark:bg-card">
                <CardHeader className="bg-white dark:bg-card">
                    <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                        <Coins className="h-5 w-5 text-yellow-500" />
                        Available Services
                        <LocalModelsIndicator localModelsCount={localModelsCount} />
                    </CardTitle>
                    <CardDescription className="text-gray-600 dark:text-gray-400">
                        Services available on your plan with their credit costs
                    </CardDescription>
                </CardHeader>
                <CardContent className="bg-white dark:bg-card p-0">
                    <Table className="w-full border-none">
                        <TableHeader className="bg-gray-100 dark:bg-card">
                            <TableRow>
                                <TableHead className="text-gray-900 dark:text-white font-semibold">Service</TableHead>
                                <TableHead className="text-gray-900 dark:text-white font-semibold">Description</TableHead>
                                <TableHead className="text-gray-900 dark:text-white font-semibold">Credit Cost</TableHead>
                                <TableHead className="text-gray-900 dark:text-white font-semibold">Status</TableHead>
                                <TableHead className="text-gray-900 dark:text-white font-semibold">Default Model</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {services.map((service) => (
                                <ServiceRow
                                    key={service.id}
                                    service={service}
                                />
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TooltipProvider>
    );
}
