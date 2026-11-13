/**
 * Muda a situacao de negocios da lista, pelo numero. E o mesmo que os botoes da tela
 * fazem, para quando a pessoa pede pela conversa.
 *
 *   npm run marcar -- descartar 4 9     nao abordar esses
 *   npm run marcar -- voltar 4          desfaz o descarte
 *   npm run marcar -- enviado 3         ja mandei a mensagem a mao
 *   npm run marcar -- desfazer 3        marquei como enviado, mas nao mandei
 *   npm run marcar -- repetir 7         o envio falhou: volta para a fila
 */
import { falhar } from "./lib/arquivos.mjs";
import { acaoExiste, aplicar } from "./lib/lista.mjs";

const [acao, ...numeros] = process.argv.slice(2);

if (!acaoExiste(acao ?? "") || numeros.length === 0) {
  falhar(
    "Use assim:\n  npm run marcar -- descartar 4 9\n  npm run marcar -- voltar 4\n  npm run marcar -- enviado 3\n  npm run marcar -- desfazer 3\n  npm run marcar -- repetir 7",
  );
}

let mudados = 0;
for (const numero of numeros) {
  const problema = aplicar(numero, acao);
  if (problema) console.log(`  nº ${numero}: ${problema}`);
  else mudados += 1;
}
console.log(`\nAtualizados: ${mudados}\n`);
