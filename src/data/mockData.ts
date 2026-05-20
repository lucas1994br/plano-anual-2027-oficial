import { PlanItem } from "@/types/plan.ts";

export const CATEGORIAS = [
  "MATERIAIS HIDRÁULICOS",
  "MATERIAIS ELÉTRICOS",
  "MATERIAIS DE ESCRITÓRIO",
  "EQUIPAMENTOS DE TI",
  "SERVIÇOS DE MANUTENÇÃO",
];

export const GERENCIAS = ["CCRC", "DC", "GI", "TI", "RH", "FIN"];

export const UNIDADES = ["unid", "cx", "par", "rolo", "pct", "m", "kg", "lt"];

export const initialItems: PlanItem[] = [
  { codigo: 1086, descricao: "JOELHO 45° SOLDÁVEL DE 25 MM", categoria: "MATERIAIS HIDRÁULICOS", unidade: "unid", qtdEstimada: 0, valorUnitario: 1.09, prioridade: "Baixa", gerencia: "CCRC" },
  { codigo: 1206, descricao: "LUVA DE CORRER PARA TUBO SOLDÁVEL DE 20 MM", categoria: "MATERIAIS HIDRÁULICOS", unidade: "unid", qtdEstimada: 0, valorUnitario: 9.87, prioridade: "Baixa", gerencia: "CCRC", observacao: "Necessário para manutenção predial" },
  { codigo: 18081, descricao: "ASSENTO SANITÁRIO", categoria: "MATERIAIS HIDRÁULICOS", unidade: "unid", qtdEstimada: 0, valorUnitario: 25.21, prioridade: "Baixa", gerencia: "DC" },
  { codigo: 2045, descricao: "CABO FLEXÍVEL 2,5MM VERMELHO", categoria: "MATERIAIS ELÉTRICOS", unidade: "rolo", qtdEstimada: 0, valorUnitario: 2.35, prioridade: "Média", gerencia: "GI" },
  { codigo: 3012, descricao: "DISJUNTOR BIPOLAR 32A", categoria: "MATERIAIS ELÉTRICOS", unidade: "unid", qtdEstimada: 0, valorUnitario: 45.9, prioridade: "Alta", gerencia: "GI", observacao: "Urgente para novo prédio" },
  { codigo: 4001, descricao: "PAPEL A4 RESMA 500 FOLHAS", categoria: "MATERIAIS DE ESCRITÓRIO", unidade: "pct", qtdEstimada: 0, valorUnitario: 28.5, prioridade: "Baixa", gerencia: "RH" },
];
