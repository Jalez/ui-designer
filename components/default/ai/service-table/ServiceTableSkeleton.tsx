"use client";

import { Coins } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/tailwind/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/tailwind/ui/table";
import { LocalModelsIndicator } from "../models/components/LocalModelsIndicator";

interface LoadingSkeletonProps {
    localModelsCount: number;
}

const CORE_SERVICES = [
    {
        id: "text-generation",
        serviceName: "AI Text Generation",
    },
    {
        id: "image-generation",
        serviceName: "AI Image Generation",
    },
    {
        id: "image-text-extraction",
        serviceName: "Image Text Extraction",
    },
    {
        id: "pdf-text-extraction",
        serviceName: "PDF Text Extraction",
    },
] as const;

export function LoadingSkeleton({ localModelsCount }: LoadingSkeletonProps) {
    return (
        <Card className="bg-gray-50 dark:bg-card">
            <CardHeader className="bg-white dark:bg-card">
                <CardTitle className="text-gray-900 dark:text-white flex items-center gap-2">
                    <Coins className="h-5 w-5 text-yellow-500" />
                    Available Services
                    <LocalModelsIndicator localModelsCount={localModelsCount} />
                </CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400">Loading services...</CardDescription>
            </CardHeader>
            <CardContent className="bg-white dark:bg-card p-0">
                <Table>
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
                        {CORE_SERVICES.map((service, index) => (
                            <TableRow
                                key={`skeleton-${service.id}`}
                                className="animate-pulse"
                            >
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <div className="h-4 w-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
                                        <div className="h-4 w-32 bg-gray-300 dark:bg-gray-600 rounded"></div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="h-4 w-48 bg-gray-300 dark:bg-gray-600 rounded"></div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1">
                                        <div className="h-4 w-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
                                        <div className="h-4 w-16 bg-gray-300 dark:bg-gray-600 rounded"></div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="h-6 w-16 bg-gray-300 dark:bg-gray-600 rounded"></div>
                                </TableCell>
                                <TableCell>
                                    <div className="h-8 w-32 bg-gray-300 dark:bg-gray-600 rounded"></div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
