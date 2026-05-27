import { AuthLayout } from "@/components/features/auth/AuthLayout";
import { SignupForm } from "@/components/features/auth/SignupForm";

export function SignupPage() {
  return (
    <AuthLayout>
      <SignupForm />
    </AuthLayout>
  );
}
