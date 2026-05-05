import { useState } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Loader2 } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: (res) => {
      if (res.success) {
        navigate("/dashboard");
      } else {
        setError(res.error);
      }
    },
    onError: (err) => setError(err.message),
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: (res) => {
      if (res.success) {
        navigate("/dashboard");
      } else {
        setError(res.error);
      }
    },
    onError: (err) => setError(err.message),
  });

  const isPending = loginMutation.isPending || registerMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (mode === "login") {
      loginMutation.mutate({ email, password });
    } else {
      if (name.length < 1) {
        setError("Name is required");
        return;
      }
      registerMutation.mutate({ email, password, name });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[hsl(0,0%,6%)] p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-4">
            <BookOpen className="h-6 w-6 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Trade Diary</h1>
          <p className="text-sm text-neutral-400 mt-1">Portfolio Management & Analytics</p>
        </div>

        <Card className="bg-[hsl(0,0%,10%)] border-[hsl(0,0%,18%)]">
          <CardHeader className="pb-4">
            <CardTitle className="text-white text-lg">
              {mode === "login" ? "Sign In" : "Create Account"}
            </CardTitle>
            <CardDescription className="text-neutral-400">
              {mode === "login"
                ? "Enter your credentials to continue"
                : "Register to start tracking your trades"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-neutral-300">Full Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    required
                    className="bg-[hsl(0,0%,14%)] border-[hsl(0,0%,22%)] text-white placeholder:text-neutral-600 focus-visible:ring-emerald-500"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-neutral-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="bg-[hsl(0,0%,14%)] border-[hsl(0,0%,22%)] text-white placeholder:text-neutral-600 focus-visible:ring-emerald-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-neutral-300">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  required
                  minLength={6}
                  className="bg-[hsl(0,0%,14%)] border-[hsl(0,0%,22%)] text-white placeholder:text-neutral-600 focus-visible:ring-emerald-500"
                />
              </div>

              {error && (
                <p className="text-sm text-red-400 bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>
              )}

              <Button
                type="submit"
                disabled={isPending}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium"
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {mode === "login" ? "Sign In" : "Create Account"}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setError("");
                }}
                className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                {mode === "login"
                  ? "Don't have an account? Register"
                  : "Already have an account? Sign In"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
