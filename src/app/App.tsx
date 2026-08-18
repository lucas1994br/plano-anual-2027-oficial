import { Toaster } from "@/components/ui/toaster.tsx";
import { Toaster as Sonner } from "@/components/ui/sonner.tsx";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "../pages/Home.tsx";
import DiretoriaPlano from "../pages/DiretoriaPlano.tsx";
import DiretoriaAprovacao from "../pages/DiretoriaAprovacao.tsx";
import GerenciaPanel from "../pages/GerenciaPanel.tsx";
import ComprasPanel from "../pages/ComprasPanel.tsx";
import AdminPanel from "../pages/AdminPanel.tsx";

import ErpTest from "../pages/ErpTest.tsx";
import NotFound from "../pages/NotFound.tsx";

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
              {/* Route for standalone AdminDiretoriaDashboard removed as it's now integrated in AdminVisaoGeral */}
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
