import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./LoginForm";

const login = vi.fn();
const navigate = vi.fn();

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ login }),
  AuthError: class AuthError extends Error {},
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => children,
  useNavigate: () => navigate,
}));

describe("LoginForm", () => {
  beforeEach(() => {
    login.mockReset();
    navigate.mockReset();
  });

  it("renders the email and password fields", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("auth.email")).toBeInTheDocument();
    expect(screen.getByLabelText("auth.password")).toBeInTheDocument();
  });

  it("blocks submission and shows validation errors when fields are empty", async () => {
    render(<LoginForm />);
    await userEvent.click(screen.getByRole("button", { name: "auth.loginButton" }));

    expect(login).not.toHaveBeenCalled();
    expect(screen.getAllByText("validation.required").length).toBeGreaterThan(0);
  });

  it("calls login with the credentials on a valid submit", async () => {
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText("auth.email"), "learner@example.com");
    await userEvent.type(screen.getByLabelText("auth.password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "auth.loginButton" }));

    expect(login).toHaveBeenCalledWith("learner@example.com", "password123");
  });
});
