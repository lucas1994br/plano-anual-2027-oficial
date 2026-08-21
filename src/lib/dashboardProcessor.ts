const MOCK_MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export function getStatusProgresso(status: string): number {
  if (status === "concluido") return 100;
  if (status === "em_compra") return 75;
  if (status === "aprovado") return 50;
  if (status === "em_analise") return 25;
  return 0;
}

export function getStatusText(progresso: number): string {
  if (progresso === 100) return "Concluído";
  if (progresso > 30) return "Em Execução";
  return "Planejado";
}

export function getMesName(dateStr: string | null | undefined): string {
  if (!dateStr) return "Jan";
  try {
    const month = parseInt(dateStr.split("-")[1], 10) - 1;
    if (isNaN(month) || month < 0 || month > 11) return "Jan";
    return MOCK_MESES[month];
  } catch (e) {
    return "Jan";
  }
}

interface DashboardProcessParams {
  filtroDiretoria: string;
  filtroAno: string;
  excelData: any;
  todasGerencias?: any[];
  gerenciasAtuais?: string[]; // Arrays of string: "SIGLA - NOME"
  solicitacoes?: any[];
  servicos?: any[];
}

export function processDashboardData(params: DashboardProcessParams) {
  const {
    filtroDiretoria,
    filtroAno,
    excelData,
    todasGerencias = [],
    gerenciasAtuais = [],
    solicitacoes = [],
    servicos = []
  } = params;

  const matrixData: any[] = [];
  const dynGerenciasAtuais: string[] = [...gerenciasAtuais];

  // 1. Processamento Excel (2026)
  if (filtroAno === "2026" && excelData && excelData.realizadoData) {
    const realizadoData = excelData.realizadoData;
    const gerFullnames = todasGerencias.map(g => `${g.sigla}${g.nome ? ` - ${g.nome}` : ''}`);
    const gerenciasMap = gerFullnames.map(g => ({
      full: g,
      sigla: g.split(" - ")[0].trim().toUpperCase()
    }));

    if (realizadoData.length > 0) {
      const firstRow = realizadoData[0];
      const keys = Object.keys(firstRow);

      const getKey = (target: string) => {
        const found = keys.find(k => k.trim().toUpperCase() === target);
        return found || target;
      };

      const k_dir = getKey("DIRETORIA");
      const k_tipo = getKey("TIPO");
      const k_mes = getKey("MES_NOME");
      const k_ger = getKey("GERENCIA");
      const k_voc = getKey("VALOR_OC");
      const k_vnf = getKey("VALOR_NF");
      const k_oc = getKey("OC");
      const k_nf = getKey("NF");
      const k_class = getKey("CLASSIFICACAO");
      const k_desc = getKey("DESCRICAO");
      const k_forn = getKey("FORNECEDOR");
      const k_prev = getKey("PREVISTO");

      const targetDir = filtroDiretoria.toUpperCase();

      realizadoData.forEach((row: any, i: number) => {
        const dirVal = String(row[k_dir] || "").trim().toUpperCase();
        if (dirVal !== targetDir) return;

        const tipoVal = String(row[k_tipo] || "").trim().toUpperCase();
        const isAq = tipoVal === "AQUISICAO" || tipoVal === "AQUISIÇÃO";

        const mesStr = String(row[k_mes] || "Jan");
        const gerSigla = String(row[k_ger] || "Indefinido").trim().toUpperCase();
        
        let gerenciaFull = gerSigla;
        for (const g of gerenciasMap) {
          if (gerSigla === g.sigla || gerSigla.startsWith(g.sigla)) {
            gerenciaFull = g.full;
            break;
          }
        }

        if (!dynGerenciasAtuais.includes(gerenciaFull)) {
          dynGerenciasAtuais.push(gerenciaFull);
        }

        const valOc = Number(row[k_voc]) || 0;
        const valNf = Number(row[k_vnf]) || 0;

        let prog = 0;
        let status = "Não Iniciado";
        if (valOc > 0) {
          prog = Math.round((valNf / valOc) * 100);
          if (prog >= 100) {
            status = "Concluído";
            prog = 100;
          } else if (prog > 0) {
            status = "Em Andamento";
          }
        } else if (valNf > 0) {
          status = "Não Previsto";
        }

        matrixData.push({
          id: `EXC-${row[k_oc] || row[k_nf] || i}`,
          gerencia: gerenciaFull,
          tipo: isAq ? "Aquisição" : "Serviço Existente",
          subcategoria: String(row[k_class] || row[k_desc] || "Geral"),
          status,
          orcamentoPlanejado: valOc,
          orcamentoExecutado: valNf,
          variacao: valOc - valNf,
          mes: mesStr,
          ano: "2026",
          trimestre: "1º Trimestre",
          bimestre: "1º Bimestre",
          semana: "Semana 1",
          progresso: prog,
          tendencia: (valOc - valNf) >= 0 ? "down" : "up",
          oc: String(row[k_oc] || ""),
          fornecedor: String(row[k_forn] || ""),
          previsto: String(row[k_prev] || "")
        });
      });
    }
  }

  // 2. Processamento Supabase (Anos != 2026)
  if (filtroAno !== "2026") {
    const gerenciasById: Record<string, string> = {};
    todasGerencias.forEach(g => {
      if (g.id) {
        gerenciasById[g.id] = g.sigla || "Indefinido";
      }
    });

    solicitacoes.forEach(s => {
      if (!s || typeof s !== 'object') return;
      const orcPlan = (Number(s.qtdEstimada || s.qtd_estimada || 0)) * (Number(s.valorUnitario || s.valor_unitario || 0));
      const prog = getStatusProgresso(s.status || "");
      const orcExec = orcPlan * (prog / 100.0);
      const valVar = orcPlan - orcExec;

      const gerId = s.gerencia_id;
      const gerSigla = gerId ? (gerenciasById[gerId] || "Indefinido") : "Indefinido";
      
      let gerFull = gerSigla;
      for (const g of dynGerenciasAtuais) {
        if (g.startsWith(gerSigla)) {
          gerFull = g;
          break;
        }
      }

      matrixData.push({
        id: `REQ-${s.codigo || (s.id || "").substring(0, 6)}`,
        gerencia: gerFull,
        tipo: "Aquisição",
        subcategoria: s.categoria || "Geral",
        status: getStatusText(prog),
        orcamentoPlanejado: orcPlan,
        orcamentoExecutado: orcExec,
        variacao: valVar,
        mes: getMesName(s.created_at),
        ano: filtroAno,
        trimestre: "1º Trimestre",
        bimestre: "1º Bimestre",
        semana: "Semana 1",
        progresso: prog,
        tendencia: valVar >= 0 ? "down" : "up",
        oc: "",
        fornecedor: ""
      });
    });

    servicos.forEach(s => {
      if (!s || typeof s !== 'object') return;
      const orcPlan = Number(s.estimativaValor || s.estimativa_valor || 0);
      const prog = getStatusProgresso(s.status || "");
      const orcExec = orcPlan * (prog / 100.0);
      const valVar = orcPlan - orcExec;

      const gerId = s.gerencia_id;
      const gerSigla = gerId ? (gerenciasById[gerId] || "Indefinido") : "Indefinido";
      
      let gerFull = gerSigla;
      for (const g of dynGerenciasAtuais) {
        if (g.startsWith(gerSigla)) {
          gerFull = g;
          break;
        }
      }
      
      const itemNum = Number(s.item);
      const tipoCont = s.tipoContratacao || s.tipo_contratacao || "";
      const isNovo = tipoCont === "Novo" || itemNum >= 9000000;
      const tipo = isNovo ? "Serviço Novo" : "Serviço Existente";
      
      const obj = s.objeto || "";
      let subcat = obj.length > 25 ? obj.substring(0, 25) + "..." : obj;
      if (!subcat) subcat = "Geral";

      matrixData.push({
        id: `SRV-${s.item || (s.id || "").substring(0, 6)}`,
        gerencia: gerFull,
        tipo: tipo,
        subcategoria: subcat,
        status: getStatusText(prog),
        orcamentoPlanejado: orcPlan,
        orcamentoExecutado: orcExec,
        variacao: valVar,
        mes: getMesName(s.created_at),
        ano: filtroAno,
        trimestre: "1º Trimestre",
        bimestre: "1º Bimestre",
        semana: "Semana 1",
        progresso: prog,
        tendencia: valVar >= 0 ? "down" : "up",
        oc: "",
        fornecedor: ""
      });
    });
  }

  // 3. Agregações
  const evolutionData = MOCK_MESES.map(mes => {
    const items = matrixData.filter(m => m.mes === mes);
    
    const orcExecutadoPrevisto = items.filter(m => String(m.previsto || "").trim().toUpperCase() === "SIM").reduce((acc, curr) => acc + curr.orcamentoExecutado, 0);
    const orcExecutadoNaoPrevisto = items.filter(m => {
      const prev = String(m.previsto || "").trim().toUpperCase();
      return prev === "NÃO" || prev === "NAO";
    }).reduce((acc, curr) => acc + curr.orcamentoExecutado, 0);

    return {
      name: mes,
      aquisicoes: items.filter(m => m.tipo === "Aquisição").reduce((a, b) => a + b.orcamentoPlanejado, 0),
      servicosNovos: items.filter(m => m.tipo === "Serviço Novo").reduce((a, b) => a + b.orcamentoPlanejado, 0),
      servicosExistentes: items.filter(m => m.tipo === "Serviço Existente").reduce((a, b) => a + b.orcamentoPlanejado, 0),
      orcamentoPlanejado: items.reduce((a, b) => a + b.orcamentoPlanejado, 0),
      orcamentoExecutado: items.reduce((a, b) => a + b.orcamentoExecutado, 0),
      realizadoPrevisto: orcExecutadoPrevisto,
      naoPrevisto: orcExecutadoNaoPrevisto
    };
  });

  const gerenciaData = dynGerenciasAtuais.map(gFull => {
    const gSigla = gFull.split(" - ")[0];
    const items = matrixData.filter(m => m.gerencia === gFull);
    
    let eficiencia = 0;
    if (items.length > 0) {
      eficiencia = items.reduce((acc, curr) => acc + curr.progresso, 0) / items.length;
    }

    return {
      name: gSigla,
      fullName: gFull,
      aquisicoes: items.filter(m => m.tipo === "Aquisição").reduce((a, b) => a + b.orcamentoPlanejado, 0),
      servicosNovos: items.filter(m => m.tipo === "Serviço Novo").reduce((a, b) => a + b.orcamentoPlanejado, 0),
      servicosExistentes: items.filter(m => m.tipo === "Serviço Existente").reduce((a, b) => a + b.orcamentoPlanejado, 0),
      eficiencia,
      agilidade: items.length > 0 ? 80 : 0,
      conformidade: items.length > 0 ? 95 : 0
    };
  });

  const pieDataMap: Record<string, any> = {};
  const statusPieDataMap: Record<string, any> = {};

  matrixData.forEach(item => {
    const subcat = item.subcategoria;
    if (!pieDataMap[subcat]) {
      pieDataMap[subcat] = { name: subcat, value: 0, tipo: item.tipo };
    }
    pieDataMap[subcat].value += item.orcamentoPlanejado;

    const statusFmt = item.status.replace(/_/g, " ").toUpperCase();
    if (!statusPieDataMap[statusFmt]) {
      statusPieDataMap[statusFmt] = { name: statusFmt, value: 0 };
    }
    statusPieDataMap[statusFmt].value += item.orcamentoPlanejado;
  });

  let pieData = Object.values(pieDataMap).filter(p => p.value > 0).sort((a, b) => b.value - a.value);
  if (pieData.length > 5) {
    const top4 = pieData.slice(0, 4);
    const outrosVal = pieData.slice(4).reduce((acc, curr) => acc + curr.value, 0);
    top4.push({ name: "Outros", value: outrosVal, tipo: "Diversos" });
    pieData = top4;
  }

  const statusPieData = Object.values(statusPieDataMap).filter(p => p.value > 0).sort((a, b) => b.value - a.value);

  return {
    matrixData,
    evolutionData,
    gerenciaData,
    pieData,
    statusPieData,
    gerenciasAtuais: dynGerenciasAtuais
  };
}
