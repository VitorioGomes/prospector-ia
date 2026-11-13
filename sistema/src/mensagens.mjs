/**
 * Recebe as mensagens que a IA escreveu e guarda na lista, depois de conferir cada uma.
 *
 * A IA escreve dados/mensagens.json, no formato { "12": "texto", "13": "texto" }, em que
 * a chave e o numero do negocio na lista. Este comando confere e aplica. O que nao passar
 * fica no arquivo, para ser corrigido.
 */
import { caminhos, falhar, gravarJson, gravarNegocios, lerJson, lerNegocios, lerPerfil } from "./lib/arquivos.mjs";
import { guardarMensagem } from "./lib/lista.mjs";
import { faltaNaOferta } from "./lib/regras.mjs";

// Mensagem escrita sem saber o que a pessoa vende e chute. Este comando nao guarda nenhuma
// enquanto a oferta nao estiver preenchida.
const falta = faltaNaOferta(lerPerfil());
if (falta.length) {
  falhar(
    `Antes das mensagens, falta saber da oferta: ${falta.join("; ")}.\n` +
      "Procure o contexto nos arquivos da pasta ou pergunte à pessoa (Passo 1 do roteiro), e grave em prospeccao/perfil.json.\n" +
      "Não presuma o que ela vende. Depois de preencher, reescreva as mensagens com base nisso e rode de novo.",
  );
}

const recebidas = lerJson(caminhos.mensagens, null);
if (!recebidas || typeof recebidas !== "object" || Array.isArray(recebidas)) {
  falhar(
    'Não achei as mensagens. Elas vão em dados/mensagens.json, assim:\n  { "12": "texto da mensagem", "13": "outra mensagem" }',
  );
}

const negocios = lerNegocios();
const porNumero = new Map(negocios.map((n) => [String(n.n), n]));
const recusadas = {};
let aplicadas = 0;

for (const [numero, texto] of Object.entries(recebidas)) {
  const negocio = porNumero.get(String(numero));
  const problema = negocio ? guardarMensagem(negocios, negocio, texto) : "esse número não existe na lista";
  if (problema) {
    recusadas[numero] = texto;
    console.log(`  nº ${numero}: não entrou, ${problema}`);
    continue;
  }
  aplicadas += 1;
}

gravarNegocios(negocios);
gravarJson(caminhos.mensagens, recusadas);

console.log(`\nMensagens guardadas: ${aplicadas}`);
const pendentes = Object.keys(recusadas).length;
if (pendentes) console.log(`Para corrigir: ${pendentes} (continuam em dados/mensagens.json)`);
console.log("");
