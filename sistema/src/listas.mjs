/**
 * As listas de leads, pela conversa. E o mesmo que a parte Leads da tela faz.
 *
 *   npm run listas                                    mostra as listas
 *   npm run listas -- criar "Prioridade"
 *   npm run listas -- renomear "Prioridade" "Primeiro contato"
 *   npm run listas -- mover "Prioridade" 4 9 12       poe os leads 4, 9 e 12 na lista (cria, se nao existir)
 *   npm run listas -- apagar "Prioridade"             so lista vazia
 */
import { falhar } from "./lib/arquivos.mjs";
import { lerEnvios } from "./lib/lista.mjs";
import { acharOuCriar, apagarLista, criarLista, lerTudo, moverLeads, renomearLista } from "./lib/listas.mjs";
import { NOMES_DA_SITUACAO, montarFila } from "./lib/regras.mjs";

const [acao, ...resto] = process.argv.slice(2);

function porNome(nome) {
  const { listas } = lerTudo();
  const lista = listas.find((l) => l.nome.trim().toLowerCase() === String(nome ?? "").trim().toLowerCase());
  if (!lista) falhar(`Não achei a lista "${nome ?? ""}". Rode npm run listas para ver os nomes.`);
  return lista;
}

function mostrar() {
  const { listas, negocios } = lerTudo();
  const envios = lerEnvios();
  if (listas.length === 0) return console.log("\nAinda não há nenhuma lista. Ela é criada na primeira busca.\n");
  console.log("");
  for (const lista of listas) {
    const dela = negocios.filter((n) => n.lista === lista.id);
    const partes = Object.entries(NOMES_DA_SITUACAO)
      .map(([chave, nome]) => [nome.toLowerCase(), dela.filter((n) => n.situacao === chave).length])
      .filter(([, quantos]) => quantos)
      .map(([nome, quantos]) => `${quantos} ${nome}`);
    console.log(`"${lista.nome}" (id ${lista.id}): ${dela.length} leads${partes.length ? `, ${partes.join(", ")}` : ""}`);
    console.log(`  Prontas para sair pelo sistema: ${montarFila(negocios, envios, lista.id).length}`);
  }
  console.log("");
}

function conferir({ erro }, certo) {
  if (erro) falhar(erro);
  console.log(`\n${certo}\n`);
}

if (!acao) {
  mostrar();
} else if (acao === "criar") {
  conferir(criarLista(resto[0]), `Lista "${resto[0]}" criada.`);
} else if (acao === "renomear") {
  conferir(renomearLista(porNome(resto[0]).id, resto[1]), `Lista renomeada para "${resto[1]}".`);
} else if (acao === "apagar") {
  conferir(apagarLista(porNome(resto[0]).id), `Lista "${resto[0]}" apagada.`);
} else if (acao === "mover") {
  const [nome, ...numeros] = resto;
  if (!nome || numeros.length === 0) falhar('Use assim:\n  npm run listas -- mover "Nome da lista" 4 9 12');
  const destino = acharOuCriar(nome);
  if (destino.erro) falhar(destino.erro);
  const resultado = moverLeads(numeros, { id: destino.lista.id });
  conferir(resultado, `${resultado.movidos} ${resultado.movidos === 1 ? "lead movido" : "leads movidos"} para "${destino.lista.nome}".`);
} else {
  falhar('Use assim:\n  npm run listas\n  npm run listas -- criar "Nome"\n  npm run listas -- renomear "Nome" "Nome novo"\n  npm run listas -- mover "Nome" 4 9 12\n  npm run listas -- apagar "Nome"');
}
