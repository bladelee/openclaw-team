/**
 * H5 应用入口
 */

import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { AuthProvider } from "./src/contexts/AuthContext";

// 获取根元素
const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("找不到 root 元素");
}

// 创建 React 根实例并渲染
ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

// 开发环境热更新
if (import.meta.hot) {
  import.meta.hot.accept("./App", () => {
    // 重新渲染
  });
}
