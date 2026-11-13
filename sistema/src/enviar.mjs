/**
 * O envio pelo sistema, pela conversa. E o mesmo que a parte Envio da tela faz.
 *
 *   npm run enviar -- "Nome da lista"            comeca a enviar para os leads prontos da lista
 *   npm run enviar -- andamento                  como esta o envio
 *   npm run enviar -- parar                      para o envio
 *   npm run enviar -- teste 88999990000 "Lista"  manda a primeira mensagem da lista para este
 *                                                numero (o da propria pessoa), sem registrar
 *
 * O envio roda dentro do servidor da tela, solto do terminal: este comando comeca e volta.
 * Quantas saem por dia e a pausa entre elas estao em prospeccao/perfil.json.
 */
import { ErroDaTela, garantirTela, ler, mandar, rodar } from "./lib/cliente.mjs";

const [primeiro, ...resto] = process.argv.slice(2);
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

function acharLista(estado, nome) {
  const { listas, filaPorLista } = estado;
  const quais = listas.map((l) => `"${l.nome}" (${plural(filaPorLista[l.id] ?? 0, "pronta", "prontas")})`).join(", ");
  if (!nome) {
    const comFila = listas.filter((l) => filaPorLista[l.id] > 0);
    if (comFila.length === 1) return comFila[0];
    throw new ErroDaTela(listas.length ? `Diga para qual lista enviar. As listas: ${quais}.` : "Ainda não há nenhuma lista. Faça uma busca primeiro.");
  }
  const lista = listas.find((l) => l.nome.trim().toLowerCase() === nome.trim().toLowerCase());
  if (!lista) throw new ErroDaTela(`Não achei a lista "${nome}". As listas: ${quais || "nenhuma"}.`);
  return lista;
}

function andamento(estado) {
  const { envio, enviadasHoje, limitePorDia, filaPorLista } = estado;
  const linhas = [];
  if (envio.rodando) {
    linhas.push(`Enviando para "${envio.lista.nome}": ${plural(envio.enviadas, "enviada", "enviadas")} agora, ${filaPorLista[envio.lista.id] ?? 0} na fila.`);
    if (envio.atual) linhas.push(`Agora: nº ${envio.atual.n}, ${envio.atual.nome}.`);
    else if (envio.proximaEm) linhas.push(`A próxima sai em ${Math.max(0, Math.round((new Date(envio.proximaEm) - Date.now()) / 1000))} segundos.`);
  } else if (envio.terminouEm) {
    const partes = [plural(envio.enviadas, "enviada", "enviadas")];
    if (envio.semWhatsapp) partes.push(`${envio.semWhatsapp} sem WhatsApp`);
    if (envio.falhas) partes.push(plural(envio.falhas, "falhou", "falharam"));
    linhas.push(`Nenhum envio rodando. O último, para "${envio.lista?.nome}": ${partes.join(", ")}.${envio.motivo ? ` Parou porque ${envio.motivo}.` : ""}`);
  } else {
    linhas.push("Nenhum envio rodando.");
  }
  linhas.push(`Hoje: ${enviadasHoje} de ${limitePorDia}.`);
  return linhas.join("\n");
}

await rodar(async () => {
  await garantirTela();
  const estado = await ler("/api/estado");

  if (primeiro === "andamento") return andamento(estado);

  if (primeiro === "parar") {
    if (!estado.envio.rodando) return "Não havia envio rodando.";
    await mandar("/api/envio/parar");
    return "Envio parado. O que já saiu está registrado, e o resto continua na fila.";
  }

  if (primeiro === "teste") {
    const [numero, nome] = resto;
    if (!numero) throw new ErroDaTela('Diga o número que vai receber o teste, com DDD:\n  npm run enviar -- teste 88999990000 "Nome da lista"');
    const lista = acharLista(estado, nome);
    const { negocio } = await mandar("/api/envio/teste", { numero, lista: lista.id });
    return `Teste enviado: a mensagem do nº ${negocio.n} (${negocio.nome}) foi para o número informado.\nNada foi registrado, e o negócio ainda não recebeu.`;
  }

  const lista = acharLista(estado, primeiro);
  await mandar("/api/envio/comecar", { lista: lista.id });
  const quantas = Math.min(estado.filaPorLista[lista.id] ?? 0, Math.max(0, estado.limitePorDia - estado.enviadasHoje));
  return (
    `Envio começou para "${lista.nome}": ${plural(quantas, "mensagem", "mensagens")}, com pausa de ${estado.intervaloSegundos} a ${estado.intervaloMaximoSegundos} segundos entre elas.\n` +
    "Ele continua com o terminal fechado; o computador precisa ficar ligado.\n" +
    "Para acompanhar: npm run enviar -- andamento. Para parar: npm run enviar -- parar."
  );
});
