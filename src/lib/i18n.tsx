import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const LANGUAGES = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "ln", label: "Lingala" },
] as const;

export type LangCode = (typeof LANGUAGES)[number]["code"];

type Dict = Record<string, string>;

const fr: Dict = {
  settings: "Paramètres",
  profile: "Profil",
  storage: "Stockage",
  report: "Signaler un problème",
  appearance: "Apparence",
  language: "Langue de l'application",
  notifications: "Notifications",
  close: "Fermer",
  back: "Retour",
  save: "Enregistrer",
  submit: "Soumettre",
  subscription: "ABONNEMENT",
  application: "APPLICATION",
  brandSection: "SAM FLASH",
  data: "DONNÉES ET INFORMATIONS",
  haptics: "Haptique",
  customize: "Personnaliser Sam flash",
  skills: "Compétences",
  advanced: "Avancé",
  voiceMode: "Ouvrir l'application en mode vocal",
  alwaysOn: "Toujours activé",
  suggestion: "Suggestion",
  advancedMode: "Mode avancé",
  sharedChats: "Conversations partagées",
  dataControls: "Contrôles de données",
  rate: "Évaluer l'application",
  terms: "Conditions d'utilisation",
  privacy: "Politique de confidentialité",
  signOut: "Se déconnecter",
  credits: "crédits disponibles",
  fullName: "Nom complet",
  email: "E-mail",
  creditsLabel: "Crédits",
  changeAvatar: "Modifier",
  cache: "Cache de l'application",
  clearCache: "Vider le cache",
  imagesGenerated: "Images générées",
  videosGenerated: "Vidéos générées",
  creditsLeft: "Crédits restants",
  rateTitle: "Votre avis compte",
  rateSub: "Attribuez une note à Sam flash 2.0",
  reviewPlaceholder: "Partagez votre expérience (facultatif)…",
  send: "Envoyer",
  cancel: "Annuler",
  thanks: "Merci pour votre évaluation !",
  saved: "Profil enregistré",
  saveError: "Enregistrement impossible",
  langChanged: "Langue mise à jour",
  tryPro: "Essayez Sam flash 2.0 Pro",
  tryProSub: "Premium Chat, Voix et Images",
  try: "Essayer",
};

const en: Dict = {
  settings: "Settings",
  profile: "Profile",
  storage: "Storage",
  report: "Report a problem",
  appearance: "Appearance",
  language: "App language",
  notifications: "Notifications",
  close: "Close",
  back: "Back",
  save: "Save",
  submit: "Submit",
  subscription: "SUBSCRIPTION",
  application: "APPLICATION",
  brandSection: "SAM FLASH",
  data: "DATA & INFORMATION",
  haptics: "Haptics",
  customize: "Customize Sam flash",
  skills: "Skills",
  advanced: "Advanced",
  voiceMode: "Open the app in voice mode",
  alwaysOn: "Always on",
  suggestion: "Suggestion",
  advancedMode: "Advanced mode",
  sharedChats: "Shared conversations",
  dataControls: "Data controls",
  rate: "Rate the app",
  terms: "Terms of use",
  privacy: "Privacy policy",
  signOut: "Sign out",
  credits: "credits available",
  fullName: "Full name",
  email: "Email",
  creditsLabel: "Credits",
  changeAvatar: "Change",
  cache: "App cache",
  clearCache: "Clear cache",
  imagesGenerated: "Generated images",
  videosGenerated: "Generated videos",
  creditsLeft: "Remaining credits",
  rateTitle: "Your opinion matters",
  rateSub: "Rate Sam flash 2.0",
  reviewPlaceholder: "Share your experience (optional)…",
  send: "Send",
  cancel: "Cancel",
  thanks: "Thanks for your rating!",
  saved: "Profile saved",
  saveError: "Could not save",
  langChanged: "Language updated",
  tryPro: "Try Sam flash 2.0 Pro",
  tryProSub: "Premium Chat, Voice and Images",
  try: "Try",
};

