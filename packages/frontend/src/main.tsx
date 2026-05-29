import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { PreferencesProvider } from "@/context/PreferencesContext";
import { LearningProvider } from "@/context/LearningContext";
import { router } from "./router";
import "@/i18n/config";
import "@/styles/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <PreferencesProvider>
          <LearningProvider>
            <RouterProvider router={router} />
          </LearningProvider>
        </PreferencesProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
);
