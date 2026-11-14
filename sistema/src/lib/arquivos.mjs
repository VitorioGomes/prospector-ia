import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** A pasta sistema/, onde quer que o comando tenha sido chamado. */
export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const PASTA_DADOS = path.join(RAIZ, "dados");
/** A tela (npm run tela) atende em http://localhost:3210. */
export const PORTA_DA_TELA = 3210;

export const caminhos = {
  perfil: path.join(RAIZ, "prospeccao", "perfil.json"),
  negocios: path.join(PASTA_DADOS, "negocios.json"),
  listas: path.join(PASTA_DADOS, "listas.json"),
  mensagens: path.join(PASTA_DADOS, "mensagens.json"),
  envios: path.join(PASTA_DADOS, "envios.json"),
  campanhas: path.join(PASTA_DADOS, "campanhas.json"),
  arquivos: path.join(PASTA_DADOS, "arquivos"),
  sessao: path.join(PASTA_DADOS, "whatsapp"),
};

export function lerJson(arquivo, padrao) {
  if (!existsSync(arquivo)) return padrao;
  // O BOM aparece quando o arquivo foi gravado pelo PowerShell ou pelo Bloco de Notas.
  const texto = readFileSync(arquivo, "utf8").replace(/^﻿/, "");
  try {
    return JSON.parse(texto);
  } catch {
    falhar(
      `O arquivo ${path.relative(RAIZ, arquivo)} está com o formato quebrado e não consegui ler.\n` +
        "Peça à IA para abrir esse arquivo e corrigir o JSON.",
    );
  }
}

/** Grava num arquivo ao lado e troca: queda de energia no meio nao deixa a lista pela metade. */
export function gravarJson(arquivo, valor) {
  mkdirSync(path.dirname(arquivo), { recursive: true });
  const provisorio = `${arquivo}.tmp`;
  writeFileSync(provisorio, JSON.stringify(valor, null, 2), "utf8");
  renameSync(provisorio, arquivo);
}

export function lerNegocios() {
  return lerJson(caminhos.negocios, { negocios: [] }).negocios ?? [];
}

export function gravarNegocios(negocios) {
  gravarJson(caminhos.negocios, { negocios });
}

export function lerPerfil() {
  return lerJson(caminhos.perfil, null);
}

/** Erro que a pessoa precisa ler: diz o que fazer e sai, sem pilha de codigo. */
export function falhar(mensagem) {
  console.error(`\n${mensagem}\n`);
  process.exit(1);
}
