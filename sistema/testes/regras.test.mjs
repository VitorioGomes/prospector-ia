import assert from "node:assert/strict";
import { test } from "node:test";
import {
  INTERVALO_MAXIMO_PADRAO_S,
  INTERVALO_PADRAO_S,
  LIMITE_DIA_PADRAO,
  enviadosHoje,
  faltaNaOferta,
  intervaloMaximoMs,
  intervaloMs,
  limiteDoDia,
  montarFila,
  sortearPausaMs,
  validarMensagem,
} from "../src/lib/regras.mjs";
import { escolherNovos } from "../src/lib/busca.mjs";
import {
  desfazerEnvioPorMao,
  descartar,
  guardarMensagem,
  marcarEnviadoPorMao,
  tentarDeNovo,
  usarMensagemUnica,
  voltar,
} from "../src/lib/lista.mjs";
import { conferirPedido, filaDaCampanha, textoPara } from "../src/lib/campanhas.mjs";
import { arrumar, nomeAutomatico, problemaDoNome } from "../src/lib/listas.mjs";
import { ehCelular, exibir, normalizar, variantes } from "../src/lib/telefone.mjs";

const mensagemBoa = "Oi, aqui é o Vitório. Vi a clínica de vocês no Maps e fiquei com uma dúvida: quem responde o WhatsApp à noite?";

test("telefone: normaliza os formatos do Maps", () => {
  assert.equal(normalizar("+55 88 99999-0000"), "5588999990000");
  assert.equal(normalizar("(88) 3611-0000"), "558836110000");
  assert.equal(normalizar("(088) 3611-0000"), "558836110000");
  assert.equal(normalizar("0800 123 4567"), null);
  assert.equal(normalizar("4004-1234"), null);
  assert.equal(normalizar("+1 415 555 0100"), null);
  assert.equal(normalizar(""), null);
});

test("telefone: celular, variantes e exibicao", () => {
  assert.equal(ehCelular("5588999990000"), true);
  assert.equal(ehCelular("558836110000"), false);
  assert.deepEqual(variantes("5588999990000"), ["5588999990000", "558899990000"]);
  assert.deepEqual(variantes("558836110000"), ["558836110000"]);
  assert.equal(exibir("5588999990000"), "(88) 99999-0000");
  assert.equal(exibir("558836110000"), "(88) 3611-0000");
});

test("limite do dia: e a pessoa quem define, sem teto", () => {
  assert.equal(limiteDoDia(null), LIMITE_DIA_PADRAO);
  assert.equal(limiteDoDia({ limitePorDia: 10 }), 10);
  assert.equal(limiteDoDia({ limitePorDia: 500 }), 500);
  assert.equal(limiteDoDia({ limitePorDia: 0 }), LIMITE_DIA_PADRAO);
});

test("pausa: a menor e a pessoa quem define", () => {
  assert.equal(intervaloMs(null), INTERVALO_PADRAO_S * 1000);
  assert.equal(intervaloMs({}), INTERVALO_PADRAO_S * 1000);
  assert.equal(intervaloMs({ intervaloSegundos: 30 }), 30_000);
  assert.equal(intervaloMs({ intervaloSegundos: 0 }), 0);
  assert.equal(intervaloMs({ intervaloSegundos: -5 }), INTERVALO_PADRAO_S * 1000);
  assert.equal(intervaloMs({ intervaloSegundos: "abc" }), INTERVALO_PADRAO_S * 1000);
});

test("pausa: sorteada dentro da faixa que a pessoa definiu", () => {
  const faixa = { intervaloSegundos: 20, intervaloMaximoSegundos: 180 };
  assert.equal(intervaloMaximoMs(faixa), 180_000);
  assert.equal(sortearPausaMs(faixa, () => 0), 20_000);
  assert.equal(sortearPausaMs(faixa, () => 1), 180_000);
  assert.equal(sortearPausaMs(faixa, () => 0.5), 100_000);
  for (let i = 0; i < 200; i++) {
    const pausa = sortearPausaMs(faixa);
    assert.ok(pausa >= 20_000 && pausa <= 180_000);
  }
  // Minimo igual ao maximo e pausa fixa.
  assert.equal(sortearPausaMs({ intervaloSegundos: 30, intervaloMaximoSegundos: 30 }, () => 0.7), 30_000);
  // Maximo abaixo do minimo vale o minimo.
  assert.equal(intervaloMaximoMs({ intervaloSegundos: 90, intervaloMaximoSegundos: 10 }), 90_000);
  // Sem maximo escrito, vale o padrao (ou o minimo, se for maior).
  assert.equal(intervaloMaximoMs(null), INTERVALO_MAXIMO_PADRAO_S * 1000);
  assert.equal(intervaloMaximoMs({ intervaloSegundos: 300 }), 300_000);
});

