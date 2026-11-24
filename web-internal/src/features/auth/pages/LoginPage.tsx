import { LoginForm } from "@/features/auth/components/LoginForm";

export function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4 sm:p-6">
      <LoginForm />
    </main>
  );
}
