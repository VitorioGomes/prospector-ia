# Prospectar clientes pelo Google Maps e pelo WhatsApp

Este é o roteiro. Quem lê é você, a IA de terminal. Quem está do outro lado quer achar clientes
para alguma coisa que vende, e pode nunca ter aberto um terminal na vida.

Funciona igual no Claude Code, no Gemini CLI e no Codex.

---

## O que você vai entregar

1. Uma **lista de negócios** da cidade e do nicho que a pessoa escolher, tirada do Google Maps.
2. Uma **mensagem de abordagem para cada um**, escrita por você, uma diferente da outra, a partir
   do que a pessoa vende.
3. O **envio**, do jeito que ela preferir: ela mesma, um por um, ou o sistema, sozinho, devagar,
   por um chip separado.

**Você não escreve o sistema.** Ele está pronto na pasta `sistema/`. Você conversa, roda os
comandos e escreve as mensagens.

**Dá para fazer tudo pela conversa.** Existe também uma **tela** no navegador (`npm run tela`),
com os leads, as listas, a busca e o envio. Ela é **opcional**: tudo o que a tela faz, um comando
seu também faz, e o que você muda aparece nela em dois segundos. Tem quem queira ver e mexer na
tela, e tem quem só queira pedir para você. Ofereça a tela uma vez e siga o que a pessoa
preferir. **O único momento em que a tela é necessária é o QR Code** para conectar o número.

Todo comando roda **dentro de `sistema/`**. Se a sua ferramenta não guarda a pasta entre um
comando e outro, entre nela em cada comando.

## Isto já foi usado?

Rode `npm run situacao`. Ele mostra o que já está pronto: oferta, WhatsApp, listas e envios.
Se já existem leads e a oferta está preenchida, a pessoa está voltando: **não refaça a
entrevista**, leia `prospeccao/perfil.json`, diga onde ela parou e pergunte o que quer fazer agora
(buscar mais, escrever mensagens, enviar).

---

## Regras que não se quebram

1. **Não mexa no código de `sistema/src/`** enquanto estiver prospectando. Quantas mensagens
   saem por dia e a pausa entre elas **é a pessoa quem define**, e isso se muda no
   `prospeccao/perfil.json`, não no código.
2. **Nunca invente nada sobre o negócio abordado.** Só entra na mensagem o que está na lista ou o
   que você leu no site dele. "Vi que vocês demoram para responder" é mentira se você não viu.
3. **Nunca invente nada sobre quem prospecta, nem presuma o que ela vende.** Produto, resultado,
   cliente atendido, tempo de mercado: só o que você leu nos arquivos dela ou o que ela disse
   (Passo 1). Sem isso você não escreve mensagem nenhuma, e o `npm run mensagens` recusa.
4. **Nada sai sem a pessoa aprovar.** Antes de qualquer envio ela lê as mensagens, na conversa ou
   na tela, e diz para enviar. Você só roda `npm run enviar` quando ela pedir, para a lista que
   ela disser. "Escreva as mensagens" não é "envie".
5. **Uma pergunta por vez**, em linguagem de gente. Nome de arquivo e de comando só quando for
   preciso.
6. **Quando travar, pare e explique.** Os comandos já dizem o que fazer em cada erro: leia a
   mensagem para a pessoa, com suas palavras, e não siga adiante com um passo falhado.

---

## Passo 0 — Conferir a máquina

Precisa de **Node 20 ou mais novo** (`node --version`). Se faltar, mande instalar em
<https://nodejs.org> (opção LTS), fechar o terminal, abrir de novo e chamar você.

Dentro de `sistema/`, rode `npm install`. A primeira vez leva um ou dois minutos.

---

## Passo 1 — A oferta: o que ela vende e para quem

É a base de todas as mensagens. **Antes de perguntar, procure: o contexto pode já estar na pasta.**

### Primeiro, procure

Olhe a pasta em que você foi aberto, a pasta de cima e as pastas vizinhas, atrás de arquivos que
contem o que a empresa da pessoa faz:

- `CLAUDE.md`, `AGENTS.md`, `GEMINI.md` ou `README.md` que descrevam o negócio;
- notas da empresa (visão geral, produtos, serviços, página de vendas, proposta);
- o **Atendente IA + CRM**, se estiver instalado por perto: `sistema/negocio/negocio.json` e
  `sistema/negocio/conhecimento.md` dizem o que o negócio vende, para quem e como fala.

