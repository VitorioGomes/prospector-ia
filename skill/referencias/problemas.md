# Quando algo dá errado

Causas previstas na construção do sistema. **Nenhuma veio de comprador real ainda**: ao aparecer
um caso novo, ele entra aqui.

## Busca no Google Maps

| O que aparece | Causa | O que fazer |
|---|---|---|
| "Não consegui baixar o programa de busca" | Sem internet, ou o GitHub fora do ar | Tentar de novo. O download é só na primeira busca |
| "O programa de busca baixado não é o esperado" | O arquivo veio corrompido ou diferente da versão conferida | Tentar de novo. Se repetir, parar e avisar o suporte: não rodar o arquivo |
| "Não consegui abrir o programa de busca" | Antivírus ou o Windows bloqueou o executável | Liberar a pasta do projeto no antivírus |
| "Não achei a cidade no mapa" | Nome abreviado ou sem o estado | Escrever "Cidade, UF" |
| "A busca não trouxe nenhum negócio" | Termo que ninguém usa no Maps, ou o Google limitou esta internet por excesso de buscas | Outro termo. Se funcionava e parou, esperar uma hora |
| Busca traz poucos negócios | Cada termo traz no máximo 20 | Mais termos na mesma busca (até 8), ou cidade vizinha |
| "Ficaram de fora: N sem telefone" | O dono não cadastrou telefone no Maps | Normal. Sem telefone o negócio não entra na lista |
| "Já tem uma busca rodando" | Clicou em buscar duas vezes na tela | Esperar a primeira terminar |
| Parou de funcionar de um dia para o outro, para todo mundo | O Google mudou o Maps e o programa de busca ficou desatualizado | Não há conserto pela conversa. Avisar o suporte |

## Mensagens

| O que aparece | Causa | O que fazer |
|---|---|---|
| "Antes das mensagens, falta saber da oferta" | O `prospeccao/perfil.json` não diz o que a pessoa vende | Passo 1 do roteiro: procurar o contexto na pasta, confirmar ou perguntar, gravar no perfil e só então escrever. Nunca presumir a oferta |
| "não entrou, é igual à mensagem do nº N" | Duas mensagens com o mesmo texto | Reescrever uma delas |
| "não entrou, tem link" | Primeira mensagem com link parece golpe | Tirar o link |

## A tela

| O que aparece | Causa | O que fazer |
|---|---|---|
| "A porta 3210 está sendo usada por outro programa" | Outro programa do computador ocupa o endereço da tela | Fechar o outro programa e rodar `npm run tela` de novo |
| "A tela não ligou" | O servidor da tela parou ao ligar | Ler as últimas linhas de `dados/tela.log` |
| "A tela não respondeu" | O servidor da tela caiu no meio | `npm run tela` e repetir o comando |
| "A tela foi desligada" (faixa no alto da página) | O computador reiniciou, ou alguém rodou `npm run tela -- fechar` | `npm run tela` |
| A tela não mostra o que acabou de mudar | A página ficou aberta de antes de uma atualização do sistema | `npm run tela -- fechar`, depois `npm run tela` |
| "Abrir no WhatsApp" abre o WhatsApp errado | O link abre o WhatsApp que estiver logado naquele computador | Conferir qual conta está no WhatsApp Web ou no aplicativo |
| "Já existe uma lista com esse nome" | Duas listas não podem ter o mesmo nome | Outro nome |
| "Essa lista ainda tem N leads" | Só lista vazia é apagada | Marcar os leads, mover para outra lista e apagar |
| "Essa lista não tem mensagem pronta para enviar" | Os leads da lista estão sem mensagem | Pedir à IA: "escreva as mensagens da lista X" |
| Marcou como enviado sem ter enviado | Clicar em "Abrir no WhatsApp" já marca | Abrir o negócio e clicar em "Não enviei" |

## WhatsApp

| O que aparece | Causa | O que fazer |
|---|---|---|
| "O QR Code venceu sem ser lido" ou "Ninguém leu o QR Code em 5 minutos" | Demorou para pegar o celular | `npm run conectar` de novo, ou "Conectar número" na tela |
| "Diga para qual lista enviar" | Há mais de uma lista com mensagem pronta | `npm run enviar -- "Nome da lista"` |
| "Não achei a lista" | Nome escrito diferente | `npm run listas` mostra os nomes |
| "O WhatsApp foi desconectado pelo celular" | Alguém removeu o aparelho em "Aparelhos conectados", ou o chip ficou semanas sem abrir o WhatsApp | "Conectar número" e ler o QR Code de novo |
| "Outro programa está usando esta mesma conexão" | A mesma pasta do sistema aberta em dois lugares | Deixar só uma tela aberta |
| "Não consegui conectar ao WhatsApp" | Sem internet | Conferir a internet e clicar em "Conectar número" |
| Negócio fica como "Sem WhatsApp" | Telefone fixo sem WhatsApp Business | Normal. O negócio sai da fila sozinho |
| "Parou porque 3 envios falharam em seguida" | Queda de internet, ou o WhatsApp restringiu o número | **Não insistir no mesmo dia.** Abrir o WhatsApp no celular do chip e ver se há aviso de restrição. Se houver, parar o envio pelo sistema e seguir à mão |
| "Parou porque a conexão com o WhatsApp caiu" | Internet instável | Esperar o número aparecer de novo no alto da tela e clicar em enviar. Nada é mandado duas vezes |
| "O limite de hoje já foi usado" | Já saiu a quantidade que a pessoa definiu para o dia | Amanhã saem as próximas, ou ela aumenta "Mensagens por dia" na parte Envio da tela |
| Negócio fica como "Falhou" | Aquele envio deu erro | Abrir o negócio e clicar em "Tentar de novo" |
