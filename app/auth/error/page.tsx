"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense, useEffect, useState } from "react";
import { PageContainer } from "@/components/scriba/ui/PageContainer";
import { PageLoadingSpinner } from "@/components/scriba/ui/PageLoadingSpinner";

function AuthErrorContent() {
  const router = useRouter();

  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      console.error("Auth error page: Error parameter found:", errorParam);

      switch (errorParam) {
        case "OAuthCallback":
          setError("Authentication callback failed. This usually means there was an issue with the OAuth flow.");
          break;
        case "Configuration":
          setError("Authentication configuration error. Please contact support.");
          break;
        case "AccessDenied":
          setError("Access denied. You may have cancelled the sign-in process.");
          break;
        case "Verification":
          setError("Verification failed. Please try signing in again.");
          break;
        default:
          setError(`Authentication error: ${errorParam}`);
      }
    }
  }, [searchParams]);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await signIn("google", { callbackUrl: "/" });
    } catch (error) {
      console.error("Retry sign in failed:", error);
      setIsRetrying(false);
    }
  };

  return (
    <PageContainer className="flex items-center justify-center">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
            <AlertCircle className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Authentication Error</h2>
          <p className="mt-2 text-sm text-gray-600">There was a problem with the sign-in process</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white dark:text-gray-900 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50"
          >
            {isRetrying ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Retrying...
              </>
            ) : (
              "Try Again"
            )}
          </button>

          <button
            type="button"
            onClick={() => router.push("/")}
            className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            Go Back Home
          </button>
        </div>

        <div className="text-center text-xs text-gray-500">
          <p>If this problem persists, please check your internet connection</p>
          <p>or try clearing your browser cookies and cache.</p>
        </div>
      </div>
    </PageContainer>
  );
}

export default function AuthError() {
  return (
    <Suspense fallback={<PageLoadingSpinner text="Loading error details..." fullPage={true} />}>
      <AuthErrorContent />
    </Suspense>
  );
}
