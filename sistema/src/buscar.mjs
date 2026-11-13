/**
 * Busca negocios no Google Maps e junta na lista. E o mesmo que a aba "Buscar" da tela
 * faz, para quando a pessoa pede pela conversa.
 *
 *   npm run buscar -- "Sobral, CE" "clinica de estetica" "estetica facial" "depilacao a laser"
 *
 * Os novos entram numa lista com o nome da busca. Para escolher a lista (ela e criada se
 * nao existir):
 *
 *   npm run buscar -- "Sobral, CE" "clinica de estetica" --lista "Estetica de Sobral"
 *
 * As regras da busca estao em lib/busca.mjs.
 */
import { buscar } from "./lib/busca.mjs";
import { ErroDaBusca } from "./lib/maps.mjs";

try {
  const argumentos = process.argv.slice(2);
  const posicao = argumentos.indexOf("--lista");
  const nomeDaLista = posicao >= 0 ? argumentos.splice(posicao, 2)[1] : "";
  const [cidade, ...termos] = argumentos.filter((a) => !a.startsWith("--"));
  const r = await buscar({ cidade, termos, nomeDaLista, avisar: (texto) => console.log(`\n${texto}`) });

  console.log(`\nBusca em ${r.cidade}: ${r.termos.join(", ")}`);
  console.log(`  Leads novos: ${r.novos} (${r.celulares} com celular)${r.lista ? `, na lista "${r.lista.nome}"` : ""}`);
  if (r.repetidos) console.log(`  Já estavam nas suas listas: ${r.repetidos}`);
  if (r.semTelefone) console.log(`  Sem telefone, deixados de fora: ${r.semTelefone}`);
  if (r.deFora) console.log(`  De outras cidades, deixados de fora: ${r.deFora}`);
  console.log(`  Total de leads: ${r.total}\n`);
} catch (erro) {
  if (!(erro instanceof ErroDaBusca)) throw erro;
  console.error(`\n${erro.message}\n`);
  process.exitCode = 1;
}