test("enviados hoje: conta so o dia de hoje", () => {
  const agora = new Date(2026, 10, 12, 15, 0);
  const envios = [
    { em: new Date(2026, 10, 12, 9, 30).toISOString() },
    { em: new Date(2026, 10, 12, 14, 0).toISOString() },
    { em: new Date(2026, 10, 11, 14, 0).toISOString() },
  ];
  assert.equal(enviadosHoje(envios, agora), 2);
});

test("mensagem: recusa vazia, com campo aberto e com link, e nao olha o tamanho", () => {
  assert.equal(validarMensagem(mensagemBoa), null);
  assert.match(validarMensagem(""), /vazia/);
  assert.equal(validarMensagem("Oi, tudo bem?"), null);
  assert.equal(validarMensagem("a".repeat(5000)), null);
  assert.match(validarMensagem(`${mensagemBoa} {{nome}}`), /sem preencher/);
  assert.match(validarMensagem(`${mensagemBoa} [nome do dono]`), /sem preencher/);
  assert.match(validarMensagem(`${mensagemBoa} Veja em https://exemplo.com`), /link/);
});

test("fila: so quem esta pronto, com telefone, e nunca o mesmo numero duas vezes", () => {
  const negocios = [
    { n: 1, situacao: "pronto", telefone: "5588999990001", mensagem: mensagemBoa },
    { n: 2, situacao: "novo", telefone: "5588999990002", mensagem: null },
    { n: 3, situacao: "pronto", telefone: null, mensagem: mensagemBoa },
    { n: 4, situacao: "pronto", telefone: "5588999990001", mensagem: mensagemBoa }, // mesmo numero do 1
    { n: 5, situacao: "pronto", telefone: "5588999990005", mensagem: mensagemBoa }, // ja recebeu
    { n: 6, situacao: "descartado", telefone: "5588999990006", mensagem: mensagemBoa },
    { n: 7, situacao: "enviado", telefone: "5588999990007", mensagem: mensagemBoa },
    { n: 8, situacao: "pronto", telefone: "5588999990007", mensagem: mensagemBoa }, // mesmo numero do 7
  ];
  const envios = [{ telefone: "5588999990005", em: new Date().toISOString() }];
  assert.deepEqual(montarFila(negocios, envios).map((n) => n.n), [1]);
});

test("lista: descartar e voltar", () => {
  const novo = { n: 1, situacao: "novo", telefone: "5588999990001", mensagem: null };
  assert.equal(descartar(novo), null);
  assert.equal(novo.situacao, "descartado");
  assert.equal(voltar(novo), null);
  assert.equal(novo.situacao, "novo");

  const comMensagem = { n: 2, situacao: "descartado", telefone: "5588999990002", mensagem: mensagemBoa };
  voltar(comMensagem);
  assert.equal(comMensagem.situacao, "pronto");

  assert.match(descartar({ n: 3, situacao: "enviado" }), /já recebeu/);
  assert.match(voltar({ n: 4, situacao: "pronto" }), /não estava descartado/);
});

test("lista: enviado a mao entra no registro, e desfazer tira", () => {
  const negocio = { n: 1, situacao: "pronto", telefone: "5588999990001", mensagem: mensagemBoa };
  const outro = { n: 2, situacao: "pronto", telefone: "5588999990002", mensagem: `${mensagemBoa} E de manhã?` };
  const envios = [{ telefone: "5588999990009", n: 9, em: new Date().toISOString() }];

  assert.equal(marcarEnviadoPorMao(negocio, envios), null);
  assert.equal(negocio.situacao, "enviado");
  assert.equal(envios.length, 2);
  assert.equal(envios[1].porMao, true);
  assert.deepEqual(montarFila([negocio, outro], envios).map((n) => n.n), [2]);
  assert.match(marcarEnviadoPorMao(negocio, envios), /já estava/);

  assert.equal(desfazerEnvioPorMao(negocio, envios), null);
  assert.equal(negocio.situacao, "pronto");
  assert.equal(negocio.enviadoEm, undefined);
  assert.equal(envios.length, 1);
  assert.deepEqual(montarFila([negocio, outro], envios).map((n) => n.n), [1, 2]);
});

