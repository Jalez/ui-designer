"use client";

import { CreditCard, Download, ExternalLink, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Invoice } from "@/app/api/_lib/services/stripeService/subscriptionService";
import { fetchBillingHistory } from "./service/subscription";
import { useBillingStore } from "./stores/billingStore";

interface BillingHistoryProps {
  initialInvoices?: Invoice[];
}

export function BillingHistory({ initialInvoices }: BillingHistoryProps) {
  const { invoices: storeInvoices, isLoading: storeLoading, hasFetched, fetchInvoices } = useBillingStore();
  // Only show loading if we don't have initial data, store hasn't fetched, and store isn't loading
  const [loading, setLoading] = useState(!initialInvoices && !hasFetched && storeInvoices.length === 0 && !storeLoading);
  const [error, setError] = useState<string | null>(null);

  // Combined loading state from both component and store
  const isLoading = loading || storeLoading;

  useEffect(() => {
    // If we have initial data, use it
    if (initialInvoices) {
      return;
    }

    // If store has data, use it immediately - no need to fetch
    if (storeInvoices.length > 0) {
      setLoading(false);
      return;
    }

    // If store has fetched but no data (no invoices), we're done
    if (hasFetched && storeInvoices.length === 0) {
      setLoading(false);
      return;
    }

    // Only fetch if store hasn't fetched yet and is not currently loading
    // This prevents unnecessary refetches when navigating back to the page
    if (!hasFetched && !storeLoading) {
      fetchInvoices().catch((err) => {
        console.error("Failed to fetch billing history from store:", err);
        // Fallback to direct API call
        fetchBillingHistoryDirect();
      });
    } else if (storeLoading) {
      // Store is loading, wait for it
      setLoading(true);
    } else {
      // Store has data or has fetched, we're done
      setLoading(false);
    }
  }, [initialInvoices, storeInvoices.length, hasFetched, storeLoading, fetchInvoices]);

  const fetchBillingHistoryDirect = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchBillingHistory();
      // Update the store with the fetched data
      useBillingStore.getState().setInvoices(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load billing history");
    } finally {
      setLoading(false);
    }
  };

  // Use store data if available, otherwise use initial props
  const invoices = initialInvoices || storeInvoices;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toLowerCase(),
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20";
      case "open":
        return "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20";
      case "void":
        return "text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20";
      default:
        return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20";
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-50 dark:bg-muted/30 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Billing History</h2>
        <div className="text-center py-6">
          <Loader2 className="h-8 w-8 text-gray-400 mx-auto mb-3 animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading billing history...</p>
        </div>
      </div>
    );
  }

  // Check for store error as well
  const storeError = useBillingStore.getState().error;
  if (error || storeError) {
    return (
      <div className="bg-gray-50 dark:bg-muted/30 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Billing History</h2>
        <div className="text-center py-6">
          <CreditCard className="h-8 w-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-500 dark:text-red-400">Failed to load billing history</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{error || storeError}</p>
        </div>
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-muted/30 rounded-lg p-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Billing History</h2>
        <div className="text-center py-6">
          <CreditCard className="h-8 w-8 text-gray-400 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No billing history yet</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Your invoices will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-muted/30 rounded-lg p-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Billing History</h2>

      <div className="space-y-3">
        {invoices.map((invoice) => (
          <div
            key={invoice.id}
            className="rounded-md hover:bg-gray-100/50 dark:hover:bg-muted/30 transition-colors"
          >
            <div className="p-3">
              {/* Compact header row */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <CreditCard className="h-3 w-3 text-gray-400 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {invoice.description}
                  </span>
                </div>
                <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${getStatusColor(invoice.status)}`}>
                  {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                </span>
              </div>

              {/* Compact details row */}
              <div className="flex items-center justify-between">
                <div className="flex flex-col text-xs text-gray-500 dark:text-gray-400">
                  <span>{formatDate(invoice.date)}</span>
                  <span className="text-gray-400 dark:text-gray-500">
                    {formatDate(invoice.periodStart)} - {formatDate(invoice.periodEnd)}
                  </span>
                </div>

                <div className="flex flex-col items-end space-y-2">
                  <div className="text-right">
                    <div className="font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </div>
                  </div>

                  <div className="flex space-x-1">
                    {invoice.hostedUrl && (
                      <a
                        href={invoice.hostedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title="View invoice"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}

                    {invoice.downloadUrl && (
                      <a
                        href={invoice.downloadUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Download PDF"
                      >
                        <Download className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
