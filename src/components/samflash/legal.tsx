export type LegalDoc = { title: string; updated: string; sections: { h: string; p: string[] }[] };

export const TERMS: LegalDoc = {
  title: "Conditions Générales d'Utilisation",
  updated: "Dernière mise à jour : 22 août 2026",
  sections: [
    {
      h: "1. Objet",
      p: [
        "Les présentes Conditions Générales d'Utilisation (« CGU ») régissent l'accès et l'utilisation de l'application « Sam flash 2.0 powered by xia Grok » (le « Service »), plateforme de génération de contenus (images et vidéos) assistée par intelligence artificielle.",
        "Toute création de compte ou utilisation du Service vaut acceptation pleine et entière des présentes CGU.",
      ],
    },
    {
      h: "2. Accès au Service et compte",
      p: [
        "L'accès nécessite la création d'un compte via une adresse e-mail valide ou un fournisseur d'identité tiers (Google). Vous devez avoir au moins 16 ans, ou disposer de l'autorisation de votre représentant légal.",
        "Vous êtes responsable de la confidentialité de vos identifiants et de toute activité effectuée depuis votre compte. Prévenez-nous immédiatement en cas d'utilisation non autorisée.",
      ],
    },
    {
      h: "3. Abonnements, crédits et quotas",
      p: [
        "Le Service propose une offre gratuite ainsi que des abonnements payants (Super Grok, Superhearly). Chaque formule ouvre droit à un quota quotidien de génération exprimé en secondes, ainsi qu'à un solde de crédits.",
        "Les quotas se réinitialisent chaque jour à 00h00 UTC. Les crédits achetés sont valables tant que le compte reste actif. Les abonnements sont reconductibles selon la périodicité choisie et peuvent être résiliés à tout moment ; la résiliation prend effet à la fin de la période en cours.",
        "Sauf disposition légale impérative contraire, les sommes déjà réglées pour une période entamée ne sont pas remboursables.",
      ],
    },
    {
      h: "4. Utilisation acceptable",
      p: [
        "Il est interdit d'utiliser le Service pour générer ou diffuser des contenus illicites, haineux, diffamatoires, violents, pédopornographiques, portant atteinte à la vie privée, à l'image ou aux droits de propriété intellectuelle de tiers, ou destinés à tromper (deepfakes malveillants, usurpation d'identité, désinformation).",
        "Il est également interdit de contourner les quotas, de procéder à des accès automatisés non autorisés, d'effectuer de la rétro-ingénierie ou de perturber l'infrastructure du Service.",
        "Tout manquement peut entraîner la suspension ou la suppression immédiate du compte, sans remboursement.",
      ],
    },
    {
      h: "5. Propriété des contenus",
      p: [
        "Vous conservez les droits sur les instructions (« prompts ») que vous soumettez. Dans la limite permise par la loi applicable, vous disposez d'un droit d'exploitation, y compris commercial, sur les contenus générés depuis votre compte.",
        "Vous garantissez disposer des droits nécessaires sur tout contenu que vous téléversez et vous nous garantissez contre tout recours de tiers lié à vos usages.",
      ],
    },
    {
      h: "6. Disponibilité et évolution",
      p: [
        "Le Service est fourni « en l'état ». Nous nous efforçons d'assurer sa disponibilité mais ne garantissons ni continuité absolue, ni absence d'erreur, les modèles d'IA pouvant produire des résultats inexacts ou inattendus.",
        "Nous pouvons faire évoluer, suspendre ou interrompre tout ou partie des fonctionnalités, notamment en cas de maintenance ou de contrainte imposée par nos fournisseurs de modèles.",
      ],
    },
    {
      h: "7. Responsabilité",
      p: [
        "Notre responsabilité est limitée aux dommages directs et prévisibles, et plafonnée au montant effectivement payé par vous au cours des douze (12) derniers mois. Nous ne saurions être tenus responsables des usages que vous faites des contenus générés.",
      ],
    },
    {
      h: "8. Droit applicable et contact",
      p: [
        "Les présentes CGU sont soumises au droit applicable au lieu d'établissement de l'éditeur. En cas de litige, une solution amiable sera recherchée en priorité.",
        "Contact : support@samflash.app",
      ],
    },
  ],
};

