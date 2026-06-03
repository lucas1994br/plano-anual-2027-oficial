import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command.tsx";
import { cn } from "@/lib/utils.ts";

interface PlanFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  categoria: string;
  onCategoriaChange: (value: string) => void;
  gerencia?: string;
  onGerenciaChange?: (value: string) => void;
  prioridade: string;
  onPrioridadeChange: (value: string) => void;
  categorias: string[];
  gerencias?: string[];
  hideCategoriaFilter?: boolean;
}

export function PlanFilters({
  searchTerm,
  onSearchChange,
  categoria,
  onCategoriaChange,
  gerencia,
  onGerenciaChange,
  prioridade,
  onPrioridadeChange,
  categorias,
  gerencias,
  hideCategoriaFilter,
}: PlanFiltersProps) {
  const [categoriaOpen, setCategoriaOpen] = useState(false);

  const categoriaSelecionadaLabel = useMemo(
    () => categorias.find((item) => item === categoria) || "Selecione uma categoria",
    [categorias, categoria],
  );

  return (
    <div className="px-6 pb-4">
      <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar por código ou descrição..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 bg-card"
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span className="text-sm">Filtros:</span>
          </div>

          {gerencia && onGerenciaChange && gerencias && gerencias.length > 0 && (
            <Select value={gerencia} onValueChange={onGerenciaChange}>
              <SelectTrigger className="w-[180px] bg-card">
                <SelectValue placeholder="Todas Gerências" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas Gerências</SelectItem>
                {gerencias.map((ger) => (
                  <SelectItem key={ger} value={ger}>
                    {ger}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {!hideCategoriaFilter && (
            <Popover open={categoriaOpen} onOpenChange={setCategoriaOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={categoriaOpen}
                  className="w-[320px] justify-between bg-card font-normal"
                >
                  <span className="truncate">{categoriaSelecionadaLabel}</span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Pesquisar categoria..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="limpar categoria"
                        onSelect={() => {
                          onCategoriaChange("");
                          setCategoriaOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            categoria === "" ? "opacity-100" : "opacity-0",
                          )}
                        />
                        Limpar categoria
                      </CommandItem>
                      {categorias.map((cat) => (
                        <CommandItem
                          key={cat}
                          value={cat}
                          onSelect={(currentValue) => {
                            onCategoriaChange(currentValue === categoria ? "" : currentValue);
                            setCategoriaOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              categoria === cat ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {cat}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}

          <Select value={prioridade} onValueChange={onPrioridadeChange}>
            <SelectTrigger className="w-[180px] bg-card">
              <SelectValue placeholder="Todas Prioridades" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas Prioridades</SelectItem>
              <SelectItem value="Baixa">Baixa</SelectItem>
              <SelectItem value="Média">Média</SelectItem>
              <SelectItem value="Alta">Alta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}