const es: Dict = {
  ...en,
  settings: "Ajustes",
  profile: "Perfil",
  storage: "Almacenamiento",
  report: "Informar de un problema",
  appearance: "Apariencia",
  language: "Idioma de la aplicación",
  notifications: "Notificaciones",
  close: "Cerrar",
  back: "Volver",
  save: "Guardar",
  submit: "Enviar",
  subscription: "SUSCRIPCIÓN",
  application: "APLICACIÓN",
  data: "DATOS E INFORMACIÓN",
  haptics: "Háptica",
  customize: "Personalizar Sam flash",
  skills: "Habilidades",
  advanced: "Avanzado",
  voiceMode: "Abrir la aplicación en modo voz",
  alwaysOn: "Siempre activo",
  suggestion: "Sugerencia",
  advancedMode: "Modo avanzado",
  sharedChats: "Conversaciones compartidas",
  dataControls: "Control de datos",
  rate: "Valorar la aplicación",
  terms: "Términos de uso",
  privacy: "Política de privacidad",
  signOut: "Cerrar sesión",
  credits: "créditos disponibles",
  fullName: "Nombre completo",
  email: "Correo",
  creditsLabel: "Créditos",
  changeAvatar: "Modificar",
  cache: "Caché de la aplicación",
  clearCache: "Vaciar caché",
  imagesGenerated: "Imágenes generadas",
  videosGenerated: "Vídeos generados",
  creditsLeft: "Créditos restantes",
  rateTitle: "Tu opinión importa",
  rateSub: "Valora Sam flash 2.0",
  send: "Enviar",
  cancel: "Cancelar",
  thanks: "¡Gracias por tu valoración!",
  saved: "Perfil guardado",
  saveError: "No se pudo guardar",
  langChanged: "Idioma actualizado",
};

const ln: Dict = {
  ...fr,
  settings: "Bibongisi",
  profile: "Profil",
  storage: "Ebombelo",
  appearance: "Bomonani",
  language: "Monoko ya application",
  save: "Kobomba",
  close: "Kokanga",
  back: "Kozonga",
  signOut: "Kobima",
  rate: "Kopesa note na application",
  terms: "Mibeko ya kosalela",
  privacy: "Politiki ya bosekseki",
  alwaysOn: "Efungwami ntango nyonso",
  suggestion: "Likanisi",
  advancedMode: "Mode ya likolo",
  thanks: "Matondi mpo na note na yo!",
  saved: "Profil ebombami",
  langChanged: "Monoko ebongwani",
};

// Additional app-wide strings (studio, prompt bar, settings panels)
const extraFr: Dict = {
  subscriptionBtn: "Abonnement",
  quotaToday: "Quota du jour",
  unlimited: "Générations illimitées sur votre offre.",
  myCreations: "Mes créations",
  gallery: "Galerie",
  refresh: "Actualiser",
  emptyFeed: "Aucune création pour l'instant. Décrivez votre idée ci-dessous.",
  processing: "Génération en cours…",
  shareGallery: "Proposer à la galerie communautaire",
  shareOk: "Création proposée à la galerie — en attente de modération",
  shareErr: "Impossible de proposer cette création",
  openSettings: "Ouvrir les paramètres",
  seePlans: "Voir les abonnements",
  promptPlaceholder: "Décrivez votre idée…",
  enhance: "Optimiser le prompt",
  enhancing: "Optimisation magique…",
  enhanceDone: "Prompt optimisé",
  enhanceFail: "Optimisation impossible",
  image: "Image",
  video: "Vidéo",
  genDone: "Génération terminée",
  genFail: "Génération impossible",
  quotaReached: "Quota journalier atteint",
  customizeSub: "Réglez le ton, le style et la mémoire de Sam flash.",
  skillsSub: "Activez les modules disponibles pour vos générations.",
  advancedSub: "Options destinées aux utilisateurs expérimentés.",
  tone: "Ton créatif",
  autoEnhance: "Améliorer automatiquement les prompts",
  memory: "Mémoire des conversations",
  skillImage: "Génération d'images",
  skillVideo: "Génération de vidéos",
  skillTranslate: "Traduction automatique",
  skillIdeas: "Suggestions d'idées",
  advBeta: "Fonctionnalités bêta",
  advHighQuality: "Rendu haute qualité",
  advDebug: "Journal technique",
  optionSaved: "Option enregistrée",
  themeSystem: "Système",
  renderingVideo: "Rendu vidéo…",
  renderingImage: "Rendu image…",
  download: "Télécharger",
  downloadOk: "Téléchargement lancé",
  subtitles: "Sous-titres",
  subsOk: "Sous-titres ajoutés",
  subsFail: "Sous-titres impossibles",
  toVideo: "En vidéo",
  regenerate: "Régénérer",
  openMedia: "Ouvrir la création",
};


