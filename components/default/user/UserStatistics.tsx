"use client";

import { Activity, Clock, FileText, HardDrive } from "lucide-react";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useId, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/tailwind/ui/card";
import { Checkbox } from "@/components/tailwind/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/tailwind/ui/select";
import { Skeleton } from "@/components/tailwind/ui/skeleton";
import { CreditUsageChart, ModelUsageChart, ServiceUsageChart } from "../admin/charts";
import { StorageManagementModal } from "./StorageManagementModal";
import { useStorageStatisticsStore } from "./stores/storageStatisticsStore";

interface UserInfo {
  email: string;
  name: string;
  current_credits: number;
  plan_name: string | null;
  joined_at: Date | null;
  documentCount: number;
}

interface StatisticsData {
  data: Array<{
    date: string;
    credits: number;
    monetary_value: number;
  }>;
  userEmail: string;
  days: number;
  totalCredits: number;
  totalMonetaryValue: number;
  modelUsage: any[];
  serviceBreakdown: any[];
  userInfo: UserInfo;
  totalStorageBytes: number;
  storageLimitBytes: number;
}

export default function UserStatistics() {
  const { data: session } = useSession();
  const [statistics, setStatistics] = useState<StatisticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartDays, setChartDays] = useState<number>(30);
  const [storageModalOpen, setStorageModalOpen] = useState(false);
  const [visibleCharts, setVisibleCharts] = useState({
    creditUsage: true,
    serviceBreakdown: true,
    modelUsage: true,
  });

  // Use storage statistics from store - select values individually to avoid infinite loops
  const totalStorageBytes = useStorageStatisticsStore((state) => state.totalStorageBytes);
  const storageLimitBytes = useStorageStatisticsStore((state) => state.storageLimitBytes);
  const fetchStorageStatistics = useStorageStatisticsStore((state) => state.fetchStorageStatistics);

  const creditUsageId = useId();
  const serviceBreakdownId = useId();
  const modelUsageId = useId();

  const fetchStatistics = useCallback(async () => {
    if (!session?.userId) {
      console.error("User ID not available in session");
      setStatistics(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/statistics/${session.userId}/read?days=${chartDays}`);
      if (response.ok) {
        const data = await response.json();
        setStatistics(data);
        // Update storage statistics store directly from API response to avoid duplicate calls
        useStorageStatisticsStore.getState().setStorageStatistics(
          data.totalStorageBytes || 0,
          data.storageLimitBytes || 0,
        );
      } else {
        const errorData = await response.json();
        console.error("Failed to fetch statistics:", errorData.error || "Unknown error");
        setStatistics(null);
      }
    } catch (error) {
      console.error("Error fetching statistics:", error);
      setStatistics(null);
    } finally {
      setLoading(false);
    }
  }, [session?.userId, chartDays]);

  useEffect(() => {
    if (session?.userId) {
      fetchStatistics();
    }
  }, [session?.userId, fetchStatistics]);

  // Note: Storage statistics are now updated from the main API response
  // This useEffect is kept for backward compatibility and refresh scenarios
  useEffect(() => {
    if (session?.userId && !statistics) {
      // Only fetch storage if we don't have statistics yet (initial load)
      fetchStorageStatistics(session.userId);
    }
  }, [session?.userId, fetchStorageStatistics, statistics]);

  const formatDate = (date: Date | string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";

    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / k ** i).toFixed(1)) + " " + sizes[i];
  };

  const getStorageUsagePercentage = (used: number, limit: number): number => {
    if (limit === 0) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  const getStorageColor = (percentage: number): string => {
    if (percentage >= 95) return "bg-red-500";
    if (percentage >= 80) return "bg-yellow-500";
    return "bg-green-500";
  };

  // Render skeleton loaders instead of blocking full page
  if (loading || !statistics) {
    return (
      <div className="space-y-6">
        {/* Summary Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Documents Created Card Skeleton */}
          <Card className="bg-gray-50 dark:bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-32" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>

          {/* Credits Used Card Skeleton */}
          <Card className="bg-gray-50 dark:bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-32" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-24" />
            </CardContent>
          </Card>

          {/* Storage Used Card Skeleton */}
          <Card className="bg-gray-50 dark:bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-32" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-8 w-40" />
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <Skeleton className="h-2 w-3/4 rounded-full" />
                </div>
                <Skeleton className="h-3 w-16" />
              </div>
            </CardContent>
          </Card>

          {/* Member Since Card Skeleton */}
          <Card className="bg-gray-50 dark:bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-32" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-32" />
            </CardContent>
          </Card>
        </div>

        {/* Account Overview Skeleton */}
        <Card className="bg-gray-50 dark:bg-muted/30">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-6 w-32" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Analytics Section Skeleton */}
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>

        {/* Chart Controls Skeleton */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>

        {/* Charts Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (statistics.totalCredits === 0) {
    return (
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-gray-50 dark:bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documents Created
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{statistics.userInfo.documentCount}</div>
            </CardContent>
          </Card>

          <Card className="bg-gray-50 dark:bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Credits Used ({chartDays}d)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {Math.round(statistics.totalCredits).toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card
            className="bg-gray-50 dark:bg-muted/30 cursor-pointer hover:bg-gray-100 dark:hover:bg-muted/50 transition-colors"
            onClick={() => setStorageModalOpen(true)}
          >
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <HardDrive className="h-4 w-4" />
                Storage Used
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatBytes(totalStorageBytes)} / {formatBytes(storageLimitBytes)}
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${getStorageColor(
                      getStorageUsagePercentage(totalStorageBytes, storageLimitBytes),
                    )}`}
                    style={{
                      width: `${Math.min(
                        getStorageUsagePercentage(totalStorageBytes, storageLimitBytes),
                        100,
                      )}%`,
                    }}
                  />
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {getStorageUsagePercentage(totalStorageBytes, storageLimitBytes).toFixed(1)}% used
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-50 dark:bg-muted/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Member Since
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                {formatDate(statistics.userInfo.joined_at)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Account Overview */}
        <Card className="bg-gray-50 dark:bg-muted/30">
          <CardHeader>
            <CardTitle className="text-gray-900 dark:text-white">Account Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Current Plan</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                  {statistics.userInfo.plan_name || "Free"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Available Credits</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                  {Math.round(statistics.userInfo.current_credits).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1 truncate">
                  {statistics.userInfo.email}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* No Credit Usage Message */}
        <div className="text-center py-12">
          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No credit usage analytics</h3>
        </div>

        {/* Storage Management Modal */}
        <StorageManagementModal
          open={storageModalOpen}
          onOpenChange={setStorageModalOpen}
          totalStorageBytes={totalStorageBytes}
          storageLimitBytes={storageLimitBytes}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gray-50 dark:bg-muted/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Documents Created
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{statistics.userInfo.documentCount}</div>
          </CardContent>
        </Card>

        <Card className="bg-gray-50 dark:bg-muted/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Credits Used ({chartDays}d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {Math.round(statistics.totalCredits).toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card
          className="bg-gray-50 dark:bg-muted/30 cursor-pointer hover:bg-gray-100 dark:hover:bg-muted/50 transition-colors"
          onClick={() => setStorageModalOpen(true)}
        >
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <HardDrive className="h-4 w-4" />
              Storage Used
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatBytes(totalStorageBytes)} / {formatBytes(storageLimitBytes)}
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${getStorageColor(
                        getStorageUsagePercentage(totalStorageBytes, storageLimitBytes),
                  )}`}
                  style={{
                    width: `${Math.min(
                      getStorageUsagePercentage(totalStorageBytes, storageLimitBytes),
                      100,
                    )}%`,
                  }}
                />
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {getStorageUsagePercentage(totalStorageBytes, storageLimitBytes).toFixed(1)}% used
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-50 dark:bg-muted/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Member Since
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-semibold text-purple-600 dark:text-purple-400">
              {formatDate(statistics.userInfo.joined_at)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Account Overview */}
      <Card className="bg-gray-50 dark:bg-muted/30">
        <CardHeader>
          <CardTitle className="text-gray-900 dark:text-white">Account Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Current Plan</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                {statistics.userInfo.plan_name || "Free"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Available Credits</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                {Math.round(statistics.userInfo.current_credits).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1 truncate">
                {statistics.userInfo.email}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analytics Section */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Usage Analytics</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Time Range:</span>
          <Select value={chartDays.toString()} onValueChange={(value) => setChartDays(parseInt(value, 10))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
              <SelectItem value="180">180 days</SelectItem>
              <SelectItem value="365">365 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Chart Controls */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <Checkbox
            id={creditUsageId}
            checked={visibleCharts.creditUsage}
            onCheckedChange={(checked) => setVisibleCharts((prev) => ({ ...prev, creditUsage: checked as boolean }))}
          />
          <label htmlFor={creditUsageId} className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
            Credit Timeline
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id={serviceBreakdownId}
            checked={visibleCharts.serviceBreakdown}
            onCheckedChange={(checked) =>
              setVisibleCharts((prev) => ({ ...prev, serviceBreakdown: checked as boolean }))
            }
          />
          <label htmlFor={serviceBreakdownId} className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
            Service Breakdown (#)
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id={modelUsageId}
            checked={visibleCharts.modelUsage}
            onCheckedChange={(checked) => setVisibleCharts((prev) => ({ ...prev, modelUsage: checked as boolean }))}
          />
          <label htmlFor={modelUsageId} className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
            Model Usage
          </label>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {visibleCharts.creditUsage && (
          <CreditUsageChart
            userEmail={statistics.userEmail}
            days={chartDays}
            title="My Credit Usage"
            description={`Your credit usage over the last ${chartDays} days`}
            data={statistics.data}
            totalCredits={statistics.totalCredits}
          />
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {visibleCharts.modelUsage && (
          <ModelUsageChart
            userEmail={statistics.userEmail}
            days={chartDays}
            metricType="usage"
            title="My Most Used Models"
            description={`Your most frequently used AI models in the last ${chartDays} days`}
            modelUsage={statistics.modelUsage}
          />
        )}
        {visibleCharts.serviceBreakdown && (
          <ServiceUsageChart
            userEmail={statistics.userEmail}
            days={chartDays}
            metricType="credits"
            description={`Your service usage breakdown by credits in the last ${chartDays} days`}
            serviceBreakdown={statistics.serviceBreakdown}
          />
        )}
      </div>

      {/* Storage Management Modal */}
      {statistics && (
        <StorageManagementModal
          open={storageModalOpen}
          onOpenChange={setStorageModalOpen}
          totalStorageBytes={totalStorageBytes}
          storageLimitBytes={storageLimitBytes}
        />
      )}
    </div>
  );
}
