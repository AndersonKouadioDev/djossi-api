/**
 * Normalise un numéro ivoirien vers la forme locale à 10 chiffres "0XXXXXXXXX".
 * Accepte : espaces/tirets/points, préfixe +225 ou 00225.
 * Retourne null si le numéro n'est pas un mobile CI valide (0[157]XXXXXXXX).
 */
export function normalizePhone(raw: string): string | null {
  let digits = raw.replace(/[\s.-]/g, '');
  if (digits.startsWith('+225')) digits = digits.slice(4);
  else if (digits.startsWith('00225')) digits = digits.slice(5);
  else if (digits.startsWith('225') && digits.length === 13)
    digits = digits.slice(3);
  if (!/^0[157]\d{8}$/.test(digits)) return null;
  return digits;
}
