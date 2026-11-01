"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useEffect, useState } from "react";
import { ConfigProvider, theme as antdTheme, App } from "antd";
import { ThemeProvider as NextThemeProvider, useTheme } from "next-themes";

const sharedToken = {
  colorPrimary: "#0057FF",
  colorInfo: "#0057FF",
  borderRadius: 6,
  wireframe: false,
  fontFamily:
    'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
};

export const lightTheme = {
  token: {
    ...sharedToken,
    colorSuccess: "#16A34A",
    colorWarning: "#D97706",
    colorError: "#DC2626",
    colorText: "#0A0D14",
    colorTextSecondary: "#475467",
    colorTextDescription: "#667085",
    colorBorder: "#E4E7EC",
    colorBorderSecondary: "#E4E7EC",
    colorBgLayout: "#F8F9FA",
    colorBgContainer: "#FFFFFF",
    colorBgElevated: "#FFFFFF",
  },
  components: {
    Layout: {
      headerBg: "#FFFFFF",
      siderBg: "#FFFFFF",
      bodyBg: "#F8F9FA",
    },
    Menu: {
      itemBg: "#FFFFFF",
      itemSelectedBg: "rgba(0, 87, 255, 0.08)",
      itemSelectedColor: "#0057FF",
      itemColor: "#475467",
      itemHoverBg: "rgba(0, 87, 255, 0.04)",
      itemHoverColor: "#0057FF",
      darkItemBg: "#0B1220",
      darkItemSelectedBg: "rgba(0, 87, 255, 0.15)",
      darkItemSelectedColor: "#337BFF",
      darkItemColor: "#9CA3AF",
      darkItemHoverBg: "rgba(255, 255, 255, 0.05)",
      darkItemHoverColor: "#F3F4F6",
    },
    Card: {
      paddingLG: 20,
      colorBgContainer: "#FFFFFF",
      colorBorderSecondary: "#E4E7EC",
    },
    Table: {
      headerBg: "#F8F9FA",
      headerColor: "#0A0D14",
      rowHoverBg: "#F1F4F9",
      borderColor: "#E4E7EC",
    },
  },
};

export const darkTheme = {
  token: {
    ...sharedToken,
    colorSuccess: "#73D13D",
    colorWarning: "#FFC53D",
    colorError: "#FF7875",
    colorText: "#F5F5F2",
    colorTextSecondary: "#A0A4B8",
    colorTextDescription: "#71768A",
    colorBorder: "rgba(245, 245, 242, 0.15)",
    colorBorderSecondary: "rgba(245, 245, 242, 0.12)",
    colorBgLayout: "#050505",
    colorBgContainer: "#0D0E12",
    colorBgElevated: "#141721",
  },
  components: {
    Layout: {
      headerBg: "#0D0E12",
      siderBg: "#090A0F",
      bodyBg: "#050505",
    },
    Menu: {
      darkItemBg: "#090A0F",
      darkItemSelectedBg: "rgba(0, 87, 255, 0.15)",
      darkItemSelectedColor: "#337BFF",
      darkItemColor: "#A0A4B8",
      darkItemHoverBg: "rgba(255, 255, 255, 0.05)",
      darkItemHoverColor: "#F5F5F2",
    },
    Card: {
      paddingLG: 20,
    },
    Table: {
      headerBg: "#141721",
      rowHoverBg: "rgba(255, 255, 255, 0.03)",
      borderColor: "rgba(245, 245, 242, 0.12)",
    },
  },
};

function AntdConfigProvider({ children }: { children: React.ReactNode }) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark
          ? antdTheme.darkAlgorithm
          : antdTheme.defaultAlgorithm,
        token: isDark ? darkTheme.token : lightTheme.token,
        components: isDark ? darkTheme.components : lightTheme.components,
      }}
    >
      <App>{children}</App>
    </ConfigProvider>
  );
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AntdConfigProvider>{children}</AntdConfigProvider>
    </NextThemeProvider>
  );
}
