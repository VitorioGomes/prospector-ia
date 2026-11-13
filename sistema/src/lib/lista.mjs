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
