/**
 * A tela da prospeccao: uma pagina em localhost com a lista, a conexao do numero e o
 * envio. Quem abre e fecha e o src/tela.mjs (npm run tela).
 *
 * So atende a propria maquina. A lista e lida do arquivo a cada pedido, porque a IA
 * continua buscando e guardando mensagens pela conversa enquanto a tela esta aberta.
 */
import { readFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { PORTA_DA_TELA, RAIZ, caminhos, gravarJson, lerPerfil } from "./lib/arquivos.mjs";
import { comecarBusca, situacaoDaBusca } from "./lib/busca.mjs";
import { TIPOS, cancelarCampanha, guardarArquivo, lerCampanhas } from "./lib/campanhas.mjs";
import { comecar, criarEnvio, enviarTeste, parar, retomarInterrompidos, situacaoDoEnvio, verAgendados } from "./lib/envio.mjs";
import { acaoExiste, aplicar, aplicarMensagem, lerEnvios } from "./lib/lista.mjs";
import { apagarLista, criarLista, lerTudo, moverLeads, renomearLista } from "./lib/listas.mjs";
import { NOMES_DA_SITUACAO, enviadosHoje, intervaloMaximoMs, intervaloMs, limiteDoDia, montarFila } from "./lib/regras.mjs";
import { ligar, sair, sessaoExiste, situacaoDaConexao, soltar } from "./lib/whatsapp.mjs";

const PAGINA = path.join(RAIZ, "tela", "index.html");
const FONTE = path.join(RAIZ, "tela", "fonte.woff2");
const ENDERECOS = [`localhost:${PORTA_DA_TELA}`, `127.0.0.1:${PORTA_DA_TELA}`];
const MAX_CORPO = 100_000;
/** O maior arquivo que um envio leva (documento). O limite de cada tipo esta em campanhas.mjs. */
const MAX_ARQUIVO = Math.max(...Object.values(TIPOS).map((t) => t.maximoMb ?? 0)) * 1024 * 1024;

function estadoCompleto() {
  const { listas, negocios } = lerTudo();
  const envios = lerEnvios();
  const perfil = lerPerfil();
  return {
    negocios,
    listas,
    /** Quantas mensagens prontas cada lista tem para sair. */
    filaPorLista: Object.fromEntries(listas.map((l) => [l.id, montarFila(negocios, envios, l.id).length])),
    nomes: NOMES_DA_SITUACAO,
    conexao: situacaoDaConexao(),
    envio: situacaoDoEnvio(),
    /** Os envios guardados, do mais novo para o mais antigo. */
    campanhas: lerCampanhas().reverse().slice(0, 200),
    /** O que cada tipo de mensagem aceita, para a tela avisar antes de mandar o arquivo. */
    tipos: Object.fromEntries(Object.entries(TIPOS).map(([chave, t]) => [chave, { nome: t.nome, maximoMb: t.maximoMb ?? 0, extensoes: t.extensoes ? Object.keys(t.extensoes) : null }])),
    limitePorDia: limiteDoDia(perfil),
    intervaloSegundos: Math.round(intervaloMs(perfil) / 1000),
    intervaloMaximoSegundos: Math.round(intervaloMaximoMs(perfil) / 1000),
    busca: situacaoDaBusca(),
    cidadeDoPerfil: perfil?.cidade ?? "",
    enviadasHoje: enviadosHoje(envios.filter((e) => !e.porMao)),
    naFila: montarFila(negocios, envios).length,
  };
}

function lerCorpo(pedido) {
  return new Promise((resolver, rejeitar) => {
    let texto = "";
    pedido.setEncoding("utf8");
    pedido.on("data", (parte) => {
      texto += parte;
      if (texto.length > MAX_CORPO) rejeitar(new Error("grande demais"));
    });
    pedido.on("end", () => {
      try {
        resolver(texto ? JSON.parse(texto) : {});
      } catch {
        rejeitar(new Error("formato"));
      }
    });
    pedido.on("error", rejeitar);
  });
}

/** Le o arquivo enviado pela tela. Devolve null se passar do maior tamanho aceito. */
function lerArquivoEnviado(pedido) {
  return new Promise((resolver, rejeitar) => {
    const partes = [];
    let tamanho = 0;
    let estourou = false;
    pedido.on("data", (parte) => {
      tamanho += parte.length;
      if (tamanho > MAX_ARQUIVO) estourou = true;
      else partes.push(parte);
    });
    // Mesmo grande demais, le ate o fim: assim a tela recebe a resposta, e nao uma queda.
    pedido.on("end", () => resolver(estourou ? null : Buffer.concat(partes)));
    pedido.on("error", rejeitar);
  });
}

function responder(resposta, codigo, valor) {
  resposta.writeHead(codigo, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  resposta.end(JSON.stringify(valor));
}

/** Devolve o problema como a pessoa le: comeca com maiuscula e termina com ponto. */
const frase = (problema) => `${problema[0].toUpperCase()}${problema.slice(1)}.`;

const acoes = {
  "/api/conexao/ligar": () => void ligar(),
  "/api/conexao/sair": async () => {
    parar();
    await sair();
  },
  "/api/negocio": ({ n, acao }) => {
    if (!acaoExiste(acao)) return "Não conheço essa ação.";
    const problema = aplicar(n, acao);
    return problema ? frase(`O nº ${n} ${problema}`) : null;
  },
  "/api/mensagem": ({ n, texto }) => {
    const problema = aplicarMensagem(n, texto);
    return problema ? frase(`A mensagem não foi guardada: ${problema}`) : null;
  },
  "/api/ritmo": ({ limitePorDia, intervaloSegundos, intervaloMaximoSegundos }) => {
    const limite = Number(limitePorDia);
    const minimo = Number(intervaloSegundos);
    const maximo = Number(intervaloMaximoSegundos);
    if (!Number.isInteger(limite) || limite < 1) return "Mensagens por dia precisa ser um número inteiro, de 1 para cima.";
    if (!Number.isFinite(minimo) || minimo < 0 || !Number.isFinite(maximo) || maximo < 0) {
      return "A pausa precisa ser um número de segundos, de 0 para cima.";
    }
    if (maximo < minimo) return "Na pausa, o segundo número precisa ser igual ou maior que o primeiro.";
    gravarJson(caminhos.perfil, {
      ...(lerPerfil() ?? {}),
      limitePorDia: limite,
      intervaloSegundos: minimo,
      intervaloMaximoSegundos: maximo,
    });
    return null;
  },
  "/api/busca": ({ cidade, termos, listaId, nomeDaLista, quantos }) => {
    if (typeof cidade !== "string" || !Array.isArray(termos)) return "Diga a cidade e o que buscar.";
    if (!cidade.trim() || !termos.some((t) => String(t).trim())) return "Diga a cidade, com o estado, e o que buscar.";
    return comecarBusca({ cidade, termos, listaId, nomeDaLista, quantos: Number(quantos) || null });
  },
  "/api/lista/criar": ({ nome }) => {
    const { erro, lista } = criarLista(nome);
    return erro ?? { lista };
  },
  "/api/lista/renomear": ({ id, nome }) => renomearLista(id, nome).erro ?? null,
  "/api/lista/apagar": ({ id }) => apagarLista(id).erro ?? null,
  "/api/lista/mover": ({ ns, id, nome }) => {
    const { erro, lista, movidos } = moverLeads(ns, { id, nome });
    return erro ?? { lista, movidos };
  },
  "/api/negocios": ({ ns, acao }) => {
    if (!acaoExiste(acao) || !Array.isArray(ns) || ns.length === 0) return "Escolha pelo menos um lead.";
    let feitos = 0;
    for (const n of ns) if (!aplicar(n, acao)) feitos += 1;
    return { feitos };
  },
  // Com "unica", a pessoa escolheu a mesma mensagem para todos: o texto entra nos leads da
  // lista e o envio comeca. Com o envio rodando, a fila nao muda de texto no meio.
  // Envio novo, vindo das etapas da tela: { lista, modo, tipo, texto, arquivo, comecaEm }.
  "/api/envio/criar": (pedido) => {
    const { erro, campanha } = criarEnvio(pedido);
    return erro ?? { campanha };
  },
  // { campanha }: continua um envio guardado. { lista }: e o comando "npm run enviar", que
  // manda as mensagens prontas da lista, uma para cada lead.
  "/api/envio/comecar": ({ campanha, lista }) => {
    if (campanha) return comecar(campanha);
    const { erro, campanha: nova } = criarEnvio({ lista, modo: "cada", tipo: "texto" });
    return erro ?? { campanha: nova };
  },
  "/api/envio/cancelar": ({ campanha }) => cancelarCampanha(campanha),
  "/api/envio/parar": () => void parar(),
  "/api/envio/teste": async ({ numero, ...pedido }) => {
    const { erro, negocio } = await enviarTeste(numero, pedido);
    return erro ?? { negocio };
  },
  "/api/fechar": () => {
    parar();
    soltar();
    setTimeout(() => process.exit(0), 300);
  },
};

const servidor = http.createServer(async (pedido, resposta) => {
  // Um site aberto no navegador nao pode comandar a tela: so vale pedido feito para
  // localhost e, quando muda algo, vindo da propria pagina.
  if (!ENDERECOS.includes(pedido.headers.host ?? "")) {
    responder(resposta, 403, { erro: "Endereço não aceito." });
    return;
  }
  const caminho = new URL(pedido.url, "http://localhost").pathname;

  try {
    if (pedido.method === "GET" && caminho === "/") {
      resposta.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      resposta.end(readFileSync(PAGINA));
      return;
    }
    if (pedido.method === "GET" && caminho === "/fonte.woff2") {
      resposta.writeHead(200, { "Content-Type": "font/woff2", "Cache-Control": "max-age=86400" });
      resposta.end(readFileSync(FONTE));
      return;
    }
    if (pedido.method === "GET" && caminho === "/api/ping") {
      responder(resposta, 200, { prospeccao: true });
      return;
    }
    if (pedido.method === "GET" && caminho === "/api/estado") {
      responder(resposta, 200, estadoCompleto());
      return;
    }
    // O arquivo de um envio (imagem, video, audio, documento) chega cru, nao em JSON.
    if (pedido.method === "POST" && caminho === "/api/arquivo") {
      const origem = pedido.headers.origin;
      const ehArquivo = (pedido.headers["content-type"] ?? "").includes("application/octet-stream");
      if (!ehArquivo || (origem && !ENDERECOS.includes(origem.replace(/^http:\/\//, "")))) {
        responder(resposta, 403, { erro: "Pedido não aceito." });
        return;
      }
      const dados = new URL(pedido.url, "http://localhost").searchParams;
      const conteudo = await lerArquivoEnviado(pedido);
      if (conteudo === null) {
        responder(resposta, 400, { erro: "O arquivo é grande demais para enviar pelo WhatsApp." });
        return;
      }
      const { erro, arquivo } = guardarArquivo(dados.get("tipo"), dados.get("nome"), conteudo);
      if (erro) responder(resposta, 400, { erro });
      else responder(resposta, 200, { ok: true, arquivo });
      return;
    }
    if (pedido.method === "POST" && Object.hasOwn(acoes, caminho)) {
      const origem = pedido.headers.origin;
      const ehJson = (pedido.headers["content-type"] ?? "").includes("application/json");
      if (!ehJson || (origem && !ENDERECOS.includes(origem.replace(/^http:\/\//, "")))) {
        responder(resposta, 403, { erro: "Pedido não aceito." });
        return;
      }
      const resultado = await acoes[caminho](await lerCorpo(pedido));
      if (typeof resultado === "string") responder(resposta, 400, { erro: resultado });
      else responder(resposta, 200, { ok: true, ...(resultado ?? {}) });
      return;
    }
    responder(resposta, 404, { erro: "Não achei isso." });
  } catch (erro) {
    console.error(new Date().toISOString(), caminho, erro);
    responder(resposta, 500, { erro: "Algo deu errado aqui. Peça à IA para olhar o arquivo dados/tela.log." });
  }
});

servidor.on("error", (erro) => {
  console.error(new Date().toISOString(), "Não consegui abrir a tela:", erro.message);
  process.exit(1);
});

servidor.listen(PORTA_DA_TELA, "127.0.0.1", () => {
  console.log(new Date().toISOString(), `Tela aberta em http://localhost:${PORTA_DA_TELA}`);
  // Numero ja conectado antes: religa sozinho, sem pedir QR Code.
  if (sessaoExiste()) ligar();
  retomarInterrompidos();
  // Os envios agendados comecam por aqui, quando a hora chega.
  setInterval(() => {
    try {
      verAgendados();
    } catch (erro) {
      console.error(new Date().toISOString(), "agendados", erro);
    }
  }, 20_000);
});
