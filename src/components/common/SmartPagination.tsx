import React, { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { cn } from "@/lib/utils.ts";

export interface SmartPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
  totalItems?: number;
  siblingCount?: number;
  showQuickJumper?: boolean;
  showInfo?: boolean;
}

export function getPaginationRange(
  currentPage: number,
  totalPages: number,
  siblingCount = 1
): (number | "ellipsis-start" | "ellipsis-end")[] {
  const totalNumbers = siblingCount * 2 + 3;
  const totalBlocks = totalNumbers + 2;

  if (totalPages <= totalBlocks) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1);
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages);

  const shouldShowLeftEllipsis = leftSiblingIndex > 2;
  const shouldShowRightEllipsis = rightSiblingIndex < totalPages - 1;

  if (!shouldShowLeftEllipsis && shouldShowRightEllipsis) {
    const leftItemCount = 3 + 2 * siblingCount;
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1);
    return [...leftRange, "ellipsis-end", totalPages];
  }

  if (shouldShowLeftEllipsis && !shouldShowRightEllipsis) {
    const rightItemCount = 3 + 2 * siblingCount;
    const rightRange = Array.from(
      { length: rightItemCount },
      (_, i) => totalPages - rightItemCount + i + 1
    );
    return [1, "ellipsis-start", ...rightRange];
  }

  if (shouldShowLeftEllipsis && shouldShowRightEllipsis) {
    const middleRange = Array.from(
      { length: rightSiblingIndex - leftSiblingIndex + 1 },
      (_, i) => leftSiblingIndex + i
    );
    return [1, "ellipsis-start", ...middleRange, "ellipsis-end", totalPages];
  }

  return Array.from({ length: totalPages }, (_, i) => i + 1);
}

export function SmartPagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
  totalItems,
  siblingCount = 1,
  showQuickJumper = true,
  showInfo = true,
}: SmartPaginationProps) {
  const [jumpPage, setJumpPage] = useState<string>("");

  if (totalPages <= 1) return null;

  const pages = getPaginationRange(currentPage, totalPages, siblingCount);

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pageNum = parseInt(jumpPage, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      onPageChange(pageNum);
      setJumpPage("");
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-4 py-4 px-2 select-none",
        className
      )}
    >
      {/* Informações da página */}
      {showInfo && (
        <div className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap order-2 sm:order-1">
          Página <span className="font-semibold text-foreground">{currentPage}</span> de{" "}
          <span className="font-semibold text-foreground">{totalPages}</span>
          {totalItems !== undefined && (
            <span className="ml-1">
              ({totalItems.toLocaleString("pt-BR")} itens)
            </span>
          )}
        </div>
      )}

      {/* Botões de Navegação */}
      <nav
        role="navigation"
        aria-label="Paginação"
        className="flex items-center gap-1 flex-wrap justify-center order-1 sm:order-2"
      >
        {/* Primeira Página */}
        {totalPages > 5 && (
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 hidden md:inline-flex"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            title="Primeira página"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
        )}

        {/* Página Anterior */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 sm:px-3 gap-1 text-xs sm:text-sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden xs:inline">Anterior</span>
        </Button>

        {/* Números das Páginas */}
        <div className="flex items-center gap-1">
          {pages.map((pageItem, index) => {
            if (pageItem === "ellipsis-start") {
              return (
                <Button
                  key={`ellipsis-start-${index}`}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => onPageChange(Math.max(1, currentPage - 5))}
                  title="Voltar 5 páginas"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              );
            }

            if (pageItem === "ellipsis-end") {
              return (
                <Button
                  key={`ellipsis-end-${index}`}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                  onClick={() => onPageChange(Math.min(totalPages, currentPage + 5))}
                  title="Avançar 5 páginas"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              );
            }

            const pageNumber = pageItem as number;
            const isActive = pageNumber === currentPage;

            return (
              <Button
                key={`page-${pageNumber}`}
                variant={isActive ? "default" : "outline"}
                size="icon"
                className={cn(
                  "h-8 w-8 text-xs font-medium transition-all",
                  isActive
                    ? "bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-sm"
                    : "hover:bg-muted text-foreground border-border"
                )}
                onClick={() => onPageChange(pageNumber)}
                aria-current={isActive ? "page" : undefined}
              >
                {pageNumber}
              </Button>
            );
          })}
        </div>

        {/* Próxima Página */}
        <Button
          variant="outline"
          size="sm"
          className="h-8 px-2 sm:px-3 gap-1 text-xs sm:text-sm"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
        >
          <span className="hidden xs:inline">Próximo</span>
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Última Página */}
        {totalPages > 5 && (
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 hidden md:inline-flex"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            title="Última página"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        )}
      </nav>

      {/* Salto Rápido para Página (Quick Jumper) */}
      {showQuickJumper && totalPages > 5 && (
        <form
          onSubmit={handleJumpSubmit}
          className="flex items-center gap-1.5 text-xs text-muted-foreground order-3"
        >
          <span className="hidden md:inline">Ir para:</span>
          <Input
            type="number"
            min={1}
            max={totalPages}
            value={jumpPage}
            onChange={(e) => setJumpPage(e.target.value)}
            placeholder={String(currentPage)}
            className="w-14 h-8 text-center text-xs px-1 bg-background"
          />
          <Button type="submit" variant="secondary" size="sm" className="h-8 px-2 text-xs">
            Ir
          </Button>
        </form>
      )}
    </div>
  );
}
