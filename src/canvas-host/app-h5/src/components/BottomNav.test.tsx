import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
// 底部导航栏组件单元测试
import { describe, it, expect, vi } from "vitest";
import { BottomNav } from "./BottomNav";

describe("BottomNav", () => {
  const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
  };

  it("should render all navigation items", () => {
    renderWithRouter(<BottomNav />);

    expect(screen.getByText("Instances")).toBeInTheDocument();
    expect(screen.getByText("Chat")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });

  it("should highlight active route", () => {
    // 测试当前路由高亮
    renderWithRouter(<BottomNav />);

    // 验证当前路由有不同的样式
    const instancesLink = screen.getByText("Instances").closest("a");
    expect(instancesLink).toHaveClass("text-blue-600");
  });

  it("should render icons for each nav item", () => {
    renderWithRouter(<BottomNav />);

    // 验证图标渲染（通过 SVG 元素）
    const svgs = document.querySelectorAll("nav svg");
    expect(svs).toHaveLength(3);
  });

  it("should be fixed at bottom", () => {
    renderWithRouter(<BottomNav />);

    const nav = screen.getByRole("navigation");
    expect(nav).toHaveClass("fixed");
    expect(nav).toHaveClass("bottom-0");
  });

  it("should have correct height", () => {
    renderWithRouter(<BottomNav />);

    const nav = screen.getByRole("navigation");
    expect(nav).toHaveClass("h-16");
  });
});
