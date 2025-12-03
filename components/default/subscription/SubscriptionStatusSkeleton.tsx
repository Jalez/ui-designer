"use client";

export function SubscriptionStatusSkeleton() {
    return (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-200 dark:border-gray-700 animate-pulse">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                    <div className="h-5 w-5 bg-gray-300 dark:bg-gray-700 rounded"></div>
                    <div className="h-6 w-24 bg-gray-300 dark:bg-gray-700 rounded"></div>
                </div>
                <div className="flex items-center space-x-1">
                    <div className="h-4 w-4 bg-gray-300 dark:bg-gray-700 rounded"></div>
                    <div className="h-4 w-16 bg-gray-300 dark:bg-gray-700 rounded"></div>
                </div>
            </div>

            <div className="h-4 w-32 bg-gray-300 dark:bg-gray-700 rounded mb-3"></div>

            <div className="flex space-x-2">
                <div className="h-8 w-32 bg-gray-300 dark:bg-gray-700 rounded"></div>
            </div>
        </div>
    );
}
