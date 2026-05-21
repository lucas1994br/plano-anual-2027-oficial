-- Convert existing services of type 'Novo' to 'Serviço' so they are classified as 'Serviços Existentes'
UPDATE public.servicos 
SET tipo_contratacao = 'Serviço' 
WHERE tipo_contratacao = 'Novo';