test("lista: o que o sistema enviou nao se desfaz", () => {
  const negocio = { n: 1, situacao: "enviado", enviadoPor: "sistema", telefone: "5588999990001", mensagem: mensagemBoa };
  const envios = [{ telefone: "5588999990001", n: 1, em: new Date().toISOString() }];
  assert.match(desfazerEnvioPorMao(negocio, envios), /à mão/);
  assert.equal(envios.length, 1);
});

test("lista: guardar mensagem confere, recusa repetida e deixa pronto", () => {
  const a = { n: 1, situacao: "novo", telefone: "5588999990001", mensagem: null };
  const b = { n: 2, situacao: "falhou", erro: "x", telefone: "5588999990002", mensagem: null };
  const semTelefone = { n: 3, situacao: "novo", telefone: null, mensagem: null };
  const enviado = { n: 4, situacao: "enviado", telefone: "5588999990004", mensagem: "antiga" };
  const negocios = [a, b, semTelefone, enviado];

  assert.equal(guardarMensagem(negocios, a, `  ${mensagemBoa}  `), null);
  assert.equal(a.mensagem, mensagemBoa);
  assert.equal(a.situacao, "pronto");

  assert.match(guardarMensagem(negocios, b, mensagemBoa.toUpperCase()), /igual à mensagem do nº 1/);
  assert.equal(guardarMensagem(negocios, b, `${mensagemBoa} E no domingo?`), null);
  assert.equal(b.situacao, "pronto");
  assert.equal(b.erro, undefined);

  // Guardar de novo o mesmo texto no mesmo negocio nao e repeticao.
  assert.equal(guardarMensagem(negocios, a, mensagemBoa), null);

  assert.match(guardarMensagem(negocios, a, "   "), /vazia/);
  assert.match(guardarMensagem(negocios, semTelefone, mensagemBoa), /telefone/);
  assert.match(guardarMensagem(negocios, enviado, mensagemBoa), /já recebeu/);
});

test("lista: tentar de novo so vale para o que falhou", () => {
  const falhou = { n: 1, situacao: "falhou", erro: "timeout", telefone: "5588999990001", mensagem: mensagemBoa };
  assert.equal(tentarDeNovo(falhou), null);
  assert.equal(falhou.situacao, "pronto");
  assert.equal(falhou.erro, undefined);
  assert.match(tentarDeNovo(falhou), /não tinha falhado/);
});

test("busca: negocio sem telefone nao entra, nem repetido, nem de outra cidade", () => {
  const lugares = [
    { data_id: "a", title: "Clínica A", address: "Rua 1, Sobral - CE", phone: "(88) 99999-0001" },
    { data_id: "b", title: "Clínica B", address: "Rua 2, Sobral - CE", phone: "" },
    { data_id: "c", title: "Clínica C", address: "Rua 3, Sobral - CE", phone: "0800 123 4567" },
    { data_id: "d", title: "Clínica D", address: "Rua 4, Forquilha - CE", phone: "(88) 99999-0004" },
    { data_id: "e", title: "Clínica E", address: "Rua 5, Sobral - CE", phone: "(88) 3611-0005" },
    { data_id: "a", title: "Clínica A", address: "Rua 1, Sobral - CE", phone: "(88) 99999-0001" },
    { data_id: "z", title: "Clínica Z", address: "Rua 9, Sobral - CE", phone: "(88) 99999-0009" },
  ];
  const jaNaLista = [{ n: 7, id: "z" }];
  const { novos, repetidos, deFora, semTelefone } = escolherNovos(lugares, jaNaLista, "Sobral, CE", { termo: "x", cidade: "Sobral, CE" });

  assert.deepEqual(novos.map((n) => [n.n, n.nome, n.telefone]), [
    [8, "Clínica A", "5588999990001"],
    [9, "Clínica E", "558836110005"],
  ]);
  assert.equal(semTelefone, 2);
  assert.equal(deFora, 1);
  assert.equal(repetidos, 1);
  assert.ok(novos.every((n) => n.telefone));
});

test("fila de uma lista: so os leads dela, e nunca quem ja recebeu por outra", () => {
  const negocios = [
    { n: 1, lista: "a", situacao: "pronto", telefone: "5588999990001", mensagem: mensagemBoa },
    { n: 2, lista: "b", situacao: "pronto", telefone: "5588999990002", mensagem: mensagemBoa },
    { n: 3, lista: "a", situacao: "pronto", telefone: "5588999990003", mensagem: mensagemBoa },
    { n: 4, lista: "b", situacao: "enviado", telefone: "5588999990004", mensagem: mensagemBoa },
    { n: 5, lista: "a", situacao: "pronto", telefone: "5588999990004", mensagem: mensagemBoa }, // mesmo numero do 4, da lista b
  ];
  assert.deepEqual(montarFila(negocios, [], "a").map((n) => n.n), [1, 3]);
  assert.deepEqual(montarFila(negocios, [], "b").map((n) => n.n), [2]);
  assert.deepEqual(montarFila(negocios, []).map((n) => n.n), [1, 2, 3]);
});

