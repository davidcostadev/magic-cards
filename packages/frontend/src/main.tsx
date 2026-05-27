import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/context/AuthContext";
import { LearningProvider } from "@/context/LearningContext";
import { router } from "./router";
import "@/i18n/config";
import "@/styles/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <LearningProvider>
          <RouterProvider router={router} />
        </LearningProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
);
