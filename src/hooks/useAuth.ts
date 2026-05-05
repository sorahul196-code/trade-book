import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";

export function useAuth() {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.invalidate();
      navigate("/login");
    },
  });

  return {
    user: data?.user ?? null,
    isLoading,
    isAuthenticated: !!data?.user,
    logout: () => logoutMutation.mutate(),
  };
}
