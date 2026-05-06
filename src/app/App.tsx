import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "../pages/Home";
import DiretoriaPlano from "../pages/DiretoriaPlano";
import DiretoriaAprovacao from "../pages/DiretoriaAprovacao";
import GerenciaPanel from "../pages/GerenciaPanel";
import ComprasPanel from "../pages/ComprasPanel";
import AdminPanel from "../pages/AdminPanel";
import ErpTest from "../pages/ErpTest";
import NotFound from "../pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/diretoria/:sigla" element={<DiretoriaPlano />} />
              <Route path="/diretoria/:sigla/aprovacao" element={<DiretoriaAprovacao />} />
              <Route path="/diretoria/:sigla/gerencia/:gerencia" element={<GerenciaPanel />} />
              <Route path="/compras" element={<ComprasPanel />} />
              <Route path="/admin" element={<AdminPanel />} />
              <Route path="/erp-test" element={<ErpTest />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