Leia só o que serve para entender a oferta. Não mexa em nada fora desta pasta.

**Cuidado com a conclusão.** Achar o atendente instalado diz o que **a empresa dela** vende; não
diz que ela quer vender atendente de IA. Uma escola de confeitaria com o atendente instalado
prospecta para vender curso. E quem vende mais de uma coisa precisa dizer qual delas é a desta
prospecção.

### Depois, confirme ou pergunte

- **Achou contexto:** diga em duas ou três frases o que você entendeu ("Pelo que li, você vende X
  para Y, e o problema que resolve é Z. É isso que vamos oferecer nesta prospecção?") e ajuste com
  o que ela responder. Pergunte só o que ficou faltando.
- **Não achou nada** (pasta vazia, ou só este projeto): faça as perguntas abaixo, **uma de cada
  vez**.

| Campo | Pergunta |
|---|---|
| `seuNome` | Como você se apresenta? O nome que vai na mensagem ("Ana", "Ana, da Doce Ofício") |
| `oQueVoceVende` | O que você vende? Em uma frase, do jeito que diria a um conhecido |
| `paraQuem` | Para que tipo de negócio ou de pessoa? |
| `problemaQueResolve` | Que problema do cliente isso resolve? O que incomoda ele antes de comprar |
| `prova` | Tem um resultado ou caso real para contar? (opcional; se não tiver, fica vazio) |
| `objetivoDaConversa` | Quando a pessoa responder, o que você quer que ela faça? Uma conversa, uma reunião, ver uma demonstração (opcional) |
| `cidade` | Em que cidade buscar? Cidade e estado. Pode ser mais de uma, uma busca por vez |

Os quatro primeiros são obrigatórios. Resposta vaga ("vendo marketing") não serve para escrever:
peça um exemplo ("o que exatamente você entrega para o cliente?") até dar para explicar a oferta a
um desconhecido. Não melhore nem enfeite o que ela disser.

### Guarde

Copie `prospeccao/perfil.molde.json` para `prospeccao/perfil.json` e grave o que ficou acertado,
com as palavras dela. É desse arquivo que você lê a oferta nas próximas conversas, sem procurar
nem perguntar de novo. Se ela mudar o que vende, atualize o arquivo.

`limitePorDia`, `intervaloSegundos` e `intervaloMaximoSegundos` ficam como vieram até o Passo 5.

---

## Passo 2 — Buscar

```
npm run buscar -- "Sobral, CE" "clínica de estética" "estética facial" "depilação a laser"
```

Primeiro a cidade, com o estado. Depois **de três a cinco jeitos de dizer o nicho**: cada termo
traz até 20 negócios, e termos diferentes trazem negócios diferentes. Pense em como o dono
descreveria o próprio negócio no Maps (para estética: "clínica de estética", "estética facial",
"harmonização facial", "depilação a laser"). São no máximo 8 termos por busca.

**Cada busca guarda os leads numa lista.** Sem dizer nada, a lista leva o nome da busca
("Clínica de estética em Sobral, CE"). Para escolher a lista, que é criada se não existir:

```
npm run buscar -- "Sobral, CE" "clínica de estética" --lista "Estética de Sobral"
```

As listas existem para a pessoa decidir para quem enviar: o envio sai para uma lista de cada vez.
Quem já está em qualquer lista não entra de novo.

**Só entra na lista quem tem telefone.** Negócio sem telefone fica de fora, porque não há como
entrar em contato. A busca diz quantos ficaram de fora por isso.

**Não precisa de chave nem de cadastro.** Na primeira busca o sistema baixa um programa de 60 MB,
uma vez só; avise que esse primeiro passo demora um pouco mais. As buscas seguintes levam
segundos.

Leia o resultado para a pessoa: quantos leads novos e quantos com celular. Se vier pouco, tente
outros termos ou uma cidade vizinha.

**Não dispare dezenas de buscas seguidas.** O Google limita quem busca demais em pouco tempo. Uma
busca por nicho e por cidade, quando a pessoa pedir.

A pessoa também pode buscar sozinha, na parte Buscar da tela. Os leads caem nos mesmos arquivos.

### Organizar as listas

```
npm run listas                                    mostra as listas e quantos leads cada uma tem
npm run listas -- criar "Prioridade"
npm run listas -- mover "Prioridade" 4 9 12       põe os leads 4, 9 e 12 na lista (cria, se não existir)
npm run listas -- renomear "Prioridade" "Primeiro contato"
npm run listas -- apagar "Prioridade"             só lista vazia
npm run marcar -- descartar 4 9                   tira os leads do envio (voltar desfaz)
```

Cada lead fica em uma lista só. Se ela pedir "separa os que têm mais de 50 avaliações", leia
`dados/negocios.json`, escolha os números e use o `mover`.

---

## Passo 3 — Escrever as mensagens

**Quem escreve as mensagens é você, aqui na conversa, quando a pessoa pede.** Depois de uma busca,
ofereça escrever na hora. A tela não escreve sozinha: ela mostra quantos leads estão sem mensagem
e o pedido pronto para a pessoa colar para você.

**Antes de escrever, confira a oferta** em `prospeccao/perfil.json`. Se faltar algum dos quatro
campos obrigatórios, volte ao Passo 1: a pessoa pode ter buscado pela tela antes de falar com
você.

Leia `dados/negocios.json`, `dados/listas.json` e a oferta. Cada negócio tem o campo `lista`, com
o `id` de uma das listas. Se a pessoa disse a lista, escreva só para os negócios dela. Escreva uma
mensagem para cada negócio que está como `novo`, e grave todas em `dados/mensagens.json`, assim:

```json
{
  "1": "texto da mensagem para o negócio nº 1",
  "2": "texto da mensagem para o negócio nº 2"
}
```

A chave é o campo `n` do negócio. Depois rode `npm run mensagens`: ele confere cada uma e diz
quais não entraram e por quê. Corrija as recusadas no mesmo arquivo e rode de novo. Os leads
passam a "Pronto".

**Como é uma boa primeira mensagem:**

- **Nasce da oferta.** A mensagem liga uma coisa verdadeira daquele negócio ao problema que a
  oferta resolve (`problemaQueResolve`). Quem vende curso de precificação para confeitaria
  pergunta sobre preço; quem vende atendimento automático pergunta sobre o WhatsApp. Se a
  mensagem serviria para qualquer oferta, ela está errada.
- **Curta:** de duas a quatro frases. Ninguém lê parede de texto de número desconhecido.
- **Diz quem é**, com o `seuNome`, logo no começo.
- **Tem uma coisa que só vale para aquele negócio:** o nome dele, o bairro, o tipo de serviço, a
  quantidade de avaliações, algo que você leu no site. É isso que separa abordagem de panfleto.
- **Termina com uma pergunta fácil de responder**, ligada ao problema, não com uma oferta. A venda
  acontece na conversa, depois que respondem. Se houver `objetivoDaConversa`, a pergunta abre
  caminho para ele, sem pedir a reunião logo de cara.
- **Sem link, sem preço, sem "promoção", sem letras maiúsculas gritando.** O sistema recusa
  mensagem com link.
- **A `prova` entra só se existir**, e do jeito que a pessoa contou. Em poucas mensagens, não em
  todas.
- **Cada uma com a sua redação.** Não troque só o nome do negócio: mude a abertura, a ordem e a
  pergunta. O sistema recusa duas mensagens iguais.
- **No jeito de falar da pessoa.** Se ela escreve sem formalidade, a mensagem também.

**Se o lead não combina com a oferta** (ela vende para confeitarias e a busca trouxe uma loja de
embalagens), não force a mensagem: avise a pessoa e sugira descartar.

Se o negócio tem site e a sua ferramenta abre páginas, **leia o site dos dez primeiros** para
achar um detalhe verdadeiro. Se não abrir, use só o que está na lista.

Antes de escrever para todos, **mostre três mensagens** à pessoa e pergunte se é esse o tom.
Ajuste e só então escreva o resto.

---

## Passo 4 — A pessoa aprova

Ela precisa ler as mensagens antes de qualquer envio. Pergunte como prefere:

- **Na conversa:** mostre as mensagens, com o Nº e o nome de cada negócio. Se forem muitas,
  mostre as dez primeiras e pergunte se quer ver o resto.
- **Na tela:** `npm run tela` abre `http://localhost:3210` no navegador. O comando termina em
  segundos e a tela continua aberta, mesmo com o terminal fechado. Lá ela vê as listas, clica num
  lead para ler ou mudar a mensagem, marca vários para mover de lista ou descartar.

O que ela pedir pela conversa, você faz por aqui:

- **Refazer uma mensagem:** escreva de novo em `dados/mensagens.json` e rode `npm run mensagens`
- **Tirar um negócio:** `npm run marcar -- descartar 4 9` (`voltar` desfaz)
- **Separar um grupo:** `npm run listas -- mover "Nome da lista" 4 9 12`

---

## Passo 5 — Enviar

Pergunte como ela quer enviar. São dois jeitos, e dá para misturar.

### Ela mesma, um por um

Na tela, em Leads, ela abre o negócio e clica em **"Abrir no WhatsApp"**: a conversa abre com a
mensagem escrita, e ela aperta enviar. Sai do WhatsApp que estiver aberto no computador dela. O
negócio já fica como Enviado, e "Não enviei" desfaz.

Sem a tela, passe o link de cada um (`https://wa.me/<telefone>?text=<mensagem>`, com a mensagem
codificada para URL) e, quando ela disser quais mandou, registre, para o sistema nunca repetir:

```
npm run marcar -- enviado 1 2 5
```

### Pelo sistema

**Antes de conectar, diga estas duas coisas, uma vez cada:**

- **Use um chip separado, só para prospectar.** Nem o pessoal, nem o do atendimento.
- **As respostas chegam no celular desse chip, e quem responde é ela.** O sistema só manda a
  primeira mensagem, e nunca duas vezes para o mesmo número.

Depois, um passo de cada vez:

1. **Conectar:** `npm run conectar`. Abre a tela no navegador com o QR Code e espera a leitura. No
   celular do chip: WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho. Só
   precisa ser feito uma vez: o número continua conectado nos dias seguintes. **Este é o único
   passo que depende da tela.**
2. **O ritmo.** Pergunte, uma de cada vez: quantas mensagens por dia (padrão 20) e qual a pausa
   entre uma e outra, que é uma faixa, "de tantos a tantos segundos" (padrão de 60 a 120). A cada
   mensagem o sistema sorteia uma espera dentro da faixa; com o mesmo número nos dois, a pausa é
   fixa. Grave em `limitePorDia`, `intervaloSegundos` e `intervaloMaximoSegundos`, no
   `prospeccao/perfil.json`. A escolha é dela: não há teto nem horário proibido, e ela envia no
   dia e na hora que quiser. Se ela pedir sua opinião, diga em uma frase que número novo mandando
   muito e rápido para quem não conhece é o que o WhatsApp mais bloqueia, e respeite o que ela
   decidir. **Num chip novo, recomende 5 no primeiro dia.**
3. **Provar antes:** peça o número pessoal dela e rode
   `npm run enviar -- teste 88999990000 "Nome da lista"`. A primeira mensagem da lista chega no
   celular dela, do jeito que o negócio vai receber. Nada é registrado.
4. **Enviar:** quando ela mandar, e para a lista que ela disser:
   `npm run enviar -- "Nome da lista"`. O comando começa o envio e volta na hora.

```
npm run enviar -- andamento      como está o envio
npm run enviar -- parar          para o envio
```

O envio sai só para os leads prontos daquela lista. Para outra lista, é outro envio, depois que o
primeiro terminar.

O envio continua com o terminal e o navegador fechados, mas **o computador precisa ficar ligado**
(20 mensagens com pausa de 60 a 120 segundos levam cerca de meia hora). Se o computador desligar
no meio, nada se perde: o que já saiu está registrado, e o resto continua na fila.

Se ela preferir, tudo isto também está na parte Envio da tela: conectar, ritmo, teste, escolher a
lista e enviar.

---

## Passo 6 — Entregar

Feche dizendo, em poucas linhas:

- quantos leads há em cada lista e o que já saiu (`npm run listas`);
- que para continuar amanhã é só abrir esta pasta, chamar você e pedir "continue a prospecção";
- que a tela, se ela quiser ver, está em `http://localhost:3210` (depois de reiniciar o
  computador, peça a você para abrir de novo);
- que as respostas chegam no WhatsApp e a conversa a partir dali é dela;
- que quem pedir para não receber mais deve ser descartado: ela te diz o número ou o nome.

---

## Quando algo dá errado

Os comandos explicam o próprio erro. Os casos que mais aparecem estão em
[referencias/problemas.md](referencias/problemas.md).
