/**
 * Um envio guardado: para qual lista, que mensagem (texto, imagem, video, audio ou
 * documento), se e a mesma para todos ou uma para cada lead, e quando comeca.
 *
 * Aqui ele se chama "campanha" para nao confundir com dados/envios.json, que e outra coisa:
 * o registro de quem ja recebeu, que impede mandar duas vezes para o mesmo numero. Para a
 * pessoa, na tela, e sempre "envio".
 */
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { caminhos, gravarJson, lerJson } from "./arquivos.mjs";
import { montarMensagemUnica, problemaDaMensagemUnica } from "./lista.mjs";
import { montarFila } from "./regras.mjs";

const MB = 1024 * 1024;

/** O que cada tipo aceita. Sem "extensoes", aceita qualquer arquivo. */
export const TIPOS = {
  texto: { nome: "Texto" },
  imagem: { nome: "Imagem", maximoMb: 16, extensoes: { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" } },
  video: { nome: "Vídeo", maximoMb: 16, extensoes: { mp4: "video/mp4" } },
  audio: {
    nome: "Áudio",
    maximoMb: 16,
    extensoes: { ogg: "audio/ogg; codecs=opus", opus: "audio/ogg; codecs=opus", mp3: "audio/mpeg", m4a: "audio/mp4" },
  },
  documento: { nome: "Documento", maximoMb: 64 },
};

const MIME_DE_DOCUMENTO = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  zip: "application/zip",
};

export const SITUACOES = ["agendado", "enviando", "pausado", "terminado", "cancelado"];
/** Agendado que passou muito da hora nao sai sozinho: a pessoa decide. */
export const ATRASO_MAXIMO_MS = 3 * 60 * 60 * 1000;

export const lerCampanhas = () => lerJson(caminhos.campanhas, []);
const gravarCampanhas = (campanhas) => gravarJson(caminhos.campanhas, campanhas);

const extensaoDe = (nome) => path.extname(String(nome)).slice(1).toLowerCase();

/** O tipo de conteudo do arquivo, pela extensao, ou null se o tipo de mensagem nao aceita. */
function mimeDe(tipo, nome) {
  const extensao = extensaoDe(nome);
  if (tipo === "documento") return MIME_DE_DOCUMENTO[extensao] ?? "application/octet-stream";
  return TIPOS[tipo]?.extensoes?.[extensao] ?? null;
}

const aceitos = (tipo) => Object.keys(TIPOS[tipo].extensoes).map((e) => `.${e}`).join(", ");

/** Onde o arquivo guardado esta no disco. So o nome vale: nada de caminho vindo de fora. */
export const caminhoDoArquivo = (arquivo) => path.join(caminhos.arquivos, path.basename(String(arquivo?.guardado ?? "")));

/**
 * Guarda o arquivo que a pessoa escolheu na tela. Devolve { erro } ou { arquivo }, em que
 * arquivo = { nome, guardado, mime, tamanho }.
 */
export function guardarArquivo(tipo, nomeOriginal, conteudo) {
  if (!TIPOS[tipo] || tipo === "texto") return { erro: "Esse tipo de mensagem não leva arquivo." };
  const nome = path
    .basename(String(nomeOriginal ?? "").replaceAll("\\", "/"))
    .replace(/[^\p{L}\p{N} ._()-]/gu, "_")
    .slice(-80)
    .trim();
  if (!nome || !extensaoDe(nome)) return { erro: "Não entendi o nome do arquivo. Ele precisa ter extensão, como .jpg ou .pdf." };
  const mime = mimeDe(tipo, nome);
  if (!mime) return { erro: `Para ${TIPOS[tipo].nome.toLowerCase()}, o arquivo precisa ser ${aceitos(tipo)}.` };
  if (conteudo.length === 0) return { erro: "O arquivo chegou vazio. Escolha de novo." };
  if (conteudo.length > TIPOS[tipo].maximoMb * MB) {
    return { erro: `O arquivo tem ${(conteudo.length / MB).toFixed(1).replace(".", ",")} MB. O limite para ${TIPOS[tipo].nome.toLowerCase()} é de ${TIPOS[tipo].maximoMb} MB.` };
  }
  mkdirSync(caminhos.arquivos, { recursive: true });
  const guardado = `${randomBytes(4).toString("hex")}-${nome}`;
  writeFileSync(path.join(caminhos.arquivos, guardado), conteudo);
  return { arquivo: { nome, guardado, mime, tamanho: conteudo.length } };
}

/** Confere o arquivo que o pedido aponta, relendo o disco. Devolve { erro } ou { arquivo }. */
function conferirArquivo(tipo, arquivo) {
  if (!arquivo?.guardado) return { erro: `Escolha ${tipo === "imagem" ? "a imagem" : tipo === "video" ? "o vídeo" : tipo === "audio" ? "o áudio" : "o documento"} antes.` };
  const caminho = caminhoDoArquivo(arquivo);
  if (!existsSync(caminho)) return { erro: "Não achei mais o arquivo deste envio. Escolha o arquivo de novo." };
  const nome = path.basename(String(arquivo.nome ?? arquivo.guardado));
  const mime = mimeDe(tipo, path.basename(arquivo.guardado));
  if (!mime) return { erro: `Para ${TIPOS[tipo].nome.toLowerCase()}, o arquivo precisa ser ${aceitos(tipo)}.` };
  return { arquivo: { nome, guardado: path.basename(arquivo.guardado), mime, tamanho: statSync(caminho).size } };
}

/** Legenda de imagem, video ou documento: pode ficar vazia, mas segue as regras do texto. */
function problemaDaLegenda(texto, negocio) {
  if (/\{[^{}]*\}/.test(texto.replace(/\{nome\}/gi, ""))) {
    return "A legenda tem um campo que eu não conheço. O único que vale é {nome}, que vira o nome do negócio.";
  }
  const montada = montarMensagemUnica(texto, negocio ?? { nome: "" });
  if (/https?:\/\/|www\./i.test(montada)) return "A legenda tem link: primeira mensagem com link, vinda de número desconhecido, parece golpe.";
  return null;
}

/**
 * Quem recebe neste envio, na ordem.
 * - "cada": os leads prontos da lista, cada um com a mensagem que esta nele.
 * - "mesma": todo lead da lista que ainda pode receber. O texto e montado na hora de enviar.
 *   Quem falhou NESTE envio nao volta para a fila, senao o envio nunca acabaria.
 * Nos dois, nunca o mesmo numero duas vezes, nem quem ja recebeu por outra lista.
 */
export function filaDaCampanha(negocios, envios, campanha) {
  if (campanha.modo === "cada") return montarFila(negocios, envios, campanha.lista.id);
  const jaReceberam = new Set(envios.map((e) => e.telefone));
  for (const n of negocios) if (n.situacao === "enviado" && n.telefone) jaReceberam.add(n.telefone);

  const fila = [];
  for (const n of negocios) {
    if (n.lista !== campanha.lista.id || !n.telefone) continue;
    const podeTentar = n.situacao === "novo" || n.situacao === "pronto" || (n.situacao === "falhou" && n.campanha !== campanha.id);
    if (!podeTentar || jaReceberam.has(n.telefone)) continue;
    jaReceberam.add(n.telefone);
    fila.push(n);
  }
  return fila;
}

/** O texto (ou a legenda) que este negocio recebe neste envio. Pode ser "". */
export const textoPara = (campanha, negocio) =>
  campanha.modo === "cada" ? (negocio.mensagem ?? "") : campanha.texto ? montarMensagemUnica(campanha.texto, negocio) : "";

/**
 * Confere um pedido de envio vindo da tela ou de um comando. Devolve { erro } ou
 * { pedido }, com { lista: {id, nome}, modo, tipo, texto, arquivo, comecaEm }.
 */
export function conferirPedido(bruto, listas, negocios, envios, agora = new Date()) {
  const lista = listas.find((l) => l.id === bruto?.lista);
  if (!lista) return { erro: "Escolha para qual lista enviar." };
  const tipo = bruto.tipo ?? "texto";
  if (!TIPOS[tipo]) return { erro: "Não conheço esse tipo de mensagem." };
  // Audio nao tem texto: so existe como a mesma mensagem para todos.
  const modo = tipo === "audio" ? "mesma" : bruto.modo === "mesma" ? "mesma" : "cada";

  let arquivo = null;
  if (tipo !== "texto") {
    const conferido = conferirArquivo(tipo, bruto.arquivo);
    if (conferido.erro) return conferido;
    arquivo = conferido.arquivo;
  }

  const pedido = { lista: { id: lista.id, nome: lista.nome }, modo, tipo, texto: null, arquivo, comecaEm: null };
  const fila = filaDaCampanha(negocios, envios, { ...pedido, id: null });

  if (modo === "mesma" && tipo !== "audio") {
    const texto = typeof bruto.texto === "string" ? bruto.texto.trim() : "";
    const exemplos = [...fila].sort((a, b) => (a.nome ?? "").length - (b.nome ?? "").length);
    for (const negocio of exemplos.length ? [exemplos[0], exemplos.at(-1)] : [{ nome: "" }]) {
      const problema = tipo === "texto" ? problemaDaMensagemUnica(texto, negocio) : texto ? problemaDaLegenda(texto, negocio) : null;
      if (problema) return { erro: problema };
    }
    pedido.texto = texto || null;
  }

  if (bruto.comecaEm) {
    const hora = new Date(bruto.comecaEm);
    if (Number.isNaN(hora.getTime())) return { erro: "Não entendi o dia e a hora do agendamento." };
    if (hora.getTime() < agora.getTime() - 60_000) return { erro: "A hora marcada já passou. Escolha outra, ou envie agora." };
    pedido.comecaEm = hora.toISOString();
  }
  return { pedido, fila };
}

/** Guarda um envio novo, como agendado. Quem comeca e o envio.mjs. Devolve a campanha. */
export function criarCampanha(pedido, total, agora = new Date()) {
  const campanhas = lerCampanhas();
  const campanha = {
    id: `c${randomBytes(4).toString("hex")}`,
    n: Math.max(0, ...campanhas.map((c) => c.n ?? 0)) + 1,
    criadaEm: agora.toISOString(),
    ...pedido,
    situacao: "agendado",
    motivo: null,
    total,
    enviadas: 0,
    semWhatsapp: 0,
    falhas: 0,
    comecouEm: null,
    terminouEm: null,
  };
  campanhas.push(campanha);
  gravarCampanhas(campanhas);
  return campanha;
}

/** Muda campos de um envio guardado. "mudanca" pode ser uma funcao, para somar contagens. */
export function atualizarCampanha(id, mudanca) {
  const campanhas = lerCampanhas();
  const campanha = campanhas.find((c) => c.id === id);
  if (!campanha) return null;
  Object.assign(campanha, typeof mudanca === "function" ? mudanca(campanha) : mudanca);
  gravarCampanhas(campanhas);
  return campanha;
}

export function apagarCampanha(id) {
  gravarCampanhas(lerCampanhas().filter((c) => c.id !== id));
}

/** Desiste de um envio que nao esta rodando. Devolve o problema, ou null. */
export function cancelarCampanha(id) {
  const campanha = lerCampanhas().find((c) => c.id === id);
  if (!campanha) return "Não achei esse envio.";
  if (campanha.situacao === "enviando") return "Esse envio está rodando. Pare ele primeiro.";
  if (campanha.situacao === "terminado" || campanha.situacao === "cancelado") return "Esse envio já acabou.";
  atualizarCampanha(id, { situacao: "cancelado", motivo: null, terminouEm: new Date().toISOString() });
  return null;
}
