/**
 * O que se pode fazer com um negocio da lista. Usado pela tela e pelos comandos, para os
 * dois seguirem as mesmas regras.
 *
 * Cada funcao mexe no negocio (e no registro de envios, quando e o caso) e devolve o
 * problema, em portugues, ou null quando deu certo. Quem chama e quem grava.
 */
import { caminhos, gravarJson, gravarNegocios, lerJson, lerNegocios } from "./arquivos.mjs";
import { validarMensagem } from "./regras.mjs";

export const lerEnvios = () => lerJson(caminhos.envios, []);

export function descartar(negocio) {
  if (negocio.situacao === "enviado") return "já recebeu mensagem, não dá para descartar";
  negocio.situacao = "descartado";
  return null;
}

export function voltar(negocio) {
  if (negocio.situacao !== "descartado") return "não estava descartado";
  negocio.situacao = negocio.mensagem ? "pronto" : "novo";
  return null;
}

/** A pessoa mandou a mensagem ela mesma, pelo link. */
export function marcarEnviadoPorMao(negocio, envios, agora = new Date()) {
  if (negocio.situacao === "enviado") return "já estava como enviado";
  negocio.situacao = "enviado";
  negocio.enviadoEm = agora.toISOString();
  negocio.enviadoPor = "mao";
  delete negocio.erro;
  // Entra no registro para o envio pelo sistema nunca repetir esse numero. Nao conta no
  // limite do dia, que e do envio pelo sistema.
  if (negocio.telefone) envios.push({ telefone: negocio.telefone, n: negocio.n, em: negocio.enviadoEm, porMao: true });
  return null;
}

/** Abriu o WhatsApp e nao mandou. So vale para o que foi marcado a mao. */
export function desfazerEnvioPorMao(negocio, envios) {
  if (negocio.situacao !== "enviado" || negocio.enviadoPor !== "mao") {
    return "só dá para desfazer o que foi marcado à mão";
  }
  for (let i = envios.length - 1; i >= 0; i--) {
    if (envios[i].porMao && envios[i].n === negocio.n) envios.splice(i, 1);
  }
  negocio.situacao = negocio.mensagem ? "pronto" : "novo";
  delete negocio.enviadoEm;
  delete negocio.enviadoPor;
  return null;
}

/** O envio falhou e a pessoa quer que ele volte para a fila. */
export function tentarDeNovo(negocio) {
  if (negocio.situacao !== "falhou") return "esse envio não tinha falhado";
  negocio.situacao = negocio.mensagem ? "pronto" : "novo";
  delete negocio.erro;
  return null;
}

/**
 * Confere e guarda a mensagem de um negocio. Mensagem igual para dois negocios e o
 * contrario de abordagem personalizada, e texto repetido e o que o WhatsApp mais
 * reconhece como disparo.
 */
export function guardarMensagem(negocios, negocio, texto) {
  if (negocio.situacao === "enviado") return "esse negócio já recebeu mensagem";
  if (!negocio.telefone) return "esse negócio não tem telefone no Maps";
  const problema = validarMensagem(texto);
  if (problema) return problema;

  const limpo = texto.trim();
  const igual = negocios.find((o) => o !== negocio && o.mensagem && o.mensagem.trim().toLowerCase() === limpo.toLowerCase());
  if (igual) return `é igual à mensagem do nº ${igual.n}`;

  negocio.mensagem = limpo;
  if (negocio.situacao === "novo" || negocio.situacao === "falhou") {
    negocio.situacao = "pronto";
    delete negocio.erro;
  }
  return null;
}

/** Quem pode receber a mensagem unica: tem telefone, ainda nao recebeu e nao foi tirado. */
export const recebeMensagemUnica = (negocio) =>
  Boolean(negocio.telefone) && ["novo", "pronto", "falhou"].includes(negocio.situacao ?? "novo");

/** "{nome}" vira o nome do negocio. E o unico campo que existe. */
export const montarMensagemUnica = (texto, negocio) => String(texto).replace(/\{nome\}/gi, negocio.nome ?? "").trim();

