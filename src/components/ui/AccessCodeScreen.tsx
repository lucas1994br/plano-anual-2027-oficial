import { useState } from "react";
import { Lock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { validateAccessCode } from "@/lib/services.ts";

interface AccessCodeScreenProps {
  title: string;
  subtitle: string;
  gradientClass: string;
  icon: string;
  onAccessGranted: (accessData?: unknown) => void;
  onBack: () => void;
  scope: "diretoria" | "gerencia" | "admin" | "compras";
}

export function AccessCodeScreen({
  title,
  subtitle,
  gradientClass,
  icon,
  onAccessGranted,
  onBack,
  scope,
}: AccessCodeScreenProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await validateAccessCode(code, scope);

      if (!result || result.scope !== scope) {
        setError("Código de acesso inválido para este painel.");
        return;
      }

      sessionStorage.setItem(`access-code:${scope}`, code.trim());
      onAccessGranted(result);
    } catch (err) {
      const message =
        err instanceof Error && err.message.toLowerCase().includes("expired")
          ? "Código expirado. Solicite um novo código."
          : "Código de acesso inválido. Tente novamente.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-3 bg-card border-b">
        <Button variant="ghost" size="sm" className="gap-2" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </div>

      <div className={`bg-gradient-to-r ${gradientClass} px-6 py-8`}>
        <div className="max-w-md mx-auto text-center">
          <span className="text-4xl mb-3 block">{icon}</span>
          <h1 className="text-2xl font-bold text-white mb-1">{title}</h1>
          <p className="text-white/80 text-sm">{subtitle}</p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-6 py-10">
        <Card className="p-8 card-shadow">
          <div className="text-center mb-6">
            <div className="bg-primary/10 p-4 rounded-full w-fit mx-auto mb-4">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">
              Código de Acesso
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Digite o código fornecido para acessar o painel
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Digite o código de acesso..."
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError("");
              }}
              className="text-center text-lg tracking-widest"
              maxLength={20}
              required
            />
            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}
            <Button type="submit" className="w-full" disabled={loading || !code}>
              {loading ? "Verificando..." : "Acessar"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
