/**
 * O envio pelo sistema: manda as mensagens de um envio guardado (uma "campanha", ver
 * campanhas.mjs), uma a uma, pelo numero conectado. Roda dentro da tela (src/servidor.mjs),
 * que mostra o andamento e tem o botao de parar. Um envio roda por vez.
 *
 * A lista e relida do arquivo a cada mensagem: enquanto o envio roda, a pessoa pode
 * descartar um negocio na tela e a IA pode guardar mensagens novas pela conversa.
 */
import { existsSync } from "node:fs";
import { caminhos, gravarJson, gravarNegocios, lerNegocios, lerPerfil } from "./arquivos.mjs";
import {
  ATRASO_MAXIMO_MS,
  apagarCampanha,
  atualizarCampanha,
  caminhoDoArquivo,
  conferirPedido,
  criarCampanha,
  filaDaCampanha,
  lerCampanhas,
  textoPara,
} from "./campanhas.mjs";
import { lerEnvios } from "./lista.mjs";
import { lerListas } from "./listas.mjs";
import { MAX_FALHAS_SEGUIDAS, enviadosHoje, limiteDoDia, sortearPausaMs } from "./regras.mjs";
import { normalizar } from "./telefone.mjs";
import { acharNoWhatsapp, socketAtual } from "./whatsapp.mjs";

const estado = {
  rodando: false,
  /** id do envio (campanha) que esta rodando, ou do ultimo que rodou */
  campanha: null,
  /** { id, nome } da lista que esta recebendo */
  lista: null,
  enviadas: 0,
  semWhatsapp: 0,
  falhas: 0,
  /** { n, nome } do negocio que esta recebendo agora */
  atual: null,
  /** quando sai a proxima mensagem (ISO), durante a pausa */
  proximaEm: null,
  /** por que parou, quando nao foi por ter acabado a fila */
  motivo: null,
  terminouEm: null,
};
let pararPedido = false;
let acordar = null;

export function situacaoDoEnvio() {
  return { ...estado };
}

/** Espera que o botao de parar consegue interromper. */
function esperar(ms) {
  return new Promise((resolver) => {
    const fim = () => {
      clearTimeout(relogio);
      acordar = null;
      resolver();
    };
    const relogio = setTimeout(fim, ms);
    acordar = fim;
  });
}

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** O que o Baileys recebe para cada tipo de mensagem. */
function montarEnvio({ tipo, texto, arquivo }) {
  if (tipo === "texto") return { text: texto };
  const origem = { url: caminhoDoArquivo(arquivo) };
  const legenda = texto ? { caption: texto } : {};
  if (tipo === "imagem") return { image: origem, ...legenda };
  if (tipo === "video") return { video: origem, ...legenda };
  // So o .ogg (opus) toca como audio gravado na hora; os outros vao como arquivo de audio.
  if (tipo === "audio") return { audio: origem, mimetype: arquivo.mime, ptt: arquivo.mime.startsWith("audio/ogg") };
  return { document: origem, mimetype: arquivo.mime, fileName: arquivo.nome, ...legenda };
}

/** "Digitando" (ou "gravando") por alguns segundos antes de mandar, como uma pessoa faria. */
async function enviarComoGente(socket, destino, conteudo) {
  try {
    await socket.presenceSubscribe(destino);
    await socket.sendPresenceUpdate(conteudo.tipo === "audio" ? "recording" : "composing", destino);
    await dormir(3000 + Math.random() * 4000);
    await socket.sendPresenceUpdate("paused", destino);
  } catch {
    /* nao mostrar "digitando" nunca pode impedir o envio */
  }
  await socket.sendMessage(destino, montarEnvio(conteudo));
}

const enviadasPeloSistemaHoje = (envios) => enviadosHoje(envios.filter((e) => !e.porMao));

/** Grava o resultado relendo a lista: ela pode ter mudado enquanto a mensagem saia. */
function registrar(id, resultado, erro, campanha, texto) {
  const negocios = lerNegocios();
  const negocio = negocios.find((o) => o.id === id);
  if (!negocio) return;
  const agora = new Date().toISOString();
  negocio.campanha = campanha.id;

  if (resultado === "enviado") {
    const envios = lerEnvios();
    negocio.situacao = "enviado";
    negocio.enviadoEm = agora;
    negocio.enviadoPor = "sistema";
    // Na mensagem igual para todos, o texto so existe agora: fica no lead, para o historico.
    negocio.mensagem = texto;
    delete negocio.erro;
    envios.push({ telefone: negocio.telefone, n: negocio.n, em: agora });
    gravarJson(caminhos.envios, envios);
  } else if (resultado === "sem_whatsapp") {
    negocio.situacao = "sem_whatsapp";
    negocio.tentadoEm = agora;
  } else {
    negocio.situacao = "falhou";
    negocio.erro = erro;
    // O historico mostra tambem o que nao saiu, na hora em que foi tentado.
    negocio.tentadoEm = agora;
  }
  gravarNegocios(negocios);
}