export const PRIVACY: LegalDoc = {
  title: "Politique de confidentialité",
  updated: "Dernière mise à jour : 22 août 2026",
  sections: [
    {
      h: "1. Responsable du traitement",
      p: [
        "L'éditeur de « Sam flash 2.0 powered by xia Grok » est responsable du traitement des données personnelles collectées via l'application. Contact : privacy@samflash.app",
      ],
    },
    {
      h: "2. Données collectées",
      p: [
        "Données de compte : adresse e-mail, nom complet, photo de profil, identifiant technique.",
        "Données d'usage : prompts soumis, contenus générés, type de média, résolution, durée, ratio, secondes consommées, date de génération.",
        "Données de facturation : formule d'abonnement, statut, dates de début et de fin, solde de crédits. Les données de carte ou de portefeuille mobile sont traitées exclusivement par le prestataire de paiement.",
        "Données techniques : journaux de connexion et informations d'appareil nécessaires à la sécurité.",
      ],
    },
    {
      h: "3. Finalités et bases légales",
      p: [
        "Fourniture du Service et exécution du contrat : authentification, génération de contenus, gestion des quotas et des abonnements.",
        "Intérêt légitime : sécurité, prévention de la fraude et des abus, amélioration de la qualité du Service.",
        "Obligation légale : conservation des justificatifs comptables.",
        "Consentement : communications marketing et notifications facultatives, révocables à tout moment.",
      ],
    },
    {
      h: "4. Sous-traitants et transferts",
      p: [
        "Hébergement, base de données, authentification et stockage : Supabase. Génération de contenus : fournisseurs de modèles d'IA (dont xAI/Grok et la passerelle IA de Lovable). Paiements : prestataire de paiement mobile et bancaire.",
        "Certains prestataires peuvent être situés hors de votre pays de résidence ; les transferts sont alors encadrés par des garanties contractuelles appropriées.",
      ],
    },
    {
      h: "5. Durées de conservation",
      p: [
        "Compte et contenus générés : conservés tant que le compte est actif, puis supprimés dans les 30 jours suivant sa suppression.",
        "Journaux techniques : 12 mois maximum. Documents comptables : durée légale applicable.",
      ],
    },
    {
      h: "6. Sécurité",
      p: [
        "Les données sont chiffrées en transit (TLS) et au repos. L'accès aux données est cloisonné par utilisateur au moyen de politiques de sécurité au niveau des lignes (RLS) ; vos fichiers sont stockés dans des espaces privés accessibles uniquement via des liens signés temporaires.",
      ],
    },
    {
      h: "7. Vos droits",
      p: [
        "Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité, ainsi que du droit de retirer votre consentement à tout moment.",
        "Ces droits s'exercent depuis les paramètres de l'application ou en écrivant à privacy@samflash.app. Vous pouvez également introduire une réclamation auprès de l'autorité de protection des données compétente.",
      ],
    },
    {
      h: "8. Mineurs et cookies",
      p: [
        "Le Service n'est pas destiné aux enfants de moins de 16 ans. L'application utilise uniquement des stockages locaux techniques (session, préférences de langue et d'affichage) nécessaires à son fonctionnement.",
      ],
    },
  ],
};

export function LegalView({ doc }: { doc: LegalDoc }) {
  return (
    <div className="pt-6">
      <div className="rounded-2xl bg-card p-5">
        <h2 className="text-xl font-semibold">{doc.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{doc.updated}</p>
      </div>
      <div className="mt-4 space-y-4">
        {doc.sections.map((s) => (
          <section key={s.h} className="rounded-2xl bg-card p-5">
            <h3 className="font-semibold">{s.h}</h3>
            {s.p.map((para, i) => (
              <p key={i} className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
                {para}
              </p>
            ))}
          </section>
        ))}
      </div>
      <p className="py-8 text-center text-sm text-muted-foreground/60">
        sam flash 2.0 powered by xia Grok
      </p>
    </div>
  );
}
