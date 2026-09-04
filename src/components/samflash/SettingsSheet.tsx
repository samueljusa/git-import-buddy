import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type Preferences } from "@/hooks/useAuth";
import { PlansSheet } from "@/components/samflash/PlansSheet";
import { LegalView, TERMS, PRIVACY } from "@/components/samflash/legal";
import { LANGUAGES, useI18n, type LangCode } from "@/lib/i18n";
import { THEMES, useTheme, type ThemeName } from "@/lib/theme";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Contrast,
  Vibrate,
  Bell,
  Globe,
  SlidersHorizontal,
  Boxes,
  Atom,
  Link2,
  Database,
  FolderClosed,
  Star,
  BookOpen,
  ShieldCheck,
  LifeBuoy,
  LogOut,
  Bug,
  MessageSquare,
  MessageSquareWarning,
  Check,
  Trash2,
  User,
  Loader2,
} from "lucide-react";
import { playChime } from "@/lib/chime";
import { useServerFn } from "@tanstack/react-start";
import { getAdminAccess } from "@/lib/admin.functions";
import {
  createSupportMessage,
  listSupportMessages,
  listSupportReplies,
  replyToSupportMessage,
  type SupportMessage,
  type SupportReply,
} from "@/lib/support.functions";

type View =
  | "root"
  | "profile"
  | "storage"
  | "feedback"
  | "appearance"
  | "language"
  | "notifications"
  | "terms"
  | "privacy"
  | "generic";

const rowBase =
  "flex w-full items-center gap-3 px-4 py-3.5 text-left text-[17px] text-foreground transition-colors active:bg-accent";

