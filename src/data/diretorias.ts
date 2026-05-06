import { PlanItem } from "@/types/plan";

export interface Diretoria {
  sigla: string;
  nome: string;
  descricao: string;
  cor: string;
  icone: string;
}

export const DIRETORIAS: Diretoria[] = [
  { sigla: "DG", nome: "Diretoria de Gestão Administrativa Financeira e de Pessoas", descricao: "Gestão administrativa, financeira e de pessoas", cor: "from-blue-600 to-blue-800", icone: "🏛️" },
  { sigla: "DC", nome: "Diretoria de Comercialização e Relacionamento com Cliente", descricao: "Comercialização, faturamento e relacionamento com cliente", cor: "from-emerald-600 to-emerald-800", icone: "💼" },
  { sigla: "PR", nome: "Diretoria da Presidência", descricao: "Presidência e planejamento estratégico", cor: "from-purple-600 to-purple-800", icone: "⭐" },
  { sigla: "DE", nome: "Diretoria de Engenharia e Meio Ambiente", descricao: "Engenharia, projetos e meio ambiente", cor: "from-amber-600 to-amber-800", icone: "🔧" },
  { sigla: "DO", nome: "Diretoria de Operação e Manutenção", descricao: "Operação e manutenção dos sistemas", cor: "from-red-600 to-red-800", icone: "⚙️" },
];


export const DADOS_DIRETORIAS: Record<string, { categorias: string[]; gerencias: string[]; items: PlanItem[] }> = {
  DG: {
    categorias: [],
    gerencias: [],
    items: [],
  },
  DC: {
    categorias: [],
    gerencias: [],
    items: [],
  },
  PR: {
    categorias: [],
    gerencias: [],
    items: [],
  },
  DE: {
    categorias: ["MATERIAIS HIDRAULICOS", "MATERIAIS ELÉTRICOS", "MATERIAIS DE PINTURAS E CONSERVAÇÃO", "MATERIAIS DE OFICINA E USO GERAL", "EQUIPAMENTOS ELETRO-MECANICOS", "MATERIAIS DE EXPEDIENTE E DESENHO", "MATERIAIS DE PROTEÇÃO E SEGURANÇA", "MATERIAL DE REPARO DE BOMBAS", "MATERIAIS DE LABORATÓRIO", "VEICULOS"],
    gerencias: ["EOBR", "EPRO", "EPRE", "EMAR"],
    items: [
      { codigo: 11044, descricao: "LUVA DE CORRER PVC DEFOFO JEI DN - 150 MM", categoria: "MATERIAIS HIDRAULICOS", unidade: "unid", qtdEstimada: 0, valorUnitario: 70.06, prioridade: "Média", gerencia: "EOBR" },
      { codigo: 11430, descricao: "TRENA A LASER GLM 30", categoria: "MATERIAIS ELÉTRICOS", unidade: "unid", qtdEstimada: 0, valorUnitario: 307.60, prioridade: "Baixa", gerencia: "EPRO" },
      { codigo: 18566, descricao: "CALCULADORA DE MESA GR. 12 DIGITS", categoria: "MATERIAIS DE PINTURAS E CONSERVAÇÃO", unidade: "unid", qtdEstimada: 0, valorUnitario: 101.93, prioridade: "Alta", gerencia: "EPRO" },
      { codigo: 18945, descricao: "ROLAMENTO SKF 6215 2Z", categoria: "MATERIAIS DE OFICINA E USO GERAL", unidade: "unid", qtdEstimada: 0, valorUnitario: 113.50, prioridade: "Média", gerencia: "EOBR" },
      { codigo: 21858, descricao: "REGISTRO DE GAVETA EM BRONZE 2.1/2\"", categoria: "MATERIAIS HIDRAULICOS", unidade: "unid", qtdEstimada: 0, valorUnitario: 441.75, prioridade: "Média", gerencia: "EOBR" },
      { codigo: 67984, descricao: "L200 TRITON SPORT GL 2.4D", categoria: "VEICULOS", unidade: "unid", qtdEstimada: 0, valorUnitario: 220000.00, prioridade: "Alta", gerencia: "EMAR" },
      { codigo: 71840, descricao: "CMB SUBMERSÍVEL TRIF 380V P/POÇO DE 6\"", categoria: "EQUIPAMENTOS ELETRO-MECANICOS", unidade: "unid", qtdEstimada: 0, valorUnitario: 11666.67, prioridade: "Média", gerencia: "EOBR" },
      { codigo: 74205, descricao: "LUVAS EM RASPA PARA SOLDADOR PUNHO 15CM", categoria: "MATERIAIS DE PROTEÇÃO E SEGURANÇA", unidade: "unid", qtdEstimada: 0, valorUnitario: 30.50, prioridade: "Média", gerencia: "EOBR" },
      { codigo: 100629, descricao: "NITRITO REAGENTE NITRIVER 3PP 10ML 100UN", categoria: "MATERIAIS DE LABORATÓRIO", unidade: "unid", qtdEstimada: 0, valorUnitario: 200.00, prioridade: "Média", gerencia: "EOBR" },
    ],
  },
  DO: {
    categorias: [],
    gerencias: [],
    items: [],
  },
};
