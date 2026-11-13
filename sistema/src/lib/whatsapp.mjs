/**
 * Conexao com o WhatsApp para a prospeccao, pelo Baileys.
 *
 * E uma conexao propria, em pasta propria (dados/whatsapp), de proposito: a prospeccao sai
 * de um chip so dela. Se saisse do chip do atendimento, um banimento derrubaria o numero
 * em que o negocio atende os clientes.
 *
 * Quem usa e a tela (src/servidor.mjs), que fica aberta: por isso a conexao e uma so, de
 * vida longa, e se religa sozinha quando cai.
 */
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import makeWASocket, { Browsers, DisconnectReason, fetchLatestBaileysVersion, useMultiFileAuthState } from "baileys";
import pino from "pino";
import QRCode from "qrcode";
import { caminhos } from "./arquivos.mjs";
import { variantes } from "./telefone.mjs";

const MAX_TENTATIVAS = 5;

/**
 * fase: "desligado" | "ligando" | "qr" | "conectado"
 * qr: a imagem do QR Code (data URL), so na fase "qr"
 * aviso: por que desligou, para a pessoa ler
 */
const estado = { fase: "desligado", qr: null, numero: "", aviso: "" };
let socket = null;
let tentativas = 0;
/** Cada tentativa tem um numero. Evento de tentativa antiga e ignorado. */
let geracao = 0;

/** Ja leu o QR Code alguma vez? O arquivo existe desde a primeira tentativa; o "me" so depois de parear. */
export function sessaoExiste() {
  const arquivo = path.join(caminhos.sessao, "creds.json");
  if (!existsSync(arquivo)) return false;
  try {
    return Boolean(JSON.parse(readFileSync(arquivo, "utf8")).me);
  } catch {
    return false;
  }
}

export async function apagarSessao() {
  await rm(caminhos.sessao, { recursive: true, force: true });
}

export function situacaoDaConexao() {
  return { ...estado };
}

/** O socket, so quando da para enviar por ele. */
export function socketAtual() {
  return estado.fase === "conectado" ? socket : null;
}

function encerrar(s) {
  try {
    s?.end(undefined);
  } catch {
    /* ja estava fechado */
  }
}

function desligar(aviso) {
  geracao += 1;
  encerrar(socket);
  socket = null;
  estado.fase = "desligado";
  estado.qr = null;
  estado.numero = "";
  estado.aviso = aviso;
}

/** Comeca a conectar. Sem sessao, o WhatsApp devolve um QR Code, que aparece em situacaoDaConexao(). */
export function ligar() {
  if (estado.fase !== "desligado") return;
  estado.fase = "ligando";
  estado.aviso = "";
  tentativas = 0;
  void tentar();
}

async function tentar() {
  const minha = ++geracao;
  try {
    await mkdir(caminhos.sessao, { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(caminhos.sessao);

    let version;
    try {
      ({ version } = await fetchLatestBaileysVersion());
    } catch {
      /* sem internet para consultar: o Baileys usa a versao do pacote */
    }
    if (minha !== geracao) return;

    const s = makeWASocket({
      auth: state,
      version,
      logger: pino({ level: "silent" }),
      // Nome que aparece em "Aparelhos conectados" no celular.
      browser: Browsers.ubuntu("Prospeccao"),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      shouldIgnoreJid: (jid) => jid.endsWith("@g.us") || jid === "status@broadcast",
    });
    socket = s;

    s.ev.on("creds.update", () => void saveCreds());

    s.ev.on("connection.update", (u) => {
      if (minha !== geracao) return;

      if (u.qr) {
        estado.fase = "qr";
        QRCode.toDataURL(u.qr, { margin: 1, width: 300 }).then((png) => {
          if (minha === geracao && estado.fase === "qr") estado.qr = png;
        });
      }

      if (u.connection === "open") {
        estado.fase = "conectado";
        estado.qr = null;
        estado.numero = (s.user?.id ?? "").split(":")[0].split("@")[0];
        tentativas = 0;
        return;
      }

      if (u.connection === "close") {
        const motivo = u.lastDisconnect?.error?.output?.statusCode;
        const estavaNoQr = estado.fase === "qr";

        if (motivo === DisconnectReason.loggedOut || motivo === DisconnectReason.forbidden) {
          desligar("O WhatsApp foi desconectado pelo celular. Conecte o número de novo.");
          void apagarSessao();
          return;
        }
        if (motivo === DisconnectReason.connectionReplaced) {
          desligar("Outro programa está usando esta mesma conexão do WhatsApp. Feche o outro e conecte de novo.");
          return;
        }
        // 515 faz parte do pareamento: o WhatsApp manda reiniciar logo depois do QR Code.
        if (motivo === DisconnectReason.restartRequired) {
          encerrar(s);
          estado.fase = "ligando";
          estado.qr = null;
          setTimeout(() => minha === geracao && void tentar(), 300);
          return;
        }
        if (estavaNoQr) {
          desligar("O QR Code venceu sem ser lido. Clique em conectar de novo com o celular na mão.");
          void apagarSessao();
          return;
        }
        tentativas += 1;
        if (tentativas > MAX_TENTATIVAS) {
          desligar("Não consegui conectar ao WhatsApp. Confira a internet e conecte de novo.");
          return;
        }
        encerrar(s);
        estado.fase = "ligando";
        setTimeout(() => minha === geracao && void tentar(), 4000);
      }
    });
  } catch (erro) {
    if (minha !== geracao) return;
    desligar(`Não consegui conectar ao WhatsApp. ${erro?.message ?? ""}`.trim());
  }
}

/** Desconecta o numero de vez: sai do "Aparelhos conectados" e apaga a sessao daqui. */
export async function sair() {
  const s = socket;
  if (s && estado.fase === "conectado") await s.logout().catch(() => {});
  desligar("");
  await apagarSessao();
}

/** Fecha a conexao sem desconectar o numero: e o que acontece quando a tela e fechada. */
export function soltar() {
  desligar("");
}

/** O endereco do numero no WhatsApp, com ou sem o 9, ou null quando ele nao tem WhatsApp. */
export async function acharNoWhatsapp(s, numero) {
  const achados = await s.onWhatsApp(...variantes(numero));
  return achados?.find((a) => a.exists)?.jid ?? null;
}
