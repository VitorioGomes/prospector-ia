/**
 * O envio pelo sistema: manda as mensagens prontas, uma a uma, pelo chip da prospeccao.
 * Roda dentro da tela (src/servidor.mjs), que mostra o andamento e tem o botao de parar.
 *
 * A lista e relida do arquivo a cada mensagem: enquanto o envio roda, a pessoa pode
 * descartar um negocio na tela e a IA pode guardar mensagens novas pela conversa.
 */
import { caminhos, gravarJson, gravarNegocios, lerNegocios, lerPerfil } from "./arquivos.mjs";
import { lerEnvios } from "./lista.mjs";
import { lerListas } from "./listas.mjs";
import { MAX_FALHAS_SEGUIDAS, enviadosHoje, limiteDoDia, montarFila, sortearPausaMs } from "./regras.mjs";
import { normalizar } from "./telefone.mjs";
import { acharNoWhatsapp, socketAtual } from "./whatsapp.mjs";

const estado = {
  rodando: false,
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

/** "Digitando" por alguns segundos antes de mandar, como uma pessoa faria. */
async function enviarComoGente(socket, destino, texto) {
  try {
    await socket.presenceSubscribe(destino);
    await socket.sendPresenceUpdate("composing", destino);
    await dormir(3000 + Math.random() * 4000);
    await socket.sendPresenceUpdate("paused", destino);
  } catch {
    /* nao mostrar "digitando" nunca pode impedir o envio */
  }
  await socket.sendMessage(destino, { text: texto });
}

const enviadasPeloSistemaHoje = (envios) => enviadosHoje(envios.filter((e) => !e.porMao));

/** Grava o resultado relendo a lista: ela pode ter mudado enquanto a mensagem saia. */
function registrar(id, resultado, erro) {
  const negocios = lerNegocios();
  const negocio = negocios.find((o) => o.id === id);
  if (!negocio) return;

  if (resultado === "enviado") {
    const envios = lerEnvios();
    const agora = new Date().toISOString();
    negocio.situacao = "enviado";
    negocio.enviadoEm = agora;
    negocio.enviadoPor = "sistema";
    delete negocio.erro;
    envios.push({ telefone: negocio.telefone, n: negocio.n, em: agora });
    gravarJson(caminhos.envios, envios);
  } else if (resultado === "sem_whatsapp") {
    negocio.situacao = "sem_whatsapp";
  } else {
    negocio.situacao = "falhou";
    negocio.erro = erro;
  }
  gravarNegocios(negocios);
}

/** Comeca o envio para os leads de uma lista. Devolve o motivo de nao ter comecado, ou null. */
export function comecar(listaId) {
  if (estado.rodando) return "O envio já está rodando.";
  const lista = lerListas().find((l) => l.id === listaId);
  if (!lista) return "Escolha para qual lista enviar.";
  if (!socketAtual()) return "Conecte o número da prospecção antes de enviar.";

  const envios = lerEnvios();
  if (montarFila(lerNegocios(), envios, lista.id).length === 0) {
    return "Essa lista não tem mensagem pronta para enviar.";
  }
  const limite = limiteDoDia(lerPerfil());
  const hoje = enviadasPeloSistemaHoje(envios);
  if (hoje >= limite) {
    return `O limite de hoje já foi usado (${hoje} de ${limite}). Aumente o número de mensagens por dia, ou envie amanhã.`;
  }

  Object.assign(estado, {
    rodando: true,
    lista: { id: lista.id, nome: lista.nome },
    enviadas: 0,
    semWhatsapp: 0,
    falhas: 0,
    atual: null,
    proximaEm: null,
    motivo: null,
    terminouEm: null,
  });
  pararPedido = false;
  void rodar();
  return null;
}

export function parar() {
  if (!estado.rodando) return;
  pararPedido = true;
  acordar?.();
}

async function rodar() {
  let motivo = null;
  let falhasSeguidas = 0;
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
      const negocio = montarFila(lerNegocios(), envios, estado.lista.id)[0];
      if (!negocio) break;

      estado.atual = { n: negocio.n, nome: negocio.nome };
      estado.proximaEm = null;

      let resultado;
      let erro;
      try {
        const destino = await acharNoWhatsapp(socket, negocio.telefone);
        if (destino) {
          await enviarComoGente(socket, destino, negocio.mensagem);
          resultado = "enviado";
        } else {
          resultado = "sem_whatsapp";
        }
      } catch (falha) {
        resultado = "falhou";
        erro = String(falha?.message ?? falha).slice(0, 200);
      }
      // Grava a cada mensagem: se a tela fechar no meio, nada e mandado duas vezes.
      registrar(negocio.id, resultado, erro);
      estado.atual = null;

      if (resultado === "sem_whatsapp") {
        estado.semWhatsapp += 1;
        await esperar(2000);
        continue;
      }
      if (resultado === "enviado") {
        estado.enviadas += 1;
        falhasSeguidas = 0;
      } else {
        estado.falhas += 1;
        falhasSeguidas += 1;
        if (falhasSeguidas >= MAX_FALHAS_SEGUIDAS) {
          motivo = `${MAX_FALHAS_SEGUIDAS} envios falharam em seguida`;
          break;
        }
      }

      // So faz a pausa se ainda ha o que mandar.
      const depois = lerEnvios();
      const temMais = montarFila(lerNegocios(), depois, estado.lista.id).length > 0 && enviadasPeloSistemaHoje(depois) < limiteDoDia(lerPerfil());
      if (!temMais || pararPedido) continue;
      const pausa = sortearPausaMs(lerPerfil());
      estado.proximaEm = new Date(Date.now() + pausa).toISOString();
      await esperar(pausa);
    }
  } catch (falha) {
    motivo = `deu um erro que eu não esperava: ${String(falha?.message ?? falha).slice(0, 200)}`;
  } finally {
    estado.rodando = false;
    estado.atual = null;
    estado.proximaEm = null;
    estado.motivo = motivo;
    estado.terminouEm = new Date().toISOString();
  }
}

/**
 * Manda a primeira mensagem da fila da lista para o numero da propria pessoa, para ela ver
 * como chega. Nada e registrado, e o negocio nao recebe. Devolve { erro } ou { negocio }.
 */
export async function enviarTeste(numeroDigitado, listaId = null) {
  const numero = normalizar(numeroDigitado);
  if (!numero) return { erro: "Digite o seu número com DDD, como 88 99999-0000." };
  const socket = socketAtual();
  if (!socket) return { erro: "Conecte o número da prospecção antes de mandar o teste." };

  const negocios = lerNegocios();
  const daLista = listaId ? negocios.filter((o) => o.lista === listaId) : negocios;
  const negocio = montarFila(negocios, lerEnvios(), listaId)[0] ?? daLista.find((o) => o.mensagem);
  if (!negocio) return { erro: "Essa lista ainda não tem nenhuma mensagem escrita para mandar de teste." };

  try {
    const destino = await acharNoWhatsapp(socket, numero);
    if (!destino) return { erro: "Esse número não tem WhatsApp. Confira o número." };
    await enviarComoGente(socket, destino, negocio.mensagem);
  } catch {
    return { erro: "Não consegui mandar o teste. Confira a conexão e tente de novo." };
  }
  return { negocio: { n: negocio.n, nome: negocio.nome } };
}