/**
 * Comeca (ou continua) um envio guardado. Devolve o motivo de nao ter comecado, ou null.
 */
export function comecar(campanhaId) {
  if (estado.rodando) return "Já há um envio rodando. Espere ele terminar, ou pare ele.";
  const campanha = lerCampanhas().find((c) => c.id === campanhaId);
  if (!campanha) return "Não achei esse envio.";
  if (campanha.situacao === "terminado" || campanha.situacao === "cancelado") return "Esse envio já acabou.";
  if (campanha.arquivo && !existsSync(caminhoDoArquivo(campanha.arquivo))) {
    return "Não achei mais o arquivo deste envio. Crie o envio de novo, escolhendo o arquivo.";
  }

  const envios = lerEnvios();
  if (filaDaCampanha(lerNegocios(), envios, campanha).length === 0) {
    atualizarCampanha(campanha.id, { situacao: "terminado", motivo: null, terminouEm: new Date().toISOString() });
    return "Esse envio não tem mais ninguém para receber.";
  }
  if (!socketAtual()) return "Conecte o número antes de enviar.";
  const limite = limiteDoDia(lerPerfil());
  const hoje = enviadasPeloSistemaHoje(envios);
  if (hoje >= limite) {
    return `O limite de hoje já foi usado (${hoje} de ${limite}). Aumente o número de mensagens por dia, ou envie amanhã.`;
  }

  Object.assign(estado, {
    rodando: true,
    campanha: campanha.id,
    lista: { ...campanha.lista },
    enviadas: 0,
    semWhatsapp: 0,
    falhas: 0,
    atual: null,
    proximaEm: null,
    motivo: null,
    terminouEm: null,
  });
  pararPedido = false;
  atualizarCampanha(campanha.id, { situacao: "enviando", motivo: null, comecouEm: campanha.comecouEm ?? new Date().toISOString(), terminouEm: null });
  void rodar(campanha);
  return null;
}

/**
 * Guarda um envio novo e, se nao for agendado, ja comeca. Devolve { erro } ou { campanha }.
 * O que nao consegue comecar agora nao fica guardado: a pessoa corrige e tenta de novo.
 */
export function criarEnvio(bruto) {
  const { erro, pedido, fila } = conferirPedido(bruto, lerListas(), lerNegocios(), lerEnvios());
  if (erro) return { erro };
  if (fila.length === 0) {
    return {
      erro:
        pedido.modo === "cada"
          ? "Nenhum lead desta lista tem mensagem pronta. Peça à IA para escrever, ou use a mesma mensagem para todos."
          : "Todos os leads desta lista já receberam, ou não têm telefone.",
    };
  }
  const campanha = criarCampanha(pedido, fila.length);
  if (pedido.comecaEm) return { campanha };
  const problema = comecar(campanha.id);
  if (problema) {
    apagarCampanha(campanha.id);
    return { erro: problema };
  }
  return { campanha };
}

/**
 * Ao ligar a tela: envio que ficou como "enviando" foi interrompido (a tela fechou ou o
 * computador desligou no meio). Vira "parado", para a pessoa poder continuar com um clique.
 * O que ja saiu esta registrado mensagem a mensagem, entao nada e mandado duas vezes.
 */
export function retomarInterrompidos() {
  if (estado.rodando) return;
  for (const campanha of lerCampanhas()) {
    if (campanha.situacao === "enviando") atualizarCampanha(campanha.id, { situacao: "pausado", motivo: "a tela foi fechada no meio do envio" });
  }
}

export function parar() {
  if (!estado.rodando) return;
  pararPedido = true;
  acordar?.();
}

/**
 * Chamado de tempos em tempos pela tela: comeca o envio agendado cuja hora chegou.
 * Se ainda nao da (numero desconectado, limite do dia usado), ele segue agendado e a tela
 * mostra o que esta faltando. Agendado que passou muito da hora nao sai sozinho.
 */
export function verAgendados(agora = new Date()) {
  if (estado.rodando) return;
  const devido = lerCampanhas()
    .filter((c) => c.situacao === "agendado" && c.comecaEm && new Date(c.comecaEm) <= agora)
    .sort((a, b) => a.comecaEm.localeCompare(b.comecaEm))[0];
  if (!devido) return;
  if (agora - new Date(devido.comecaEm) > ATRASO_MAXIMO_MS) {
    const motivo = devido.espera ? "não deu para começar na hora marcada" : "a tela estava fechada na hora marcada";
    atualizarCampanha(devido.id, { situacao: "pausado", motivo });
    return;
  }
  const problema = comecar(devido.id);
  // "espera" e o que falta para um agendado comecar. So grava quando muda.
  if (problema && lerCampanhas().find((c) => c.id === devido.id)?.situacao === "agendado" && problema !== devido.espera) {
    atualizarCampanha(devido.id, { espera: problema });
  }
}

