/** Resumo da prospeccao: o que tem na lista, o que ja saiu e o que cabe hoje. */
import { lerPerfil } from "./lib/arquivos.mjs";
import { lerEnvios } from "./lib/lista.mjs";
import { lerTudo } from "./lib/listas.mjs";
import { NOMES_DA_SITUACAO, enviadosHoje, faltaNaOferta, intervaloMaximoMs, intervaloMs, limiteDoDia, montarFila } from "./lib/regras.mjs";
import { sessaoExiste } from "./lib/whatsapp.mjs";

const { listas, negocios } = lerTudo();
const envios = lerEnvios();
const perfil = lerPerfil();
const limite = limiteDoDia(perfil);
const hoje = enviadosHoje(envios.filter((e) => !e.porMao));

console.log("\nPreparação");
const falta = faltaNaOferta(perfil);
console.log(`  Oferta (o que a pessoa vende): ${falta.length ? `falta ${falta.join("; ")}` : "preenchida"}`);
console.log(`  WhatsApp da prospecção: ${sessaoExiste() ? "já foi conectado" : "ainda não conectado"}`);

console.log(`\nLeads: ${negocios.length}, em ${listas.length} ${listas.length === 1 ? "lista" : "listas"}`);
for (const lista of listas) {
  const dela = negocios.filter((n) => n.lista === lista.id);
  const partes = Object.entries(NOMES_DA_SITUACAO)
    .map(([chave, nome]) => [nome.toLowerCase(), dela.filter((n) => n.situacao === chave).length])
    .filter(([, quantos]) => quantos)
    .map(([nome, quantos]) => `${quantos} ${nome}`);
  console.log(`  "${lista.nome}": ${dela.length} leads${partes.length ? ` (${partes.join(", ")})` : ""}`);
}

console.log("\nEnvio pelo sistema");
console.log(`  Hoje: ${hoje} de ${limite}`);
console.log(`  Prontas para sair, em todas as listas: ${montarFila(negocios, envios).length}`);
console.log(`  Pausa entre mensagens: de ${Math.round(intervaloMs(perfil) / 1000)} a ${Math.round(intervaloMaximoMs(perfil) / 1000)} segundos`);

console.log("\nTela, para quem quiser ver: npm run tela\n");