test("listas: nome automatico, nome repetido e lead antigo sem lista", () => {
  assert.equal(nomeAutomatico(["clínica de estética", "estética facial"], "Sobral, CE"), "Clínica de estética em Sobral, CE");

  const listas = [{ id: "a", nome: "Estética de Sobral" }];
  assert.match(problemaDoNome(listas, "  "), /nome/);
  assert.match(problemaDoNome(listas, "estética de sobral"), /Já existe/);
  assert.equal(problemaDoNome(listas, "estética de sobral", "a"), null);
  assert.equal(problemaDoNome(listas, "Pet shops"), null);

  const negocios = [
    { n: 1, lista: "a" },
    { n: 2, busca: { termo: "pet shop, banho e tosa", cidade: "Sobral, CE" } },
    { n: 3, busca: { termo: "pet shop, banho e tosa", cidade: "Sobral, CE" } },
    { n: 4, lista: "apagada" },
  ];
  assert.equal(arrumar(listas, negocios), true);
  assert.deepEqual(listas.map((l) => l.nome), ["Estética de Sobral", "Pet shop em Sobral, CE", "Minha lista"]);
  assert.equal(negocios[1].lista, negocios[2].lista);
  assert.equal(negocios[0].lista, "a");
  assert.equal(arrumar(listas, negocios), false);
});

test("oferta: os quatro primeiros campos sao obrigatorios, e espaco nao conta", () => {
  assert.equal(faltaNaOferta(null).length, 4);
  assert.deepEqual(faltaNaOferta({ seuNome: "Ana", oQueVoceVende: "curso de confeitaria", paraQuem: "  ", problemaQueResolve: "" }), [
    "para quem você vende",
    "que problema isso resolve",
  ]);
  assert.deepEqual(
    faltaNaOferta({ seuNome: "Ana", oQueVoceVende: "curso", paraQuem: "confeiteiras", problemaQueResolve: "cobrar pouco" }),
    [],
  );
});

const listaDeTeste = () => [
  { n: 1, nome: "Studio Bela", telefone: "5588999990001", situacao: "novo", lista: "a" },
  { n: 2, nome: "Clínica Vida", telefone: "5588999990002", situacao: "pronto", mensagem: "Mensagem própria, escrita só para a Clínica Vida, com mais de quarenta letras.", lista: "a" },
  { n: 3, nome: "Espaço Zen", telefone: "5588999990003", situacao: "enviado", mensagem: "Já foi.", lista: "a" },
  { n: 4, nome: "Sem Fone", telefone: null, situacao: "sem_telefone", lista: "a" },
  { n: 5, nome: "Tirado", telefone: "5588999990005", situacao: "descartado", lista: "a" },
  { n: 6, nome: "Falhou Antes", telefone: "5588999990006", situacao: "falhou", erro: "queda", lista: "a" },
  { n: 7, nome: "De Outra Lista", telefone: "5588999990007", situacao: "novo", lista: "b" },
];
const unica = "Olá, {nome}! Estou falando com os negócios da cidade sobre uma novidade. Posso te contar?";

test("mensagem unica: entra em quem ainda pode receber, so na lista escolhida, com o nome no lugar", () => {
  const negocios = listaDeTeste();
  assert.deepEqual(usarMensagemUnica(negocios, "a", unica), { guardadas: 3, mantidas: 0 });
  assert.equal(negocios[0].mensagem, "Olá, Studio Bela! Estou falando com os negócios da cidade sobre uma novidade. Posso te contar?");
  assert.equal(negocios[0].situacao, "pronto");
  assert.match(negocios[1].mensagem, /^Olá, Clínica Vida!/);
  assert.equal(negocios[2].mensagem, "Já foi.");
  assert.equal(negocios[3].mensagem, undefined);
  assert.equal(negocios[4].mensagem, undefined);
  assert.equal(negocios[5].situacao, "pronto");
  assert.equal(negocios[5].erro, undefined);
  assert.equal(negocios[6].mensagem, undefined);
  // O texto repetido, que a mensagem por lead recusa, aqui e o pedido: a fila aceita todos.
  assert.equal(montarFila(negocios, [], "a").length, 3);
});

