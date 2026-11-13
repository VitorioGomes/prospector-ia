/**
 * Busca no Google Maps pelo google-maps-scraper (github.com/gosom/google-maps-scraper, MIT).
 *
 * Decisao do dono, 12/11/2026: e a unica fonte. A API oficial do Google saiu porque pedia
 * conta no Google Cloud, cartao e chave, que e onde o comprador trava.
 *
 * Usamos so o "modo rapido" do programa: ele pergunta direto ao Maps, sem abrir navegador,
 * e devolve ate 20 negocios por termo em cerca de um segundo. O modo normal (que rola a
 * tela num navegador) falhou em todos os testes de 12/11/2026 com "unexpected page type".
 *
 * O executavel tem 60 MB e nao vai no repositorio: e baixado na primeira busca, de uma
 * versao fixa, e conferido pela assinatura antes de rodar.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PASTA_DADOS } from "./arquivos.mjs";

export const VERSAO = "1.18.2";

/** Assinatura (SHA-256) de cada executavel da versao acima, conferida em 12/11/2026. */
const EXECUTAVEIS = {
  win32: { arquivo: `google_maps_scraper-${VERSAO}-windows-amd64.exe`, sha256: "6609e9638ee303b6d419a329f629efcd9ed5d083f86ad6b93f92a21d59c2aca5" },
  darwin: { arquivo: `google_maps_scraper-${VERSAO}-darwin-amd64`, sha256: "c166042f5bd00bc8ae48b9e05ab38dc029b55b8613c4d8ad2602b2f4e6b40ff4" },
  linux: { arquivo: `google_maps_scraper-${VERSAO}-linux-amd64`, sha256: "468eec927939b3bcbdd94c59d6d7eef7472b5365409d66545bbe78cc910b309f" },
};

const PASTA = path.join(PASTA_DADOS, "ferramentas");
const PASTA_TRABALHO = path.join(PASTA_DADOS, "busca");

/** Erro para a pessoa ler: a mensagem ja diz o que fazer. */
export class ErroDaBusca extends Error {}

const sha256 = (conteudo) => createHash("sha256").update(conteudo).digest("hex");

/** Garante o executavel na maquina e devolve o caminho dele. */
export async function garantirPrograma(avisar = () => {}) {
  const alvo = EXECUTAVEIS[process.platform];
  if (!alvo) throw new ErroDaBusca("A busca só funciona em Windows, Mac e Linux.");

  const caminho = path.join(PASTA, alvo.arquivo);
  if (existsSync(caminho)) return caminho;

  avisar("Baixando o programa de busca (60 MB, só na primeira vez)...");
  mkdirSync(PASTA, { recursive: true });
  const endereco = `https://github.com/gosom/google-maps-scraper/releases/download/v${VERSAO}/${alvo.arquivo}`;

  let conteudo;
  try {
    const resposta = await fetch(endereco, { signal: AbortSignal.timeout(10 * 60_000) });
    if (!resposta.ok) throw new Error(String(resposta.status));
    conteudo = Buffer.from(await resposta.arrayBuffer());
  } catch {
    throw new ErroDaBusca("Não consegui baixar o programa de busca. Confira a internet e tente de novo.");
  }

  if (sha256(conteudo) !== alvo.sha256) {
    throw new ErroDaBusca(
      "O programa de busca baixado não é o esperado, e por segurança não foi usado. Tente de novo; se repetir, avise o suporte.",
    );
  }

  const provisorio = `${caminho}.baixando`;
  writeFileSync(provisorio, conteudo);
  renameSync(provisorio, caminho);
  if (process.platform !== "win32") chmodSync(caminho, 0o755);
  return caminho;
}

/**
 * Roda uma busca rapida: varios termos, um ponto no mapa. Devolve os lugares crus.
 * raioM e zoom andam juntos: cidade e 10 km com zoom 13; regiao e 50 km com zoom 10.
 */
