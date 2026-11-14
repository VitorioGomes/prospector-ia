/**
 * Busca negocios no Google Maps e junta na lista. Usada pelo comando (npm run buscar) e
 * pela tela, para os dois trazerem a mesma coisa.
 *
 * Primeiro a cidade, depois um ou mais jeitos de dizer o nicho. Cada termo traz ate 20
 * negocios; varios termos juntos trazem mais, porque o Maps mostra lugares diferentes para
 * cada um. Sem chave e sem cadastro: ver maps.mjs.
 *
 * Regra do dono (12/11/2026): negocio sem telefone nao entra na lista. Sem telefone nao
 * ha como entrar em contato.
 */
import { gravarNegocios } from "./arquivos.mjs";
import { acharOuCriar, lerTudo, nomeAutomatico } from "./listas.mjs";
import { ErroDaBusca, buscarRapido, centroDosLugares, ficaNaCidade, garantirPrograma, localizarCidade } from "./maps.mjs";
import { ehCelular, normalizar } from "./telefone.mjs";

export const MAX_TERMOS = 8;
/** O maximo que se pode pedir numa busca. Acima disso sao buscas demais em seguida no Maps. */
export const QUANTOS_MAX = 200;

/**
 * Pontos em volta do centro da cidade, em km (para o norte, para o leste), do mais perto
 * para o mais longe. Cada busca traz ate 20 negocios por termo: para trazer mais, a busca
 * se repete ponto a ponto. Medido em 14/11/2026 (barbearia, Fortaleza): com a cidade no
 * texto da busca, o Maps devolve os mesmos 20 em qualquer ponto; so com o termo puro e o
 * mapa bem de perto cada ponto traz negocios novos (17 a 20 por ponto).
 */
const EM_VOLTA = [
  [0, 0],
  [2.5, 0], [0, 2.5], [-2.5, 0], [0, -2.5],
  [3, 3], [-3, 3], [-3, -3], [3, -3],
  [5, 0], [0, 5], [-5, 0], [0, -5],
  [5.5, 5.5], [-5.5, 5.5], [-5.5, -5.5], [5.5, -5.5],
  [8, 0], [0, 8], [-8, 0], [0, -8],
];
/** Cidade pequena acaba logo: depois de tantos pontos sem nada novo, a busca para. */
const PONTOS_VAZIOS_PARA_PARAR = 3;
const deslocar = ({ lat, lon }, [norteKm, lesteKm]) => ({
  lat: lat + norteKm / 111,
  lon: lon + lesteKm / (111 * Math.cos((lat * Math.PI) / 180)),
});

function paraNegocio(lugar, busca) {
  const telefone = normalizar(lugar.phone);
  return {
    n: 0,
    id: lugar.data_id || lugar.place_id || lugar.cid || `${lugar.title}|${lugar.address}`,
    nome: lugar.title ?? "",
    tipo: lugar.category || lugar.categories?.[0] || "",
    endereco: lugar.address ?? "",
    telefone,
    celular: ehCelular(telefone),
    site: lugar.web_site ?? "",
    nota: lugar.review_rating || null,
    avaliacoes: lugar.review_count ?? 0,
    maps: lugar.link || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lugar.title} ${lugar.address ?? ""}`)}`,
    busca,
    mensagem: null,
    situacao: "novo",
  };
}

/**
 * Separa o que entra na lista do que fica de fora. Sem rede e sem arquivo, para poder
 * ser testada. Devolve os negocios novos (ja numerados) e a conta do que ficou de fora.
 */
export function escolherNovos(lugares, negocios, cidade, busca) {
  const conhecidos = new Set(negocios.map((n) => n.id));
  let proximoNumero = negocios.reduce((maior, n) => Math.max(maior, n.n), 0) + 1;
  const vistosAgora = new Set();
  const novos = [];
  let repetidos = 0;
  let deFora = 0;
  let semTelefone = 0;

  for (const lugar of lugares) {
    const negocio = paraNegocio(lugar, busca);
    if (vistosAgora.has(negocio.id)) continue;
    vistosAgora.add(negocio.id);
    if (!ficaNaCidade(lugar, cidade)) {
      deFora += 1;
      continue;
    }
    if (conhecidos.has(negocio.id)) {
      repetidos += 1;
      continue;
    }
    if (!negocio.telefone) {
      semTelefone += 1;
      continue;
    }
    negocio.n = proximoNumero++;
    novos.push(negocio);
  }
  return { novos, repetidos, deFora, semTelefone };
}

/**
 * Faz a busca e grava. avisar(texto) recebe o que esta acontecendo, para quem espera.
 * Lanca ErroDaBusca com a mensagem para a pessoa. Devolve o resumo.
 *
 * Os novos entram numa lista: a de id listaId, ou a de nome nomeDaLista (criada se nao
 * existir). Sem nenhum dos dois, o nome vem da propria busca.
 */
