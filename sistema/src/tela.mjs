/**
 * Abre a tela da prospeccao no navegador. A tela e opcional: tudo o que ela faz, os
 * comandos tambem fazem. Ela serve para a pessoa ver os leads e para ler o QR Code.
 *
 *   npm run tela             abre (liga a tela, se ainda nao estiver ligada)
 *   npm run tela -- fechar   desliga a tela, e com ela a conexao e o envio
 *
 * A tela roda solta, em segundo plano, e este comando termina logo: quem roda e a IA, e
 * o terminal dela nao pode ficar preso. Fechar o terminal nao fecha a tela nem o envio.
 */
import { ENDERECO, abrirNoNavegador, garantirTela, mandar, rodar, situacaoDaTela } from "./lib/cliente.mjs";

await rodar(async () => {
  if (process.argv[2] === "fechar") {
    if ((await situacaoDaTela()) !== "ligada") return "A tela já estava fechada.";
    await mandar("/api/fechar");
    // Espera ela sair de verdade: abrir logo em seguida encontraria a antiga ainda de pe.
    for (let i = 0; i < 25 && (await situacaoDaTela()) !== "desligada"; i++) await new Promise((r) => setTimeout(r, 200));
    return "Tela fechada. O número continua conectado: é só abrir a tela de novo.";
  }
  await garantirTela();
  abrirNoNavegador();
  return `A tela está em ${ENDERECO} (abri no navegador).\nEla continua aberta mesmo com o terminal fechado. Para desligar: npm run tela -- fechar`;
});