const extraEn: Dict = {
  subscriptionBtn: "Subscription",
  quotaToday: "Today's quota",
  unlimited: "Unlimited generations on your plan.",
  myCreations: "My creations",
  gallery: "Gallery",
  refresh: "Refresh",
  emptyFeed: "No creation yet. Describe your idea below.",
  processing: "Generating…",
  shareGallery: "Submit to the community gallery",
  shareOk: "Creation submitted — awaiting moderation",
  shareErr: "Could not submit this creation",
  openSettings: "Open settings",
  seePlans: "See plans",
  promptPlaceholder: "Describe your idea…",
  enhance: "Enhance prompt",
  enhancing: "Magic enhancing…",
  enhanceDone: "Prompt enhanced",
  enhanceFail: "Enhancement failed",
  image: "Image",
  video: "Video",
  genDone: "Generation complete",
  genFail: "Generation failed",
  quotaReached: "Daily quota reached",
  customizeSub: "Set the tone, style and memory of Sam flash.",
  skillsSub: "Enable the modules available for your generations.",
  advancedSub: "Options for experienced users.",
  tone: "Creative tone",
  autoEnhance: "Auto-enhance prompts",
  memory: "Conversation memory",
  skillImage: "Image generation",
  skillVideo: "Video generation",
  skillTranslate: "Automatic translation",
  skillIdeas: "Idea suggestions",
  advBeta: "Beta features",
  advHighQuality: "High quality rendering",
  advDebug: "Technical log",
  optionSaved: "Option saved",
  themeSystem: "System",
  renderingVideo: "Rendering video…",
  renderingImage: "Rendering image…",
  download: "Download",
  downloadOk: "Download started",
  subtitles: "Subtitles",
  subsOk: "Subtitles added",
  subsFail: "Could not create subtitles",
  toVideo: "To video",
  regenerate: "Regenerate",
  openMedia: "Open creation",
};


const extraEs: Dict = {
  ...extraEn,
  subscriptionBtn: "Suscripción",
  quotaToday: "Cuota de hoy",
  unlimited: "Generaciones ilimitadas en tu plan.",
  myCreations: "Mis creaciones",
  gallery: "Galería",
  refresh: "Actualizar",
  emptyFeed: "Aún no hay creaciones. Describe tu idea abajo.",
  processing: "Generando…",
  promptPlaceholder: "Describe tu idea…",
  enhance: "Optimizar el prompt",
  enhancing: "Optimización mágica…",
  enhanceDone: "Prompt optimizado",
  enhanceFail: "No se pudo optimizar",
  video: "Vídeo",
  genDone: "Generación completada",
  genFail: "No se pudo generar",
  quotaReached: "Cuota diaria alcanzada",
  optionSaved: "Opción guardada",
  themeSystem: "Sistema",
};

const extraLn: Dict = {
  ...extraFr,
  myCreations: "Bikela na ngai",
  gallery: "Galerie",
  refresh: "Kobongisa",
  promptPlaceholder: "Loba likanisi na yo…",
  enhance: "Kobongisa prompt",
  enhancing: "Kobongisa…",
  enhanceDone: "Prompt ebongisami",
  enhanceFail: "Ekoki kobongisama te",
  video: "Video",
  image: "Elilingi",
  genDone: "Esili kosalema",
  genFail: "Ekoki kosalema te",
  optionSaved: "Ebombami",
  themeSystem: "Système",
};

const DICTS: Record<LangCode, Dict> = {
  fr: { ...fr, ...extraFr },
  en: { ...en, ...extraEn },
  es: { ...es, ...extraEs },
  ln: { ...ln, ...extraLn },
};

type I18nValue = {
  lang: LangCode;
  setLang: (l: LangCode) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

const STORAGE_KEY = "samflash.lang";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LangCode>("fr");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as LangCode | null;
    if (stored && stored in DICTS) setLangState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: LangCode) => {
    setLangState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      setLang,
      t: (key: string) => DICTS[lang][key] ?? DICTS.fr[key] ?? key,
    }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
