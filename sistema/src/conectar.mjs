/**
 * Conecta o chip da prospeccao ao WhatsApp. E o unico passo que precisa da tela: o QR Code
 * aparece nela, e a pessoa le com o celular.
 *
 *   npm run conectar            mostra o QR Code e espera a leitura (ou diz que ja esta conectado)
 *   npm run conectar -- sair    desconecta o numero
 */
import { ErroDaTela, abrirNoNavegador, garantirTela, ler, mandar, rodar } from "./lib/cliente.mjs";
import { exibir } from "./lib/telefone.mjs";

const ESPERA_MAXIMA_MS = 5 * 60_000;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const mostrar = (numero) => exibir(numero) || numero;

await rodar(async () => {
  await garantirTela();

  if (process.argv[2] === "sair") {
    await mandar("/api/conexao/sair");
    return "Número da prospecção desconectado.";
  }

  let { conexao } = await ler("/api/estado");
  if (conexao.fase === "conectado") return `O número ${mostrar(conexao.numero)} já está conectado.`;

  if (conexao.fase === "desligado") await mandar("/api/conexao/ligar");
  abrirNoNavegador("#envio");
  console.log("\nAbri a tela no navegador: o QR Code aparece nela. Esperando a leitura...");

  const limite = Date.now() + ESPERA_MAXIMA_MS;
  let jaTentou = false;
  while (Date.now() < limite) {
    await esperar(2000);
    ({ conexao } = await ler("/api/estado"));
    if (conexao.fase === "conectado") return `Conectado no número ${mostrar(conexao.numero)}.`;
    if (conexao.fase !== "desligado") jaTentou = true;
    else if (jaTentou) throw new ErroDaTela(conexao.aviso || "A conexão não se completou. Rode npm run conectar de novo.");
  }
  throw new ErroDaTela("Ninguém leu o QR Code em 5 minutos. Rode npm run conectar de novo com o celular na mão.");
});
