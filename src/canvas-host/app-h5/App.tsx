/**
 * App 主应用组件
 */

import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "./context/AppContext";
import { BottomNav } from "./src/components/BottomNav";
import { ProtectedRoute } from "./src/components/ProtectedRoute";
import { I18nProvider } from "./src/contexts/I18nContext";
import { ThemeProvider } from "./src/contexts/ThemeContext";
import { CallbackPage } from "./src/pages/auth/CallbackPage";
import { ForgotPasswordPage } from "./src/pages/auth/ForgotPasswordPage";
import { LoginPage } from "./src/pages/auth/LoginPage";
import { RegisterPage } from "./src/pages/auth/RegisterPage";
import { ResetPasswordPage } from "./src/pages/auth/ResetPasswordPage";
import { LegacyChatPage } from "./src/pages/chat/LegacyChatPage";
import { CreateInstancePage } from "./src/pages/instances/CreateInstancePage";
import { InstanceDetailPage } from "./src/pages/instances/InstanceDetailPage";
import { InstanceSettingsPage } from "./src/pages/instances/InstanceSettingsPage";
import { InstancesPage } from "./src/pages/instances/InstancesPage";
import "./styles/variables.css";
import "./styles/global.css";
import "./src/styles/theme.css";

/**
 * 主布局组件（带底部导航）
 */
function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen">
      {/* 主内容区域 */}
      <main className="flex-1 overflow-y-auto pb-16">{children}</main>

      {/* 底部导航栏 */}
      <BottomNav />
    </div>
  );
}

/**
 * App 主组件
 */
export function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <AppProvider>
          <Routes>
            {/* Auth routes - 不需要布局 */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/auth/callback" element={<CallbackPage />} />

            {/* Instance management routes - 需要认证和布局 */}
            <Route
              path="/instances"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <InstancesPage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/instances/new"
              element={
                <ProtectedRoute>
                  <MainLayout>
                    <CreateInstancePage />
                  </MainLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/instances/:instanceId"
              element={
                <ProtectedRoute>
                  {/* 实例详情页全屏显示，不需要底部导航 */}
                  <InstanceDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/instances/:instanceId/settings"
              element={
                <ProtectedRoute>
                  {/* 实例设置页全屏显示，不需要底部导航 */}
                  <InstanceSettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/instances/:instanceId/chat-old"
              element={
                <ProtectedRoute>
                  {/* 旧版聊天测试页 */}
                  <LegacyChatPage />
                </ProtectedRoute>
              }
            />

            {/* Default route - redirect to instances */}
            <Route path="/" element={<Navigate to="/instances" replace />} />

            {/* Catch all - redirect to instances */}
            <Route path="*" element={<Navigate to="/instances" replace />} />
          </Routes>
        </AppProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