test("mensagem unica: da para manter quem ja tem mensagem propria", () => {
  const negocios = listaDeTeste();
  assert.deepEqual(usarMensagemUnica(negocios, "a", unica, { soSemMensagem: true }), { guardadas: 2, mantidas: 1 });
  assert.match(negocios[1].mensagem, /^Mensagem própria/);
});

test("mensagem unica: recusa o que nao da para enviar, sem mexer em nada", () => {
  const negocios = listaDeTeste();
  assert.match(usarMensagemUnica(negocios, "a", "   ").erro, /Escreva/);
  assert.match(usarMensagemUnica(negocios, "a", `${unica} Você fica em {cidade}?`).erro, /\{nome\}/);
  assert.match(usarMensagemUnica(negocios, "a", `${unica} Veja em https://exemplo.com`).erro, /link/);
  assert.match(usarMensagemUnica(negocios, "nao-existe", unica).erro, /nenhum lead/);
  assert.equal(negocios[0].mensagem, undefined);
  assert.equal(negocios[0].situacao, "novo");
});

const listasDeTeste = [{ id: "a", nome: "Lista A" }, { id: "b", nome: "Lista B" }];

test("envio: a mesma para todos pega quem ainda pode receber, e quem falhou neste envio nao volta", () => {
  const negocios = listaDeTeste();
  const campanha = { id: "c1", lista: { id: "a" }, modo: "mesma", tipo: "texto", texto: unica };
  assert.deepEqual(filaDaCampanha(negocios, [], campanha).map((n) => n.n), [1, 2, 6]);
  // O 6 falhou por outro motivo, antes. Se falhar neste envio, sai da fila.
  negocios[5].campanha = "c1";
  assert.deepEqual(filaDaCampanha(negocios, [], campanha).map((n) => n.n), [1, 2]);
  // Quem ja recebeu por outra lista nao recebe de novo.
  assert.deepEqual(filaDaCampanha(negocios, [{ telefone: "5588999990001" }], campanha).map((n) => n.n), [2]);
  assert.equal(textoPara(campanha, negocios[0]), "Olá, Studio Bela! Estou falando com os negócios da cidade sobre uma novidade. Posso te contar?");
});

test("envio: uma para cada lead usa a mensagem que esta no lead", () => {
  const negocios = listaDeTeste();
  const campanha = { id: "c2", lista: { id: "a" }, modo: "cada", tipo: "texto", texto: null };
  assert.deepEqual(filaDaCampanha(negocios, [], campanha).map((n) => n.n), [2]);
  assert.match(textoPara(campanha, negocios[1]), /^Mensagem própria/);
});

test("envio: o pedido e conferido antes de guardar", () => {
  const negocios = listaDeTeste();
  const confere = (pedido, agora) => conferirPedido(pedido, listasDeTeste, negocios, [], agora);
  assert.match(confere({ lista: "nao-existe" }).erro, /qual lista/);
  assert.match(confere({ lista: "a", tipo: "holograma" }).erro, /tipo/);
  assert.match(confere({ lista: "a", modo: "mesma", tipo: "texto", texto: "  " }).erro, /Escreva/);
  assert.equal(confere({ lista: "a", modo: "mesma", tipo: "texto", texto: "Oi, {nome}" }).erro, undefined);
  assert.match(confere({ lista: "a", modo: "mesma", tipo: "imagem", texto: "Legenda" }).erro, /imagem/);

  const bom = confere({ lista: "a", modo: "mesma", tipo: "texto", texto: unica });
  assert.equal(bom.erro, undefined);
  assert.deepEqual(bom.pedido.lista, { id: "a", nome: "Lista A" });
  assert.equal(bom.fila.length, 3);
  assert.equal(bom.pedido.comecaEm, null);

  // Sem dizer o modo, e o do comando "npm run enviar": uma para cada lead.
  assert.equal(confere({ lista: "a" }).pedido.modo, "cada");

  const agora = new Date("2026-11-14T12:00:00Z");
  assert.match(confere({ lista: "a", comecaEm: "2026-11-14T11:00:00Z" }, agora).erro, /já passou/);
  assert.match(confere({ lista: "a", comecaEm: "amanhã cedo" }, agora).erro, /dia e a hora/);
  assert.equal(confere({ lista: "a", comecaEm: "2026-11-15T12:00:00Z" }, agora).pedido.comecaEm, "2026-11-15T12:00:00.000Z");
});