/** O que impede esta mensagem unica de ir para este negocio, como a pessoa le, ou null. */
export function problemaDaMensagemUnica(texto, negocio) {
  if (typeof texto !== "string" || !texto.trim()) return "Escreva a mensagem antes.";
  if (/\{[^{}]*\}/.test(texto.replace(/\{nome\}/gi, ""))) {
    return "A mensagem tem um campo que eu não conheço. O único que vale é {nome}, que vira o nome do negócio.";
  }
  const problema = validarMensagem(montarMensagemUnica(texto, negocio));
  return problema ? `A mensagem ${problema}.` : null;
}

/**
 * A mesma mensagem para a lista inteira: e o disparo comum, que a pessoa escreve uma vez.
 * Entra em quem ainda pode receber. Com soSemMensagem, quem ja tem mensagem propria fica
 * como esta. Aqui a regra de "nao repetir texto" nao vale: repetir e o pedido.
 * Devolve { erro } ou { guardadas, mantidas }.
 */
export function usarMensagemUnica(negocios, listaId, texto, { soSemMensagem = false } = {}) {
  if (typeof texto !== "string" || !texto.trim()) return { erro: "Escreva a mensagem antes." };
  const daLista = negocios.filter((o) => o.lista === listaId && recebeMensagemUnica(o));
  if (daLista.length === 0) return { erro: "Essa lista não tem nenhum lead que ainda possa receber mensagem." };

  const alvos = soSemMensagem ? daLista.filter((o) => !o.mensagem) : daLista;
  if (alvos.length === 0) return { erro: "Todos os leads desta lista já têm mensagem." };

  // O nome mais curto e o mais longo dizem se a mensagem cabe para todos.
  const porTamanho = [...alvos].sort((a, b) => (a.nome ?? "").length - (b.nome ?? "").length);
  for (const negocio of [porTamanho[0], porTamanho.at(-1)]) {
    const problema = problemaDaMensagemUnica(texto, negocio);
    if (problema) return { erro: problema };
  }

  for (const negocio of alvos) {
    negocio.mensagem = montarMensagemUnica(texto, negocio);
    if (negocio.situacao !== "pronto") {
      negocio.situacao = "pronto";
      delete negocio.erro;
    }
  }
  return { guardadas: alvos.length, mantidas: daLista.length - alvos.length };
}

/** Le a lista, aplica a mensagem unica e grava. */
export function aplicarMensagemUnica(listaId, texto, opcoes) {
  const negocios = lerNegocios();
  const resultado = usarMensagemUnica(negocios, listaId, texto, opcoes);
  if (!resultado.erro) gravarNegocios(negocios);
  return resultado;
}

const ACOES = {
  descartar: (negocio) => descartar(negocio),
  voltar: (negocio) => voltar(negocio),
  enviado: (negocio, envios) => marcarEnviadoPorMao(negocio, envios),
  desfazer: (negocio, envios) => desfazerEnvioPorMao(negocio, envios),
  repetir: (negocio) => tentarDeNovo(negocio),
};

export const acaoExiste = (acao) => Object.hasOwn(ACOES, acao);

/** Le a lista, aplica a acao no negocio de numero n e grava. Devolve o problema ou null. */
export function aplicar(n, acao) {
  const negocios = lerNegocios();
  const envios = lerEnvios();
  const negocio = negocios.find((o) => String(o.n) === String(n));
  if (!negocio) return "não existe na lista";
  const problema = ACOES[acao](negocio, envios);
  if (problema) return problema;
  gravarNegocios(negocios);
  gravarJson(caminhos.envios, envios);
  return null;
}

/** Le a lista, guarda a mensagem do negocio de numero n e grava. Devolve o problema ou null. */
export function aplicarMensagem(n, texto) {
  const negocios = lerNegocios();
  const negocio = negocios.find((o) => String(o.n) === String(n));
  if (!negocio) return "esse número não existe na lista";
  const problema = guardarMensagem(negocios, negocio, texto);
  if (problema) return problema;
  gravarNegocios(negocios);
  return null;
}