function Group({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-card divide-y divide-border">{children}</div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  onClick,
  danger,
  trailing,
}: {
  icon?: React.ElementType | undefined;
  label: string;
  value?: string | undefined;
  onClick?: (() => void) | undefined;
  danger?: boolean | undefined;
  trailing?: React.ReactNode | undefined;
}) {
  return (
    <button type="button" onClick={onClick} className={rowBase}>
      {Icon ? (
        <Icon
          className={`h-5 w-5 shrink-0 ${danger ? "text-destructive" : "text-muted-foreground"}`}
        />
      ) : null}
      <span className={danger ? "text-destructive" : undefined}>{label}</span>
      <span className="ml-auto flex items-center gap-2 text-muted-foreground">
        {value ? <span className="text-[15px]">{value}</span> : null}
        {trailing ?? <ChevronRight className="h-5 w-5" />}
      </span>
    </button>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-4 pb-2 pt-6 text-xs font-semibold tracking-widest text-muted-foreground">
      {children}
    </h2>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <span
      role="switch"
      aria-checked={on}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!on);
      }}
      className={`inline-flex h-7 w-12 cursor-pointer items-center rounded-full p-1 transition-colors ${
        on ? "bg-primary" : "bg-secondary"
      }`}
    >
      <span
        className={`h-5 w-5 rounded-full bg-foreground transition-transform ${
          on ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </span>
  );
}


export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<View>("root");
  const [plansOpen, setPlansOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [genericTitle, setGenericTitle] = useState("Réglage");
  const [genericKey, setGenericKey] = useState<"customize" | "skills" | "advanced" | "other">("other");
  const [feedbackType, setFeedbackType] = useState("Commentaires généraux");
  const [feedbackText, setFeedbackText] = useState("");
  const [cache, setCache] = useState(248);
  const [toast, setToast] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, profile, refreshProfile, signOut } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const [fullName, setFullName] = useState("");
  const [counts, setCounts] = useState({ image: 0, video: 0 });
  const [prefs, setPrefs] = useState<Preferences>({});
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchAccess = useServerFn(getAdminAccess);
  const fetchTickets = useServerFn(listSupportMessages);
  const fetchReplies = useServerFn(listSupportReplies);
  const submitSupport = useServerFn(createSupportMessage);
  const submitReply = useServerFn(replyToSupportMessage);

  const [isStaff, setIsStaff] = useState(false);
  const [tickets, setTickets] = useState<SupportMessage[]>([]);
  const [replies, setReplies] = useState<SupportReply[]>([]);
  const [openTicketId, setOpenTicketId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [supportBusy, setSupportBusy] = useState(false);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

  useEffect(() => {
    if (!user) return;
    void fetchAccess()
      .then((a) => setIsStaff(a.isStaff))
      .catch(() => setIsStaff(false));
  }, [user, fetchAccess]);

  const loadTickets = async () => {
    try {
      setTickets(await fetchTickets());
    } catch {
      setTickets([]);
    }
  };

  useEffect(() => {
    if (view !== "feedback") return;
    void loadTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const openTicket = async (id: string) => {
    if (openTicketId === id) {
      setOpenTicketId(null);
      return;
    }
    setOpenTicketId(id);
    setReplyText("");
    try {
      setReplies(await fetchReplies({ data: { messageId: id } }));
    } catch {
      setReplies([]);
    }
  };

  const sendReport = async () => {
    setSupportBusy(true);
    try {
      const res = await submitSupport({
        data: { subject: feedbackType, body: feedbackText.trim() },
      });
      playChime(res.ok ? "success" : "error");
      flash(res.message);
      if (res.ok) {
        setFeedbackText("");
        await loadTickets();
      }
    } catch {
      playChime("error");
      flash("Envoi impossible.");
    }
    setSupportBusy(false);
  };

  const sendReply = async (messageId: string) => {
    setSupportBusy(true);
    try {
      const res = await submitReply({ data: { messageId, body: replyText.trim() } });
      playChime(res.ok ? "success" : "error");
      flash(res.message);
      if (res.ok) {
        setReplyText("");
        setReplies(await fetchReplies({ data: { messageId } }));
      }
    } catch {
      flash("Réponse impossible.");
    }
    setSupportBusy(false);
  };

  useEffect(() => {
    setFullName(profile?.full_name ?? "");
    setPrefs(profile?.preferences ?? {});
  }, [profile?.full_name, profile?.preferences]);

  // Restore the saved theme/language from the account so they follow the user.
  useEffect(() => {
    const savedTheme = profile?.preferences?.theme;
    if (savedTheme && (THEMES as readonly string[]).includes(savedTheme) && savedTheme !== theme) {
      setTheme(savedTheme as ThemeName);
    }
    const savedLang = profile?.preferences?.lang;
    if (savedLang && savedLang !== lang && LANGUAGES.some((l) => l.code === savedLang)) {
      setLang(savedLang as LangCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.preferences?.theme, profile?.preferences?.lang]);

  useEffect(() => {
    const path = profile?.avatar_url;
    if (!path) {
      setAvatarUrl(null);
      return;
    }
    if (path.startsWith("http")) {
      setAvatarUrl(path);
      return;
    }
    void supabase.storage
      .from("avatars")
      .createSignedUrl(path, 3600)
      .then(({ data }) => setAvatarUrl(data?.signedUrl ?? null));
  }, [profile?.avatar_url]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await supabase
        .from("generations")
        .select("media_type")
        .eq("user_id", user.id);
      const rows = data ?? [];
      setCounts({
        image: rows.filter((r) => r.media_type === "image").length,
        video: rows.filter((r) => r.media_type === "video").length,
      });
    })();
  }, [user]);

  const savePrefs = async (patch: Preferences) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    if (!user) return;
    await supabase.from("profiles").update({ preferences: next }).eq("id", user.id);
    await refreshProfile();
  };

  const saveProfile = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", user.id);
    if (error) {
      flash(t("saveError"));
      return;
    }
    await refreshProfile();
    flash(t("saved"));
    setView("root");
  };

  const uploadAvatar = async (file: File) => {
    if (!user) return;
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/avatar-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (!error) {
      await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
      await refreshProfile();
      flash(t("saved"));
    } else {
      flash(t("saveError"));
    }
    setUploading(false);
  };

  const openGeneric = (title: string, key: "customize" | "skills" | "advanced" | "other" = "other") => {
    setGenericTitle(title);
    setGenericKey(key);
    setView("generic");
  };

  const options = prefs.options ?? {};
  const optionOn = (key: string, fallback = false) => options[key] ?? fallback;
  const setOption = (key: string, value: boolean) => {
    void savePrefs({ options: { ...options, [key]: value } });
    flash(t("optionSaved"));
  };

  const title =
    view === "root"
      ? t("settings")
      : view === "profile"
        ? t("profile")
        : view === "storage"
          ? t("storage")
          : view === "feedback"
            ? t("report")
            : view === "appearance"
              ? t("appearance")
              : view === "language"
                ? t("language")
                : view === "notifications"
                  ? t("notifications")
                  : view === "terms"
                    ? t("terms")
                    : view === "privacy"
                      ? t("privacy")
                      : genericTitle;

  const notif = prefs.notifications ?? {};

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background animate-fade-in">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur-xl">
        <button
          type="button"
          aria-label={view === "root" ? t("close") : t("back")}
          onClick={() => (view === "root" ? onClose() : setView("root"))}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-foreground"
        >
          {view === "root" ? <X className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
        <h1 className="flex-1 text-center text-[17px] font-semibold">{title}</h1>
        {view === "feedback" ? (
          <button
            type="button"
            onClick={() => {
              flash("Merci, votre retour a été envoyé");
              setFeedbackText("");
              setView("root");
            }}
            className="rounded-full bg-secondary px-4 py-2 text-sm font-medium text-foreground"
          >
            {t("submit")}
          </button>
        ) : view === "profile" ? (
          <button
            type="button"
            onClick={() => void saveProfile()}
            className="text-sm font-medium text-muted-foreground"
          >
            {t("save")}
          </button>
        ) : (
          <span className="w-10" />
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-16">
        {view === "root" && (
          <>
            <button
              type="button"
              onClick={() => setView("profile")}
              className="mt-4 flex w-full items-center gap-4 rounded-2xl bg-card p-4 text-left"
            >
              <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-secondary">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-8 w-8 text-muted-foreground" />
                )}
              </span>
              <span>
                <span className="block text-xl font-semibold">
                  {profile?.full_name || user?.email?.split("@")[0] || "Mon compte"}
                </span>
                <span className="block text-muted-foreground">
                  {profile?.email ?? user?.email ?? ""}
                </span>
              </span>
              <ChevronRight className="ml-auto h-5 w-5 text-muted-foreground" />
            </button>

            <SectionTitle>{t("subscription")}</SectionTitle>
            <button
              type="button"
              onClick={() => setPlansOpen(true)}
              className="flex w-full items-center gap-3 rounded-full bg-primary p-3 text-left"
              style={{ boxShadow: "var(--shadow-glow)" }}
            >
              <Atom className="h-7 w-7 text-primary-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-primary-foreground">
                  {t("tryPro")}
                </span>
                <span className="block truncate text-sm text-primary-foreground/80">
                  {t("tryProSub")}
                </span>
              </span>
              <span className="shrink-0 rounded-full border border-primary-foreground/40 px-4 py-2 text-sm text-primary-foreground">
                {t("try")}
              </span>
            </button>

            <SectionTitle>{t("application")}</SectionTitle>
            <Group>
              <Row
                icon={Contrast}
                label={t("appearance")}
                value={theme}
                onClick={() => setView("appearance")}
              />
              <Row
                icon={Vibrate}
                label={t("haptics")}
                trailing={
                  <Toggle
                    on={prefs.haptics ?? true}
                    onChange={(v) => void savePrefs({ haptics: v })}
                  />
                }
              />
              <Row
                icon={Bell}
                label={t("notifications")}
                onClick={() => setView("notifications")}
              />
              <Row
                icon={Globe}
                label={t("language")}
                value={LANGUAGES.find((l) => l.code === lang)?.label ?? ""}
                onClick={() => setView("language")}
              />
            </Group>

            <SectionTitle>{t("brandSection")}</SectionTitle>
            <Group>
              <Row
                icon={SlidersHorizontal}
                label={t("customize")}
                onClick={() => openGeneric(t("customize"), "customize")}
              />
              <Row icon={Boxes} label={t("skills")} onClick={() => openGeneric(t("skills"), "skills")} />
              <Row icon={Atom} label={t("advanced")} onClick={() => openGeneric(t("advanced"), "advanced")} />
            </Group>

            <SectionTitle>{t("data")}</SectionTitle>
            <Group>
              <Row
                icon={Link2}
                label={t("sharedChats")}
                onClick={() => openGeneric(t("sharedChats"))}
              />
              <Row
                icon={Database}
                label={t("dataControls")}
                onClick={() => openGeneric(t("dataControls"))}
              />
              <Row icon={FolderClosed} label={t("storage")} onClick={() => setView("storage")} />
            </Group>

            <div className="mt-6">
              <Group>
                <Row
                  icon={Star}
                  label={t("rate")}
                  value={prefs.rating ? `${prefs.rating}/5` : ""}
                  trailing={<ChevronRight className="h-5 w-5" />}
                  onClick={() => setRateOpen(true)}
                />
                <Row icon={BookOpen} label={t("terms")} onClick={() => setView("terms")} />
                <Row icon={ShieldCheck} label={t("privacy")} onClick={() => setView("privacy")} />
              </Group>
            </div>

            <div className="mt-6">
              <Group>
                {isStaff && (
                  <Row
                    icon={ShieldCheck}
                    label="Bureau d'administration"
                    value="Équipe"
                    onClick={() => {
                      onClose();
                      void navigate({ to: "/admin" });
                    }}
                  />
                )}
                <Row icon={LifeBuoy} label={t("report")} onClick={() => setView("feedback")} />
              </Group>
            </div>

            <div className="mt-6">
              <Group>
                <Row
                  icon={LogOut}
                  label={t("signOut")}
                  danger
                  trailing={<span />}
                  onClick={() => {
                    void signOut().then(() => {
                      onClose();
                      void navigate({ to: "/" });
                    });
                  }}
                />
              </Group>
            </div>

            <p className="py-8 text-center text-sm text-muted-foreground/60">
              sam flash 2.0 powered by xia Grok
              <br />
              VERSION 2.0.0 (BUILD 4426)
            </p>
          </>
        )}

        {view === "profile" && (
          <div className="pt-6">
            <div className="flex flex-col items-center gap-3">
              <span className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-secondary">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-14 w-14 text-muted-foreground" />
                )}
              </span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadAvatar(f);
                }}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1 rounded-full bg-secondary px-4 py-2 font-semibold disabled:opacity-60"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("changeAvatar")} <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-8 overflow-hidden rounded-2xl bg-card divide-y divide-border">
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder={t("fullName")}
                className="w-full bg-transparent px-4 py-4 text-[17px] outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="mt-6 overflow-hidden rounded-2xl bg-card divide-y divide-border">
              <div className="flex px-4 py-4">
                {t("email")}
                <span className="ml-auto text-muted-foreground">
                  {profile?.email ?? user?.email ?? "—"}
                </span>
              </div>
            </div>
            <p className="mt-3 px-1 text-sm text-muted-foreground">
              Connecté en tant que {user?.email ?? "invité"}.
            </p>
          </div>
        )}

        {view === "storage" && (
          <div className="pt-6">
            <div className="rounded-2xl bg-card p-5">
              <p className="text-sm text-muted-foreground">{t("cache")}</p>
              <p className="mt-1 text-4xl font-semibold">{cache} Mo</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, (cache / 500) * 100)}%` }}
                />
              </div>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl bg-card divide-y divide-border">
              <div className="flex px-4 py-4">
                {t("imagesGenerated")}{" "}
                <span className="ml-auto text-muted-foreground">{counts.image}</span>
              </div>
              <div className="flex px-4 py-4">
                {t("videosGenerated")}{" "}
                <span className="ml-auto text-muted-foreground">{counts.video}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setCache(0);
                flash("Cache vidé");
              }}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-card px-4 py-4 font-medium text-destructive"
            >
              <Trash2 className="h-5 w-5" /> {t("clearCache")}
            </button>
          </div>
        )}

        {view === "feedback" && (
          <div className="pt-4">
            <div className="flex items-center gap-4 rounded-2xl bg-card p-4">
              <Vibrate className="h-8 w-8 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-semibold">Secouer pour signaler</p>
                <p className="text-sm text-muted-foreground">
                  Secouez votre téléphone pour signaler un problème. Vous pouvez désactiver cette
                  fonction dans les réglages avancés.
                </p>
              </div>
            </div>
            <div className="mt-4 overflow-hidden rounded-2xl bg-card divide-y divide-border">
              {[
                { label: "Commentaires généraux", icon: MessageSquare },
                { label: "Signaler un problème ou un bug", icon: Bug },
                { label: "Sécurité des enfants", icon: ShieldCheck },
                { label: "Commentaire sur la réponse", icon: MessageSquareWarning },
              ].map((o) => (
                <button
                  key={o.label}
                  type="button"
                  onClick={() => setFeedbackType(o.label)}
                  className={rowBase}
                >
                  <o.icon className="h-5 w-5 text-muted-foreground" />
                  {o.label}
                  {feedbackType === o.label && <Check className="ml-auto h-5 w-5" />}
                </button>
              ))}
            </div>
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="Veuillez décrire votre problème..."
              className="mt-4 h-40 w-full resize-none rounded-2xl bg-card p-4 text-[17px] outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              disabled={supportBusy || feedbackText.trim().length < 5}
              onClick={() => void sendReport()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3.5 font-semibold text-primary-foreground disabled:opacity-50"
            >
              {supportBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageSquare className="h-4 w-4" />
              )}
              Envoyer au support
            </button>

            <SectionTitle>Mes signalements</SectionTitle>
            {tickets.length === 0 ? (
              <p className="px-1 pb-4 text-sm text-muted-foreground">
                Aucun signalement pour le moment. L'équipe vous répond directement ici.
              </p>
            ) : (
              <div className="space-y-3 pb-4">
                {tickets.map((ticket) => (
                  <div key={ticket.id} className="rounded-2xl bg-card p-4">
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 text-left"
                      onClick={() => void openTicket(ticket.id)}
                    >
                      <MessageSquareWarning className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{ticket.subject}</span>
                        <span className="block truncate text-sm text-muted-foreground">
                          {ticket.body}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground">
                        {ticket.status}
                      </span>
                    </button>

                    {openTicketId === ticket.id && (
                      <div className="mt-3 border-t border-border pt-3">
                        {replies.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Pas encore de réponse.</p>
                        ) : (
                          <ul className="space-y-2">
                            {replies.map((r) => (
                              <li
                                key={r.id}
                                className={`rounded-xl px-3 py-2 text-sm ${
                                  r.is_staff ? "bg-primary/15" : "bg-secondary"
                                }`}
                              >
                                <span className="block text-xs text-muted-foreground">
                                  {r.is_staff ? "Support" : "Vous"}
                                </span>
                                {r.body}
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="mt-3 flex gap-2">
                          <input
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Répondre…"
                            className="flex-1 rounded-xl bg-secondary px-3 py-2 text-sm outline-none"
                          />
                          <button
                            type="button"
                            aria-label="Envoyer la réponse"
                            disabled={supportBusy || replyText.trim().length === 0}
                            onClick={() => void sendReply(ticket.id)}
                            className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "appearance" && (
          <div className="pt-6">
            <Group>
              {THEMES.map((th) => (
                <button
                  key={th}
                  type="button"
                  onClick={() => {
                    setTheme(th as ThemeName);
                    void savePrefs({ theme: th });
                  }}
                  className={rowBase}
                >
                  {th === "Système" ? t("themeSystem") : th}
                  {theme === th && <Check className="ml-auto h-5 w-5" />}
                </button>
              ))}
            </Group>
          </div>
        )}

        {view === "language" && (
          <div className="pt-6">
            <Group>
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => {
                    setLang(l.code as LangCode);
                    void savePrefs({ lang: l.code });
                    flash(t("langChanged"));
                  }}
                  className={rowBase}
                >
                  {l.label}
                  {lang === l.code && <Check className="ml-auto h-5 w-5" />}
                </button>
              ))}
            </Group>
          </div>
        )}

        {view === "notifications" && (
          <div className="pt-6">
            <Group>
              {[
                { key: "push", label: "Notifications push" },
                { key: "done", label: "Réponses terminées" },
                { key: "news", label: "Nouveautés produit" },
                { key: "offers", label: "Offres Sam flash Pro" },
              ].map((n) => (
                <div key={n.key} className="flex items-center px-4 py-3.5 text-[17px]">
                  {n.label}
                  <span className="ml-auto">
                    <Toggle
                      on={notif[n.key] ?? false}
                      onChange={(v) => void savePrefs({ notifications: { ...notif, [n.key]: v } })}
                    />
                  </span>
                </div>
              ))}
            </Group>
          </div>
        )}

        {view === "terms" && <LegalView doc={TERMS} />}
        {view === "privacy" && <LegalView doc={PRIVACY} />}

        {view === "generic" && (
          <div className="pt-6">
            {genericKey === "customize" && (
              <>
                <p className="px-1 text-sm text-muted-foreground">{t("customizeSub")}</p>
                <div className="mt-4">
                  <Group>
                    <div className="px-4 py-3.5">
                      <span className="text-[17px]">{t("tone")}</span>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {["Naturel", "Cinématique", "Créatif", "Précis"].map((tone) => (
                          <button
                            key={tone}
                            type="button"
                            onClick={() => {
                              void savePrefs({ tone });
                              flash(t("optionSaved"));
                            }}
                            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                              (prefs.tone ?? "Naturel") === tone
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {tone}
                          </button>
                        ))}
                      </div>
                    </div>
                    <SettingToggle
                      label={t("autoEnhance")}
                      on={optionOn("autoEnhance", true)}
                      onChange={(v) => setOption("autoEnhance", v)}
                    />
                    <SettingToggle
                      label={t("memory")}
                      on={optionOn("memory", true)}
                      onChange={(v) => setOption("memory", v)}
                    />
                    <SettingToggle
                      label={t("voiceMode")}
                      on={optionOn("voiceMode")}
                      onChange={(v) => setOption("voiceMode", v)}
                    />
                  </Group>
                </div>
              </>
            )}

            {genericKey === "skills" && (
              <>
                <p className="px-1 text-sm text-muted-foreground">{t("skillsSub")}</p>
                <div className="mt-4">
                  <Group>
                    <SettingToggle
                      label={t("skillImage")}
                      on={optionOn("skillImage", true)}
                      onChange={(v) => setOption("skillImage", v)}
                    />
                    <SettingToggle
                      label={t("skillVideo")}
                      on={optionOn("skillVideo", true)}
                      onChange={(v) => setOption("skillVideo", v)}
                    />
                    <SettingToggle
                      label={t("skillTranslate")}
                      on={optionOn("skillTranslate")}
                      onChange={(v) => setOption("skillTranslate", v)}
                    />
                    <SettingToggle
                      label={t("skillIdeas")}
                      on={optionOn("skillIdeas", true)}
                      onChange={(v) => setOption("skillIdeas", v)}
                    />
                  </Group>
                </div>
              </>
            )}

            {genericKey === "advanced" && (
              <>
                <p className="px-1 text-sm text-muted-foreground">{t("advancedSub")}</p>
                <div className="mt-4">
                  <Group>
                    <SettingToggle
                      label={t("advancedMode")}
                      on={optionOn("advancedMode")}
                      onChange={(v) => setOption("advancedMode", v)}
                    />
                    <SettingToggle
                      label={t("advHighQuality")}
                      on={optionOn("highQuality", true)}
                      onChange={(v) => setOption("highQuality", v)}
                    />
                    <SettingToggle
                      label={t("advBeta")}
                      on={optionOn("beta")}
                      onChange={(v) => setOption("beta", v)}
                    />
                    <SettingToggle
                      label={t("advDebug")}
                      on={optionOn("debug")}
                      onChange={(v) => setOption("debug", v)}
                    />
                  </Group>
                </div>
              </>
            )}

            {genericKey === "other" && (
              <Group>
                <SettingToggle
                  label={`${genericTitle} · ${t("alwaysOn")}`}
                  on={optionOn(`${genericTitle}:on`)}
                  onChange={(v) => setOption(`${genericTitle}:on`, v)}
                />
                <SettingToggle
                  label={t("suggestion")}
                  on={optionOn(`${genericTitle}:suggestion`)}
                  onChange={(v) => setOption(`${genericTitle}:suggestion`, v)}
                />
              </Group>
            )}
          </div>
        )}
      </div>

      {rateOpen && (
        <RateDialog
          initial={prefs.rating ?? 0}
          onClose={() => setRateOpen(false)}
          onSubmit={(stars) => {
            void savePrefs({ rating: stars });
            setRateOpen(false);
            flash(t("thanks"));
          }}
        />
      )}

      {toast && (
        <div className="pointer-events-none fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-full bg-card px-5 py-3 text-sm shadow-lg animate-fade-in">
          {toast}
        </div>
      )}
      {plansOpen && <PlansSheet onClose={() => setPlansOpen(false)} />}
    </div>
  );
}

function RateDialog({
  initial,
  onClose,
  onSubmit,
}: {
  initial: number;
  onClose: () => void;
  onSubmit: (stars: number) => void;
}) {
  const { t } = useI18n();
  const [stars, setStars] = useState(initial);
  const [review, setReview] = useState("");

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-background/70 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 animate-fade-in">
        <h2 className="text-center text-xl font-semibold">{t("rateTitle")}</h2>
        <p className="mt-1 text-center text-sm text-muted-foreground">{t("rateSub")}</p>
        <div className="mt-5 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              aria-label={`${s} étoiles`}
              onClick={() => setStars(s)}
              className="transition-transform active:scale-90"
            >
              <Star
                className={`h-9 w-9 ${s <= stars ? "fill-primary text-primary" : "text-muted-foreground"}`}
              />
            </button>
          ))}
        </div>
        <textarea
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder={t("reviewPlaceholder")}
          className="mt-5 h-24 w-full resize-none rounded-2xl bg-secondary p-3 text-[15px] outline-none placeholder:text-muted-foreground"
        />
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full bg-secondary py-3 font-medium"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            disabled={stars === 0}
            onClick={() => onSubmit(stars)}
            className="flex-1 rounded-full bg-primary py-3 font-semibold text-primary-foreground disabled:opacity-50"
          >
            {t("send")}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingToggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center px-4 py-3.5 text-[17px]">
      <span className="pr-3">{label}</span>
      <span className="ml-auto">
        <Toggle on={on} onChange={onChange} />
      </span>
    </div>
  );
}
