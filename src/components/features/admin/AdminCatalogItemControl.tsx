import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIAS_ITEM_PREDEFINIDAS, UNIDADES_ITEM_PREDEFINIDAS } from "@/lib/catalogMetadata";
import { createItemCatalogoAndDistribuir } from "@/lib/services";

export function AdminCatalogItemControl() {
  const queryClient = useQueryClient();
  const [novoItem, setNovoItem] = useState({
    codigo: "",
    descricao: "",
    categoria: "",
    unidade: "",
    valorUnitario: "",
  });
  const [isCreatingItem, setIsCreatingItem] = useState(false);

  const handleCreateItem = async () => {
    if (!novoItem.codigo || !novoItem.descricao || !novoItem.categoria || !novoItem.unidade || !novoItem.valorUnitario) {
      toast.error("Preencha todos os campos do novo item.");
      return;
    }

    setIsCreatingItem(true);
    try {
      await createItemCatalogoAndDistribuir({
        codigo: Number(novoItem.codigo),
        descricao: novoItem.descricao.trim(),
        categoria: novoItem.categoria,
        unidade: novoItem.unidade,
        valorUnitario: Number(novoItem.valorUnitario),
      });

      setNovoItem({ codigo: "", descricao: "", categoria: "", unidade: "", valorUnitario: "" });
      queryClient.invalidateQueries({ queryKey: ["itens-catalogo"] });
      queryClient.invalidateQueries({ queryKey: ["solicitacoes"] });
      toast.success("Item criado e distribuído para as gerências no período ativo.");
    } catch (error: unknown) {
      const rawMessage = error instanceof Error ? error.message : String(error || "");
      const message = rawMessage.includes("duplicate")
        ? "Código já existe no catálogo. Informe outro código."
        : rawMessage.includes("Sessão admin não encontrada") || rawMessage.includes("Sessao admin nao encontrada")
          ? "Sessão admin expirada. Entre novamente no painel admin."
          : rawMessage.includes("Edge Function") || rawMessage.includes("FunctionsHttpError") || rawMessage.includes("non-2xx")
            ? "A função de cadastro ainda não foi publicada no Supabase ou retornou erro."
            : rawMessage || "Não foi possível criar o item.";
      toast.error(message);
    } finally {
      setIsCreatingItem(false);
    }
  };

  return (
    <Card className="p-6 card-shadow">
      <div className="flex items-center gap-2 mb-2">
        <PlusCircle className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Cadastrar novo item para o plano anual</h2>
      </div>

      <p className="text-sm text-muted-foreground mb-5">
        Ao cadastrar, o item entra na lista e já é distribuído para todas as gerências ativas como rascunho.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        <div className="space-y-1">
          <Label htmlFor="novo-codigo" className="text-xs">Código</Label>
          <Input
            id="novo-codigo"
            type="number"
            min={1}
            value={novoItem.codigo}
            onChange={(e) => setNovoItem((prev) => ({ ...prev, codigo: e.target.value }))}
            placeholder="Ex: 99999"
          />
        </div>

        <div className="space-y-1 lg:col-span-2">
          <Label htmlFor="novo-descricao" className="text-xs">Descrição</Label>
          <Input
            id="novo-descricao"
            value={novoItem.descricao}
            onChange={(e) => setNovoItem((prev) => ({ ...prev, descricao: e.target.value }))}
            placeholder="Nome do item"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Categoria</Label>
          <Select
            value={novoItem.categoria}
            onValueChange={(value) => setNovoItem((prev) => ({ ...prev, categoria: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS_ITEM_PREDEFINIDAS.map((categoria) => (
                <SelectItem key={categoria} value={categoria}>
                  {categoria}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Unidade</Label>
          <Select
            value={novoItem.unidade}
            onValueChange={(value) => setNovoItem((prev) => ({ ...prev, unidade: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {UNIDADES_ITEM_PREDEFINIDAS.map((unidade) => (
                <SelectItem key={unidade} value={unidade}>
                  {unidade}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="novo-valor" className="text-xs">Valor unitário</Label>
          <Input
            id="novo-valor"
            type="number"
            min={0}
            step="0.01"
            value={novoItem.valorUnitario}
            onChange={(e) => setNovoItem((prev) => ({ ...prev, valorUnitario: e.target.value }))}
            placeholder="0,00"
          />
        </div>
      </div>

      <Button onClick={handleCreateItem} disabled={isCreatingItem} className="gap-2">
        {isCreatingItem ? "Adicionando..." : "Adicionar item no catálogo"}
      </Button>
    </Card>
  );
}
