/**
 * Telefones do Brasil. Guardamos sempre so digitos, com o 55 na frente (5588999990000).
 */

/** Devolve o numero com 55, ou null quando nao serve para WhatsApp (0800, 4004, incompleto). */
export function normalizar(bruto) {
  if (!bruto) return null;
  // Numero de outro pais: o Maps escreve com o codigo na frente (+1, +351).
  if (/^\s*\+(?!55)/.test(String(bruto))) return null;
  let digitos = String(bruto).replace(/\D/g, "");
  if (!digitos) return null;

  // Numero nacional escrito com o zero da operadora na frente: (088) 3611-0000.
  if (!digitos.startsWith("55") && digitos.startsWith("0") && !digitos.startsWith("0800")) {
    digitos = digitos.slice(1);
  }
  if (digitos.startsWith("0800") || digitos.startsWith("0300") || digitos.startsWith("4004")) {
    return null;
  }
  if (digitos.length === 10 || digitos.length === 11) digitos = `55${digitos}`;
  if (!digitos.startsWith("55")) return null;
  if (digitos.length !== 12 && digitos.length !== 13) return null;
  return digitos;
}

/** Celular tem 9 digitos depois do DDD, comecando por 9. */
export function ehCelular(numero) {
  return Boolean(numero) && numero.length === 13 && numero[4] === "9";
}

/**
 * As duas formas em que o mesmo celular pode existir no WhatsApp: com e sem o 9.
 * Conta antiga, comum fora de Sao Paulo, ficou registrada sem o 9. Mandar para a forma
 * que nao existe nao da erro: a mensagem some.
 */
export function variantes(numero) {
  if (!numero) return [];
  if (numero.length === 13 && numero[4] === "9") {
    return [numero, numero.slice(0, 4) + numero.slice(5)];
  }
  if (numero.length === 12 && /[6-9]/.test(numero[4])) {
    return [numero, `${numero.slice(0, 4)}9${numero.slice(4)}`];
  }
  return [numero];
}

/** (88) 99999-0000, para a pessoa ler. */
export function exibir(numero) {
  if (!numero) return "";
  const ddd = numero.slice(2, 4);
  const resto = numero.slice(4);
  const meio = resto.length === 9 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, meio)}-${resto.slice(meio)}`;
}
