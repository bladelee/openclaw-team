/**
 * OAuth Callback Page
 * Handles OAuth callback from Liuma Auth Center
 */

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export function CallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { auth } = useAuth();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      const errorParam = searchParams.get("error");
      const errorDescription = searchParams.get("error_description");

      if (errorParam) {
        setStatus("error");
        setError(errorDescription || errorParam);
        setTimeout(() => navigate("/login", { replace: true }), 3000);
        return;
      }

      // Better Auth should have already set the cookie
      // We just need to verify the session exists
      try {
        const session = await auth.getSession();

        if (session && session.user) {
          setStatus("success");
          setTimeout(() => navigate("/", { replace: true }), 1000);
        } else {
          setStatus("error");
          setError("Failed to create session");
          setTimeout(() => navigate("/login", { replace: true }), 3000);
        }
      } catch (err) {
        console.error("Callback error:", err);
        setStatus("error");
        setError(err instanceof Error ? err.message : "Authentication failed");
        setTimeout(() => navigate("/login", { replace: true }), 3000);
      }
    };

    void handleCallback();
  }, [auth, searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center p-8">
        {status === "processing" && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">正在登录...</p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="text-green-600 mb-4">
              <svg
                className="mx-auto h-16 w-16"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="text-gray-900 font-semibold">登录成功！</p>
            <p className="text-gray-600 text-sm mt-2">正在跳转...</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-red-600 mb-4">
              <svg
                className="mx-auto h-16 w-16"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <p className="text-gray-900 font-semibold">登录失败</p>
            {error && <p className="text-gray-600 text-sm mt-2">{error}</p>}
            <p className="text-gray-500 text-sm mt-2">即将返回登录页...</p>
          </>
        )}
      </div>
    </div>
  );
}
