/**
 * Como os comandos falam com a tela (src/servidor.mjs).
 *
 * A conexao com o WhatsApp e o envio vivem dentro do servidor da tela, um so, porque dois
 * processos com a mesma sessao derrubam um ao outro. Por isso os comandos conectar e enviar
 * nao fazem nada sozinhos: ligam o servidor, se preciso, e pedem a ele. Assim a IA faz
 * tudo pela conversa, e a pessoa so olha a tela se quiser.
 */
import { exec, spawn } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PASTA_DADOS, PORTA_DA_TELA, RAIZ } from "./arquivos.mjs";

export const ENDERECO = `http://localhost:${PORTA_DA_TELA}`;

/** Erro para a pessoa ler: a mensagem ja diz o que fazer. */
export class ErroDaTela extends Error {}

/**
 * Pede algo ao servidor. Devolve { codigo, corpo }, "outro" se quem respondeu nao foi a
 * tela, ou null se ninguem respondeu. Usa node:http, e nao fetch: no Windows, sair logo
 * depois de um fetch derruba o Node.
 */
export function pedir(caminho, corpo) {
  const metodo = corpo === undefined ? "GET" : "POST";
  return new Promise((resolver) => {
    const pedido = http.request(
      { host: "127.0.0.1", port: PORTA_DA_TELA, path: caminho, method: metodo, agent: false, timeout: 60_000,
        headers: { Host: `localhost:${PORTA_DA_TELA}`, "Content-Type": "application/json" } },
      (resposta) => {
        let texto = "";
        resposta.setEncoding("utf8");
        resposta.on("data", (parte) => (texto += parte));
        resposta.on("end", () => {
          try {
            resolver({ codigo: resposta.statusCode, corpo: JSON.parse(texto) });
          } catch {
            resolver("outro");
          }
        });
      },
    );
    pedido.on("timeout", () => pedido.destroy());
    pedido.on("error", () => resolver(null));
    pedido.end(metodo === "POST" ? JSON.stringify(corpo) : undefined);
  });
}

/** Faz um pedido que tem de dar certo. Devolve o corpo, ou lanca ErroDaTela com o motivo. */
export async function mandar(caminho, corpo = {}) {
  const resposta = await pedir(caminho, corpo);
  if (!resposta || resposta === "outro") throw new ErroDaTela("A tela não respondeu. Rode npm run tela e tente de novo.");
  if (resposta.codigo !== 200) throw new ErroDaTela(resposta.corpo?.erro ?? "Não deu certo.");
  return resposta.corpo;
}

export async function ler(caminho) {
  const resposta = await pedir(caminho);
  if (!resposta || resposta === "outro" || resposta.codigo !== 200) {
    throw new ErroDaTela("A tela não respondeu. Rode npm run tela e tente de novo.");
  }
  return resposta.corpo;
}

export async function situacaoDaTela() {
  const resposta = await pedir("/api/ping");
  if (resposta === null) return "desligada";
  return resposta !== "outro" && resposta.corpo?.prospeccao === true ? "ligada" : "porta ocupada";
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const PORTA_OCUPADA = `Não consegui ligar a tela: a porta ${PORTA_DA_TELA} está sendo usada por outro programa. Feche o outro programa e tente de novo.`;

/** Liga o servidor da tela, solto do terminal, se ainda nao estiver ligado. Nao abre o navegador. */
export async function garantirTela() {
  let agora = await situacaoDaTela();
  if (agora === "ligada") return;
  if (agora === "porta ocupada") throw new ErroDaTela(PORTA_OCUPADA);

  mkdirSync(PASTA_DADOS, { recursive: true });
  const registro = openSync(path.join(PASTA_DADOS, "tela.log"), "a");
  const servidor = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "servidor.mjs");
  spawn(process.execPath, [servidor], { cwd: RAIZ, detached: true, stdio: ["ignore", registro, registro], windowsHide: true }).unref();

  for (let i = 0; i < 40 && agora !== "ligada"; i++) {
    await esperar(500);
    agora = await situacaoDaTela();
  }
  if (agora === "porta ocupada") throw new ErroDaTela(PORTA_OCUPADA);
  if (agora !== "ligada") {
    throw new ErroDaTela("A tela não ligou. O motivo está em dados/tela.log: leia as últimas linhas desse arquivo.");
  }
}

export function abrirNoNavegador(parte = "") {
  const endereco = `${ENDERECO}/${parte}`;
  const comando =
    process.platform === "win32" ? `start "" "${endereco}"` : process.platform === "darwin" ? `open "${endereco}"` : `xdg-open "${endereco}"`;
  exec(comando, () => {});
}

/** Roda o comando e mostra o erro como a pessoa le, sem pilha de codigo. */
export async function rodar(principal) {
  try {
    const texto = await principal();
    if (texto) console.log(`\n${texto}\n`);
  } catch (erro) {
    if (!(erro instanceof ErroDaTela)) throw erro;
    console.error(`\n${erro.message}\n`);
    process.exitCode = 1;
  }
}
