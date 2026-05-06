# Execução por partes no SQL Editor

Rode os arquivos nesta ordem:

1. `01_limpeza.sql`
2. Todos os `02_itens_lote_XX.sql` em ordem
3. `03_recria_solicitacoes.sql`

Validações:
- `select count(*) from itens_catalogo;`
- `select count(*) from solicitacoes;`
- `select d.sigla, count(*) from solicitacoes s join diretorias d on d.id=s.diretoria_id group by d.sigla order by d.sigla;`