export function buscarRapido(programa, { consultas, lat, lon, raioM, zoom }) {
  mkdirSync(PASTA_TRABALHO, { recursive: true });
  const entrada = path.join(PASTA_TRABALHO, "consultas.txt");
  const saida = path.join(PASTA_TRABALHO, "resultado.json");
  writeFileSync(entrada, `${consultas.join("\n")}\n`, "utf8");
  rmSync(saida, { force: true });

  const argumentos = [
    "-input", entrada,
    "-results", saida,
    "-json",
    "-fast-mode",
    "-geo", `${lat},${lon}`,
    "-zoom", String(zoom),
    "-radius", String(raioM),
    "-lang", "pt",
    "-exit-on-inactivity", "1m",
  ];

  return new Promise((resolver, rejeitar) => {
    const processo = spawn(programa, argumentos, {
      cwd: PASTA_TRABALHO,
      // O programa manda estatistica de uso anonima por padrao. Desligado.
      env: { ...process.env, DISABLE_TELEMETRY: "1" },
      stdio: "ignore",
      windowsHide: true,
    });
    const relogio = setTimeout(() => processo.kill(), 3 * 60_000);

    processo.on("error", () => {
      clearTimeout(relogio);
      rejeitar(new ErroDaBusca("Não consegui abrir o programa de busca. Se o antivírus bloqueou, libere a pasta do projeto e tente de novo."));
    });
    processo.on("close", () => {
      clearTimeout(relogio);
      resolver(lerResultado(saida));
    });
  });
}

/** O arquivo traz uma linha por termo, e cada linha e uma lista de lugares (ou null). */
export function lerResultado(arquivo) {
  if (!existsSync(arquivo)) return [];
  const lugares = [];
  for (const linha of readFileSync(arquivo, "utf8").split(/\r?\n/)) {
    if (!linha.trim()) continue;
    let dado;
    try {
      dado = JSON.parse(linha);
    } catch {
      continue;
    }
    for (const lugar of Array.isArray(dado) ? dado : [dado]) {
      if (lugar && typeof lugar === "object" && lugar.title) lugares.push(lugar);
    }
  }
  return lugares;
}

/** O meio dos pontos encontrados. Mediana, para um resultado perdido longe nao puxar o centro. */
export function centroDosLugares(lugares) {
  const mediana = (valores) => {
    const ordenados = valores.filter((v) => Number.isFinite(v) && v !== 0).sort((a, b) => a - b);
    return ordenados.length ? ordenados[Math.floor(ordenados.length / 2)] : null;
  };
  const lat = mediana(lugares.map((l) => Number(l.latitude)));
  const lon = mediana(lugares.map((l) => Number(l.longtitude ?? l.longitude)));
  return lat === null || lon === null ? null : { lat, lon };
}

const semAcento = (texto) =>
  String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** "Sobral, CE" -> o lugar fica em Sobral? Endereco vazio passa: nao da para saber. */
export function ficaNaCidade(lugar, cidade) {
  const nome = semAcento(cidade.split(",")[0]).trim();
  const endereco = semAcento(lugar.address);
  return !endereco || !nome || endereco.includes(nome);
}

/**
 * Onde fica a cidade, pelo OpenStreetMap (gratuito, sem chave). Ele devolve o meio do
 * municipio, que pode estar a dezenas de km da area urbana: serve so de ponto de partida.
 */
export async function localizarCidade(cidade) {
  const endereco = new URL("https://nominatim.openstreetmap.org/search");
  endereco.searchParams.set("q", `${cidade}, Brasil`);
  endereco.searchParams.set("format", "jsonv2");
  endereco.searchParams.set("limit", "1");
  endereco.searchParams.set("countrycodes", "br");

  let achados;
  try {
    const resposta = await fetch(endereco, {
      headers: { "User-Agent": "prospeccao-skill/0.1" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!resposta.ok) throw new Error(String(resposta.status));
    achados = await resposta.json();
  } catch {
    throw new ErroDaBusca("Não consegui localizar a cidade no mapa. Confira a internet e tente de novo.");
  }
  if (!achados?.length) {
    throw new ErroDaBusca(`Não achei a cidade "${cidade}" no mapa. Escreva o nome completo e o estado, como "Sobral, CE".`);
  }
  return { lat: Number(achados[0].lat), lon: Number(achados[0].lon) };
}
