import { AuthLayout } from "@/components/features/auth/AuthLayout";
import { LoginForm } from "@/components/features/auth/LoginForm";

export function LoginPage() {
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