export async function buscar({ cidade, termos, listaId = null, nomeDaLista = "", quantos = null, avisar = () => {} }) {
  cidade = String(cidade ?? "").trim();
  termos = (termos ?? []).map((t) => String(t).trim()).filter(Boolean);
  if (!cidade || termos.length === 0) {
    throw new ErroDaBusca('Diga a cidade, com o estado, e o que buscar. Exemplo: "Sobral, CE" e "clínica de estética".');
  }
  if (termos.length > MAX_TERMOS) {
    throw new ErroDaBusca(`São no máximo ${MAX_TERMOS} termos por busca. Faça outra busca com os que sobraram.`);
  }

  const programa = await garantirPrograma(avisar);
  const consultas = termos.map((termo) => `${termo} em ${cidade}`);

  // 1. Ponto de partida aproximado, olhando a regiao inteira.
  avisar("Localizando a cidade...");
  const partida = await localizarCidade(cidade);
  avisar("Buscando no Google Maps...");
  const daRegiao = await buscarRapido(programa, { consultas: [consultas[0]], ...partida, raioM: 50_000, zoom: 10 });

  // 2. Com o que apareceu, acha onde a cidade fica de verdade e busca de perto, com todos os termos.
  const centro = centroDosLugares(daRegiao.filter((l) => ficaNaCidade(l, cidade))) ?? partida;
  const dePerto = await buscarRapido(programa, { consultas, ...centro, raioM: 10_000, zoom: 13 });

  const encontrados = [...dePerto, ...daRegiao];

  // 3. A pessoa pediu uma quantidade e ainda falta: busca em volta do centro, ponto a ponto,
  //    ate chegar la ou acabarem os pontos.
  const pedidos = Number.isInteger(quantos) && quantos > 0 ? Math.min(quantos, QUANTOS_MAX) : null;
  if (pedidos) {
    const jaTenho = lerTudo().negocios;
    const contar = () => escolherNovos(encontrados, jaTenho, cidade, null).novos.length;
    let tenho = contar();
    let vazios = 0;
    for (const ponto of EM_VOLTA) {
      if (tenho >= pedidos || vazios >= PONTOS_VAZIOS_PARA_PARAR) break;
      avisar(`Buscando mais em volta: ${tenho} de ${pedidos}...`);
      // Termo puro, sem a cidade: quem decide o lugar e o ponto no mapa. O que cair fora da
      // cidade sai depois, pelo endereco.
      encontrados.push(...(await buscarRapido(programa, { consultas: termos, ...deslocar(centro, ponto), raioM: 3_000, zoom: 15 })));
      const agora = contar();
      vazios = agora > tenho ? 0 : vazios + 1;
      tenho = agora;
    }
  }
  if (encontrados.length === 0) {
    throw new ErroDaBusca(
      "A busca não trouxe nenhum negócio. Tente outro jeito de dizer o nicho, ou confira o nome da cidade.\n" +
        "Se já funcionou antes e parou, o Google pode ter limitado as buscas desta internet: espere uma hora e tente de novo.",
    );
  }

  // Os leads sao lidos so agora: a busca leva segundos, e eles podem ter mudado nesse tempo.
  const { listas, negocios } = lerTudo();
  const busca = { termo: termos.join(", "), cidade, em: new Date().toISOString() };
  const escolhidos = escolherNovos(encontrados, negocios, cidade, busca);
  const { repetidos, deFora, semTelefone } = escolhidos;
  // Vieram mais do que o pedido: ficam os primeiros. Os outros aparecem numa proxima busca.
  const novos = pedidos ? escolhidos.novos.slice(0, pedidos) : escolhidos.novos;

  // A lista so e criada se tem quem por nela.
  let lista = listaId ? listas.find((l) => l.id === listaId) : null;
  if (listaId && !lista) throw new ErroDaBusca("A lista escolhida não existe mais. Escolha outra e busque de novo.");
  if (!lista && novos.length) {
    const criada = acharOuCriar(String(nomeDaLista ?? "").trim() || nomeAutomatico(termos, cidade));
    if (criada.erro) throw new ErroDaBusca(criada.erro);
    lista = criada.lista;
  }
  for (const novo of novos) novo.lista = lista.id;
  gravarNegocios([...negocios, ...novos]);

  return {
    cidade,
    termos,
    lista: lista ? { id: lista.id, nome: lista.nome } : null,
    pedidos,
    novos: novos.length,
    celulares: novos.filter((n) => n.celular).length,
    repetidos,
    deFora,
    semTelefone,
    total: negocios.length + novos.length,
  };
}

// ---- A busca pedida pela tela: uma por vez, com o andamento a mostra ----------------------
const estado = { rodando: false, etapa: "", resultado: null, erro: null };

export function situacaoDaBusca() {
  return { ...estado };
}

/** Comeca a busca e volta na hora. Devolve o motivo de nao ter comecado, ou null. */
export function comecarBusca({ cidade, termos, listaId, nomeDaLista, quantos }) {
  if (estado.rodando) return "Já tem uma busca rodando. Espere ela terminar.";
  Object.assign(estado, { rodando: true, etapa: "Começando...", resultado: null, erro: null });
  buscar({ cidade, termos, listaId, nomeDaLista, quantos, avisar: (texto) => (estado.etapa = texto) })
    .then((resultado) => (estado.resultado = resultado))
    .catch((falha) => {
      estado.erro = falha instanceof ErroDaBusca ? falha.message : "A busca deu um erro que eu não esperava. Tente de novo.";
      if (!(falha instanceof ErroDaBusca)) console.error(new Date().toISOString(), "busca", falha);
    })
    .finally(() => {
      estado.rodando = false;
      estado.etapa = "";
    });
  return null;
}
