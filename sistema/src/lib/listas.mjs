/**
 * As listas de leads. Cada lead fica em uma lista, e o envio sai para a lista que a
 * pessoa escolher (decisao do dono, 12/11/2026: enviar "do primeiro ao ultimo" de tudo
 * nao serve, ele quer montar listas e escolher para qual enviar).
 *
 * dados/listas.json guarda [{ id, nome, criadaEm }]. O lead aponta para a lista pelo
 * campo "lista". Cada funcao devolve { erro } ou o que fez; as que mexem em arquivo
 * leem e gravam elas mesmas.
 */
import { randomBytes } from "node:crypto";
import { caminhos, gravarJson, gravarNegocios, lerJson, lerNegocios } from "./arquivos.mjs";

const TAMANHO_MAX_DO_NOME = 60;

export const lerListas = () => lerJson(caminhos.listas, []);
const gravarListas = (listas) => gravarJson(caminhos.listas, listas);

const igual = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
const novaLista = (nome) => ({ id: `l${randomBytes(4).toString("hex")}`, nome, criadaEm: new Date().toISOString() });

/** "clinica de estetica" + "Sobral, CE" -> "Clinica de estetica em Sobral, CE" */
export function nomeAutomatico(termos, cidade) {
  const termo = String(termos?.[0] ?? "").trim() || "Leads";
  return `${termo[0].toUpperCase()}${termo.slice(1)} em ${cidade}`.slice(0, TAMANHO_MAX_DO_NOME);
}

/** O problema do nome, ou null. ignorar e o id da propria lista, ao renomear. */
export function problemaDoNome(listas, nome, ignorar = null) {
  if (typeof nome !== "string" || !nome.trim()) return "Dê um nome para a lista.";
  if (nome.trim().length > TAMANHO_MAX_DO_NOME) return `O nome pode ter até ${TAMANHO_MAX_DO_NOME} letras.`;
  if (listas.some((l) => l.id !== ignorar && igual(l.nome, nome))) return "Já existe uma lista com esse nome.";
  return null;
}

/**
 * Lead sem lista (de antes de as listas existirem) vai para uma lista com o nome da busca
 * que o trouxe. Mexe nos dois vetores e devolve true se mudou algo.
 */
export function arrumar(listas, negocios) {
  const ids = new Set(listas.map((l) => l.id));
  let mudou = false;
  for (const negocio of negocios) {
    if (negocio.lista && ids.has(negocio.lista)) continue;
    const nome = negocio.busca ? nomeAutomatico([negocio.busca.termo.split(",")[0]], negocio.busca.cidade) : "Minha lista";
    let lista = listas.find((l) => igual(l.nome, nome));
    if (!lista) {
      lista = novaLista(nome);
      listas.push(lista);
      ids.add(lista.id);
    }
    negocio.lista = lista.id;
    mudou = true;
  }
  return mudou;
}

/** Le listas e leads ja arrumados. E por aqui que a tela e os comandos leem. */
export function lerTudo() {
  const listas = lerListas();
  const negocios = lerNegocios();
  if (arrumar(listas, negocios)) {
    gravarListas(listas);
    gravarNegocios(negocios);
  }
  return { listas, negocios };
}

export function criarLista(nome) {
  const listas = lerListas();
  const erro = problemaDoNome(listas, nome);
  if (erro) return { erro };
  const lista = novaLista(nome.trim());
  gravarListas([...listas, lista]);
  return { lista };
}

/** A lista com esse nome, criada agora se nao existir. */
export function acharOuCriar(nome) {
  const listas = lerListas();
  const existente = listas.find((l) => igual(l.nome, nome));
  return existente ? { lista: existente } : criarLista(nome);
}

export function renomearLista(id, nome) {
  const listas = lerListas();
  const lista = listas.find((l) => l.id === id);
  if (!lista) return { erro: "Essa lista não existe mais." };
  const erro = problemaDoNome(listas, nome, id);
  if (erro) return { erro };
  lista.nome = nome.trim();
  gravarListas(listas);
  return { lista };
}

/** So lista vazia e apagada: lead nao some junto com a lista. */
export function apagarLista(id) {
  const { listas, negocios } = lerTudo();
  if (!listas.some((l) => l.id === id)) return { erro: "Essa lista não existe mais." };
  const dentro = negocios.filter((n) => n.lista === id).length;
  if (dentro) return { erro: `Essa lista ainda tem ${dentro} ${dentro === 1 ? "lead" : "leads"}. Mova para outra lista antes de apagar.` };
  gravarListas(listas.filter((l) => l.id !== id));
  return {};
}

/** Move os leads de numero ns para a lista de id destino, ou para uma lista nova de nome nomeNovo. */
export function moverLeads(ns, { id, nome }) {
  if (!Array.isArray(ns) || ns.length === 0) return { erro: "Escolha pelo menos um lead." };
  let destino;
  if (id) {
    destino = lerListas().find((l) => l.id === id);
    if (!destino) return { erro: "Essa lista não existe mais." };
  } else {
    const criada = criarLista(nome);
    if (criada.erro) return criada;
    destino = criada.lista;
  }
  const { negocios } = lerTudo();
  const quais = new Set(ns.map(String));
  let movidos = 0;
  for (const negocio of negocios) {
    if (!quais.has(String(negocio.n)) || negocio.lista === destino.id) continue;
    negocio.lista = destino.id;
    movidos += 1;
  }
  gravarNegocios(negocios);
  return { lista: destino, movidos };
}
