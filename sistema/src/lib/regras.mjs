/**
 * As regras do envio, sem WhatsApp e sem arquivo, para poderem ser testadas.
 *
 * Quantas mensagens por dia e quanto tempo entre uma e outra e a pessoa quem define, no
 * perfil (decisao do dono, 12/11/2026). A pausa e uma faixa, "de 20 segundos a 3 minutos":
 * o sistema sorteia um tempo dentro dela a cada mensagem. Minimo igual ao maximo e pausa
 * fixa. O que nao muda: nunca duas vezes para o mesmo numero, e parar quando os envios
 * comecam a falhar em seguida.
 */

/** Valem quando o perfil nao diz nada. */
export const LIMITE_DIA_PADRAO = 20;
export const INTERVALO_PADRAO_S = 60;
export const INTERVALO_MAXIMO_PADRAO_S = 120;
/** Falhas seguidas antes de parar: insistir com o WhatsApp recusando piora tudo. */
export const MAX_FALHAS_SEGUIDAS = 3;

/**
 * A oferta de quem prospecta: o que a IA precisa saber para escrever uma mensagem que
 * faca sentido. Sem isso ela inventa, ou presume que a pessoa vende o atendente de IA
 * (decisao do dono, 12/11/2026: quem comprou pode vender curso, servico, qualquer coisa).
 * Os quatro primeiros sao obrigatorios para guardar mensagens escritas pela IA.
 */
export const CAMPOS_DA_OFERTA = [
  { chave: "seuNome", nome: "como você se apresenta", obrigatorio: true },
  { chave: "oQueVoceVende", nome: "o que você vende", obrigatorio: true },
  { chave: "paraQuem", nome: "para quem você vende", obrigatorio: true },
  { chave: "problemaQueResolve", nome: "que problema isso resolve", obrigatorio: true },
  { chave: "prova", nome: "um resultado ou caso real", obrigatorio: false },
  { chave: "objetivoDaConversa", nome: "o que você quer que a pessoa faça ao responder", obrigatorio: false },
];

/** Os nomes dos campos obrigatorios da oferta que ainda estao vazios. */
export function faltaNaOferta(perfil) {
  return CAMPOS_DA_OFERTA.filter((c) => c.obrigatorio && !String(perfil?.[c.chave] ?? "").trim()).map((c) => c.nome);
}

export function limiteDoDia(perfil) {
  const pedido = Number(perfil?.limitePorDia);
  if (!Number.isFinite(pedido) || pedido < 1) return LIMITE_DIA_PADRAO;
  return Math.floor(pedido);
}

/** A menor pausa entre uma mensagem e a seguinte, em milissegundos. */
export function intervaloMs(perfil) {
  const pedido = Number(perfil?.intervaloSegundos);
  if (perfil?.intervaloSegundos === undefined || perfil?.intervaloSegundos === "" || !Number.isFinite(pedido) || pedido < 0) {
    return INTERVALO_PADRAO_S * 1000;
  }
  return Math.round(pedido * 1000);
}

/** A maior pausa. Nunca fica abaixo da menor. */
export function intervaloMaximoMs(perfil) {
  const minimo = intervaloMs(perfil);
  const escrito = perfil?.intervaloMaximoSegundos;
  const pedido = Number(escrito);
  if (escrito === undefined || escrito === "" || !Number.isFinite(pedido)) {
    return Math.max(minimo, INTERVALO_MAXIMO_PADRAO_S * 1000);
  }
  return Math.max(minimo, Math.round(pedido * 1000));
}

/** A pausa desta vez: um tempo sorteado entre a menor e a maior. */
export function sortearPausaMs(perfil, sorteio = Math.random) {
  const minimo = intervaloMs(perfil);
  const maximo = intervaloMaximoMs(perfil);
  return Math.round(minimo + (maximo - minimo) * sorteio());
}

const mesmoDia = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Quantas mensagens ja sairam hoje. O teste (--teste) nao entra no registro. */
export function enviadosHoje(envios, agora = new Date()) {
  return envios.filter((e) => mesmoDia(new Date(e.em), agora)).length;
}

/** Devolve o problema da mensagem, em portugues, ou null quando ela pode ser enviada. */
export function validarMensagem(texto) {
  if (typeof texto !== "string" || !texto.trim()) return "está vazia";
  const limpo = texto.trim();
  // Tamanho nao e conferido: quem decide se a mensagem e curta ou longa e a pessoa.
  if (/\{\{|\}\}|\[[^\]]*\]/.test(limpo)) return "tem um campo sem preencher ({{...}} ou [...])";
  if (/https?:\/\/|www\./i.test(limpo)) {
    return "tem link: primeira mensagem com link, vinda de número desconhecido, parece golpe";
  }
  return null;
}

/**
 * Quem recebe mensagem agora: tem mensagem pronta, tem telefone e esse telefone nunca
 * recebeu nada. Dois negocios com o mesmo numero (filial, mesma dona) contam como um.
 *
 * Com lista, a fila e so dos leads daquela lista. O "nunca duas vezes" continua valendo
 * entre listas: quem ja recebeu por uma nao recebe por outra.
 */
export function montarFila(negocios, envios, lista = null) {
  const jaReceberam = new Set(envios.map((e) => e.telefone));
  for (const n of negocios) if (n.situacao === "enviado" && n.telefone) jaReceberam.add(n.telefone);

  const fila = [];
  for (const n of negocios) {
    if (lista && n.lista !== lista) continue;
    if (n.situacao !== "pronto" || !n.telefone || !n.mensagem) continue;
    if (jaReceberam.has(n.telefone)) continue;
    jaReceberam.add(n.telefone);
    fila.push(n);
  }
  return fila;
}

export const NOMES_DA_SITUACAO = {
  novo: "Sem mensagem",
  pronto: "Pronto para enviar",
  enviado: "Enviado",
  descartado: "Descartado",
  sem_whatsapp: "Sem WhatsApp",
  falhou: "Falhou",
};
