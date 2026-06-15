/** Rôles applicatifs pour le contrôle d'accès basé sur les rôles (RolesGuard). */
export enum Role {
  /** Utilisateur standard (peut réserver, discuter, signaler…). */
  Client = 'client',
  /** Utilisateur disposant d'un profil prestataire (`user.providerId`). */
  Provider = 'provider',
}
