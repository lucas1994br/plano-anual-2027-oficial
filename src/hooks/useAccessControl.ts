import { useState, useCallback } from "react";
import { validateAccessCode } from "@/lib/services.ts";
import { toast } from "sonner";

interface AccessSession {
  scope: string;
  diretoria_id: string | null;
  gerencia_id: string | null;
  app_role: string;
}

export function useAccessControl() {
  const [session, setSession] = useState<AccessSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const authenticate = useCallback(
    async (code: string, scope: "diretoria" | "gerencia" | "admin" | "compras") => {
      setIsLoading(true);
      try {
        const result = await validateAccessCode(code, scope) as any;
        
        if (result.success && result.access) {
          setSession(result.access);
          setIsAuthenticated(true);
          toast.success("Acesso concedido!");
          return true;
        } else {
          toast.error(result.error || "Código inválido");
          return false;
        }
      } catch (error) {
        console.error("Erro na autenticação:", error);
        toast.error("Erro ao validar código. Tente novamente.");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const logout = useCallback(() => {
    setSession(null);
    setIsAuthenticated(false);
  }, []);

  return {
    session,
    isAuthenticated,
    isLoading,
    authenticate,
    logout,
  };
}