async function rodar(campanha) {
  let motivo = null;
  let falhasSeguidas = 0;
  const somar = (campo) => atualizarCampanha(campanha.id, (c) => ({ [campo]: (c[campo] ?? 0) + 1 }));
  try {
    for (;;) {
      if (pararPedido) {
        motivo = "você parou o envio";
        break;
      }
      const socket = socketAtual();
      if (!socket) {
        motivo = "a conexão com o WhatsApp caiu";
        break;
      }
      const envios = lerEnvios();
      const perfil = lerPerfil();
      if (enviadasPeloSistemaHoje(envios) >= limiteDoDia(perfil)) {
        motivo = "o limite de hoje foi atingido";
        break;
      }
      const negocio = filaDaCampanha(lerNegocios(), envios, campanha)[0];
      if (!negocio) break;

      estado.atual = { n: negocio.n, nome: negocio.nome };
      estado.proximaEm = null;
      const texto = textoPara(campanha, negocio);
      let resultado;
      let erro;
      try {
        const destino = await acharNoWhatsapp(socket, negocio.telefone);
        if (destino) {
          await enviarComoGente(socket, destino, { tipo: campanha.tipo, texto, arquivo: campanha.arquivo });
          resultado = "enviado";
        } else {
          resultado = "sem_whatsapp";
        }
      } catch (falha) {
        resultado = "falhou";
        erro = String(falha?.message ?? falha).slice(0, 200);
      }
      // Grava a cada mensagem: se a tela fechar no meio, nada e mandado duas vezes.
      registrar(negocio.id, resultado, erro, campanha, texto);
      estado.atual = null;

      if (resultado === "sem_whatsapp") {
        estado.semWhatsapp += 1;
        somar("semWhatsapp");
        await esperar(2000);
        continue;
      }
      if (resultado === "enviado") {
        estado.enviadas += 1;
        somar("enviadas");
        falhasSeguidas = 0;
      } else {
        estado.falhas += 1;
        somar("falhas");
        falhasSeguidas += 1;
        if (falhasSeguidas >= MAX_FALHAS_SEGUIDAS) {
          motivo = `${MAX_FALHAS_SEGUIDAS} envios falharam em seguida`;
          break;
        }
      }

      // So faz a pausa se ainda ha o que mandar.
      const depois = lerEnvios();
      const temMais = filaDaCampanha(lerNegocios(), depois, campanha).length > 0 && enviadasPeloSistemaHoje(depois) < limiteDoDia(lerPerfil());
      if (!temMais || pararPedido) continue;
      const pausa = sortearPausaMs(lerPerfil());
      estado.proximaEm = new Date(Date.now() + pausa).toISOString();
      await esperar(pausa);
    }
  } catch (falha) {
    motivo = `deu um erro que eu não esperava: ${String(falha?.message ?? falha).slice(0, 200)}`;
  } finally {
    const agora = new Date().toISOString();
    estado.rodando = false;
    estado.atual = null;
    estado.proximaEm = null;
    estado.motivo = motivo;
    estado.terminouEm = agora;
    // Com motivo, o envio parou no meio e pode continuar depois. Sem motivo, a fila acabou.
    try {
      atualizarCampanha(campanha.id, motivo ? { situacao: "pausado", motivo } : { situacao: "terminado", motivo: null, terminouEm: agora });
    } catch {
      /* nao conseguir gravar o fim nao pode deixar o envio preso como "rodando" */
    }
  }
}

/**
 * Manda para o numero da propria pessoa a mensagem que o primeiro lead receberia, para ela
 * ver como chega. Nada e registrado, e o negocio nao recebe. Devolve { erro } ou { negocio }.
 */
export async function enviarTeste(numeroDigitado, bruto) {
  const numero = normalizar(numeroDigitado);
  if (!numero) return { erro: "Digite o seu número com DDD, como 88 99999-0000." };
  const socket = socketAtual();
  if (!socket) return { erro: "Conecte o número antes de mandar o teste." };

  const negocios = lerNegocios();
  const { erro, pedido, fila } = conferirPedido({ ...bruto, comecaEm: null }, lerListas(), negocios, lerEnvios());
  if (erro) return { erro };
  // Lista em que todos ja receberam ainda serve para o teste: vai a mensagem de um deles.
  const daLista = negocios.filter((o) => o.lista === pedido.lista.id);
  const negocio = fila[0] ?? (pedido.modo === "cada" ? daLista.find((o) => o.mensagem) : daLista[0]);
  if (!negocio) {
    return { erro: pedido.modo === "cada" ? "Essa lista ainda não tem nenhuma mensagem escrita para mandar de teste." : "Essa lista não tem nenhum lead." };
  }

  try {
    const destino = await acharNoWhatsapp(socket, numero);
    if (!destino) return { erro: "Esse número não tem WhatsApp. Confira o número." };
    await enviarComoGente(socket, destino, { tipo: pedido.tipo, texto: textoPara(pedido, negocio), arquivo: pedido.arquivo });
  } catch {
    return { erro: "Não consegui mandar o teste. Confira a conexão e tente de novo." };
  }
  return { negocio: { n: negocio.n, nome: negocio.nome } };
}
