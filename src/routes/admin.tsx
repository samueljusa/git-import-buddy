import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  RefreshCw,
  ShieldCheck,
  Gauge,
  Tag,
  Users,
  LifeBuoy,
  CreditCard,
  Images,
  Check,
  X,
  Trash2,
} from "lucide-react";
import {
  getAdminAccess,
  getAdminStats,
  listRecentGenerations,
  listAdminPrices,
  updateAdminPrice,
  listAdminOrders,
  type AdminGeneration,
  type AdminStats,
  type AdminPrice,
  type AdminOrder,
  type StaffRole,
} from "@/lib/admin.functions";
import {
  listTeamMembers,
  listInvitations,
  inviteTeamMember,
  revokeTeamRole,
  cancelInvitation,
  type TeamMember,
  type TeamInvitation,
  type TeamRole,
} from "@/lib/team.functions";
import {
  listSupportMessages,
  listSupportReplies,
  replyToSupportMessage,
  updateSupportStatus,
  type SupportMessage,
  type SupportReply,
} from "@/lib/support.functions";
import {
  listModerationQueue,
  moderateGeneration,
  deleteGalleryItem,
  type ModerationItem,
} from "@/lib/community.functions";
import { getPromoSettings, setPromoSettings } from "@/lib/promo.functions";
import { toast } from "@/lib/toast";
import { useAuth } from "@/hooks/useAuth";
import { formatSeconds } from "@/lib/quota";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Bureau d'administration — Sam flash 2.0" },
      {
        name: "description",
        content:
          "Tableau de bord d'administration Sam flash 2.0 : utilisateurs, générations, quotas, abonnements, collaborateurs et support.",
      },
      { property: "og:title", content: "Bureau d'administration — Sam flash 2.0" },
      {
        property: "og:description",
        content: "Statistiques, prix, collaborateurs et support Sam flash 2.0.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

const ROLE_LABEL: Record<TeamRole, string> = {
  admin: "Administrateur",
  moderator: "Modérateur",
  support: "Support",
  finance: "Finance",
};

function AdminPage() {
  const { session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fetchAccess = useServerFn(getAdminAccess);
  const fetchStats = useServerFn(getAdminStats);
  const fetchRecent = useServerFn(listRecentGenerations);
  const fetchPrices = useServerFn(listAdminPrices);
  const savePrice = useServerFn(updateAdminPrice);
  const fetchOrders = useServerFn(listAdminOrders);
  const fetchMembers = useServerFn(listTeamMembers);
  const fetchInvites = useServerFn(listInvitations);
  const invite = useServerFn(inviteTeamMember);
  const revoke = useServerFn(revokeTeamRole);
  const cancelInvite = useServerFn(cancelInvitation);
  const fetchTickets = useServerFn(listSupportMessages);
  const fetchReplies = useServerFn(listSupportReplies);
  const sendReply = useServerFn(replyToSupportMessage);
  const setTicketStatus = useServerFn(updateSupportStatus);
  const fetchQueue = useServerFn(listModerationQueue);
  const moderate = useServerFn(moderateGeneration);
  const removeItem = useServerFn(deleteGalleryItem);
  const fetchPromo = useServerFn(getPromoSettings);
  const savePromo = useServerFn(setPromoSettings);

  const [roles, setRoles] = useState<StaffRole[]>([]);
  const [isStaff, setIsStaff] = useState<boolean | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [items, setItems] = useState<AdminGeneration[]>([]);
  const [prices, setPrices] = useState<AdminPrice[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<TeamInvitation[]>([]);
  const [tickets, setTickets] = useState<SupportMessage[]>([]);
  const [openTicket, setOpenTicket] = useState<string | null>(null);
  const [replies, setReplies] = useState<SupportReply[]>([]);
  const [replyText, setReplyText] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("support");
  const [notice, setNotice] = useState<string | null>(null);
  const [priceNotice, setPriceNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<string>("overview");
  const [queue, setQueue] = useState<ModerationItem[]>([]);
  const [modBusy, setModBusy] = useState<string | null>(null);
  const [promoEnabled, setPromoEnabled] = useState(false);
  const [promoSaving, setPromoSaving] = useState(false);

  const isAdmin = roles.includes("admin");
  const canModerate = roles.includes("admin") || roles.includes("moderator");
  const canPrices = isAdmin || roles.includes("finance");
  const canSupport = isAdmin || roles.includes("support");

  useEffect(() => {
    if (!authLoading && !session) void navigate({ to: "/" });
  }, [authLoading, session, navigate]);

  const load = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const access = await fetchAccess({});
      setRoles(access.roles);
      setIsStaff(access.isStaff);
      const admin = access.isAdmin;
      const finance = admin || access.roles.includes("finance");
      const support = admin || access.roles.includes("support");

      if (admin) {
        const [s, r, o, m, i] = await Promise.all([
          fetchStats({}),
          fetchRecent({}),
          fetchOrders({}),
          fetchMembers({}),
          fetchInvites({}),
        ]);
        setStats(s as AdminStats);
        setItems(r as AdminGeneration[]);
        setOrders(o as AdminOrder[]);
        setMembers(m as TeamMember[]);
        setInvites(i as TeamInvitation[]);
      }
      if (admin || access.roles.includes("moderator")) {
        setQueue((await fetchQueue({})) as ModerationItem[]);
      }
      if (admin) setPromoEnabled((await fetchPromo({})).enabled);
      if (finance) setPrices((await fetchPrices({})) as AdminPrice[]);
      if (support) setTickets((await fetchTickets({})) as SupportMessage[]);
    } catch {
      setIsStaff(false);
    } finally {
      setLoading(false);
    }
  }, [
    session,
    fetchAccess,
    fetchStats,
    fetchRecent,
    fetchPrices,
    fetchOrders,
    fetchMembers,
    fetchInvites,
    fetchTickets,
    fetchQueue,
    fetchPromo,
  ]);

  const actOnItem = useCallback(
    async (id: string, action: "approve" | "reject" | "delete") => {
      setModBusy(id);
      try {
        if (action === "delete") {
          await removeItem({ data: { id } });
          toast.success("Création supprimée.");
        } else {
          await moderate({
            data:
              action === "reject"
                ? { id, action, reason: "Contenu inapproprié" }
                : { id, action },
          });
          toast.success(action === "approve" ? "Création publiée." : "Création rejetée.");
        }
        setQueue((await fetchQueue({})) as ModerationItem[]);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Action impossible.");
      } finally {
        setModBusy(null);
      }
    },
    [moderate, removeItem, fetchQueue],
  );

  const togglePromo = useCallback(
    async (next: boolean) => {
      setPromoSaving(true);
      try {
        const res = await savePromo({
          data: { enabled: next, prices: { base: 0, plus: null, heavy: null } },
        });
        if (res.ok) {
          setPromoEnabled(next);
          toast.success(
            next ? "Offre de lancement activée." : "Offre de lancement désactivée.",
          );
        } else {
          toast.error(res.message);
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Enregistrement impossible.");
      } finally {
        setPromoSaving(false);
      }
    },
    [savePromo],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const commitPrice = useCallback(
    async (row: AdminPrice) => {
      setPriceNotice(null);
      const res = await savePrice({
        data: {
          id: row.id,
          amountEur: row.amount_eur,
          amountEurYearly: row.amount_eur_yearly,
          active: row.active,
        },
      });
      setPriceNotice(res.ok ? `Prix de « ${row.label} » enregistré.` : res.message);
    },
    [savePrice],
  );

  const openThread = useCallback(
    async (id: string) => {
      if (openTicket === id) {
        setOpenTicket(null);
        return;
      }
      setOpenTicket(id);
      setReplyText("");
      setReplies((await fetchReplies({ data: { messageId: id } })) as SupportReply[]);
    },
    [openTicket, fetchReplies],
  );

  const cards: { label: string; value: string }[] = stats
    ? [
        { label: "Utilisateurs", value: String(stats.users) },
        { label: "Générations", value: String(stats.generations) },
        { label: "Aujourd'hui", value: String(stats.generationsToday) },
        { label: "Échecs", value: String(stats.errors) },
        { label: "En modération", value: String(stats.pendingModeration) },
        { label: "Abonnements actifs", value: String(stats.activeSubscriptions) },
        { label: "Temps consommé (jour)", value: formatSeconds(stats.secondsToday) },
      ]
    : [];

  const sections = [
    { id: "overview", label: "Vue d'ensemble", icon: Gauge, show: isAdmin },
    { id: "pricing", label: "Tarifs", icon: Tag, show: canPrices },
    { id: "team", label: "Équipe", icon: Users, show: isAdmin },
    { id: "support", label: "Support", icon: LifeBuoy, show: canSupport },
    {
      id: "orders",
      label: "Paiements",
      icon: CreditCard,
      show: isAdmin || roles.includes("finance"),
    },
    { id: "moderation", label: "Modération", icon: ShieldCheck, show: canModerate },
    { id: "content", label: "Créations", icon: Images, show: isAdmin },
  ].filter((s) => s.show);

  const active = sections.some((s) => s.id === tab) ? tab : (sections[0]?.id ?? "overview");

  return (
    <div
      className="min-h-screen bg-background pb-24"
      style={{ background: "var(--gradient-hero)" }}
    >
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link
            to="/app"
            aria-label="Retour au studio"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Espace équipe
            </p>
            <h1 className="truncate text-[19px] font-semibold tracking-tight">
              Bureau d'administration
            </h1>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Actualiser"
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-full bg-secondary transition-transform active:scale-95"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {sections.length > 0 && (
          <nav className="mx-auto max-w-5xl overflow-x-auto px-3 pb-3">
            <div className="flex w-max gap-1 rounded-full bg-secondary/60 p-1">
              {sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setTab(s.id)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-[13px] font-medium transition-colors ${
                    active === s.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  <s.icon className="h-4 w-4" />
                  {s.label}
                </button>
              ))}
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto max-w-5xl px-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 pt-6 sm:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-3xl bg-secondary/50" />
            ))}
          </div>
        ) : isStaff === false ? (
          <p className="pt-24 text-center text-sm text-muted-foreground">
            Accès réservé à l'équipe.
          </p>
        ) : (
          <>
            {roles.length > 0 && (
              <p className="pt-5 text-xs text-muted-foreground">
                Vos accès :{" "}
                {roles
                  .filter((r) => r !== "user")
                  .map((r) => ROLE_LABEL[r as TeamRole] ?? r)
                  .join(" · ")}
              </p>
            )}

            {active === "overview" && isAdmin && (
              <section className="pt-5">
                <h2 className="text-[22px] font-semibold tracking-tight">Vue d'ensemble</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Activité en temps réel de la plateforme.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {cards.map((c) => (
                    <div
                      key={c.label}
                      className="rounded-3xl border border-border/70 bg-card/50 p-5 backdrop-blur-xl"
                    >
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {c.label}
                      </p>
                      <p className="mt-2 text-3xl font-semibold tracking-tight">{c.value}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {active === "pricing" && canPrices && (
              <section className="pt-5">
                <h2 className="text-[22px] font-semibold tracking-tight">Tarifs des offres</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Montants en euros, convertis automatiquement à l'achat.
                </p>

                {isAdmin && (
                  <div className="mt-4 flex items-center gap-3 rounded-3xl border border-border/70 bg-card/50 p-5 backdrop-blur-xl">
                    <div className="min-w-0">
                      <p className="text-[17px] font-medium">Offre de lancement</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Super grok offert 30 jours, activation immédiate sans paiement.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={promoSaving}
                      onClick={() => void togglePromo(!promoEnabled)}
                      className={`ml-auto shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                        promoEnabled
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-foreground"
                      }`}
                    >
                      {promoEnabled ? "Activée" : "Désactivée"}
                    </button>
                  </div>
                )}
                <ul className="mt-4 space-y-3">
                  {prices.map((p) => (
                    <li
                      key={p.id}
                      className="rounded-3xl border border-border/70 bg-card/50 p-5 backdrop-blur-xl"
                    >
                      <div className="flex items-center gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[17px] font-medium">{p.label}</p>
                          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                            {p.tier}
                          </p>
                        </div>
                        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                          <input
                            type="checkbox"
                            checked={p.active}
                            onChange={(e) =>
                              setPrices((prev) =>
                                prev.map((r) =>
                                  r.id === p.id ? { ...r, active: e.target.checked } : r,
                                ),
                              )
                            }
                          />
                          Actif
                        </label>
                        <button
                          type="button"
                          onClick={() => void commitPrice(p)}
                          className="rounded-full bg-foreground px-4 py-2 text-xs font-semibold text-background transition-transform active:scale-95"
                        >
                          Enregistrer
                        </button>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <label className="text-[11px] text-muted-foreground">
                          Mensuel (€)
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            aria-label={`Prix mensuel en euros pour ${p.label}`}
                            value={p.amount_eur}
                            onChange={(e) =>
                              setPrices((prev) =>
                                prev.map((r) =>
                                  r.id === p.id ? { ...r, amount_eur: Number(e.target.value) } : r,
                                ),
                              )
                            }
                            className="mt-1 w-full rounded-2xl border border-border bg-background/60 px-3 py-2.5 text-right text-foreground"
                          />
                        </label>
                        <label className="text-[11px] text-muted-foreground">
                          Annuel (€)
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            aria-label={`Prix annuel en euros pour ${p.label}`}
                            value={p.amount_eur_yearly ?? ""}
                            onChange={(e) =>
                              setPrices((prev) =>
                                prev.map((r) =>
                                  r.id === p.id
                                    ? {
                                        ...r,
                                        amount_eur_yearly:
                                          e.target.value === "" ? null : Number(e.target.value),
                                      }
                                    : r,
                                ),
                              )
                            }
                            className="mt-1 w-full rounded-2xl border border-border bg-background/60 px-3 py-2.5 text-right text-foreground"
                          />
                        </label>
                      </div>
                    </li>
                  ))}
                </ul>
                {priceNotice && <p className="mt-3 text-sm text-primary">{priceNotice}</p>}
              </section>
            )}

            {active === "team" && isAdmin && (
              <section className="pt-5">
                <h2 className="text-[22px] font-semibold tracking-tight">Collaborateurs</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Invitez votre équipe et gérez les rôles.
                </p>
                <div className="mt-4 rounded-3xl border border-border/70 bg-card/50 p-5 backdrop-blur-xl">
                  <label htmlFor="inv-email" className="text-xs text-muted-foreground">
                    Inviter par e-mail
                  </label>
                  <input
                    id="inv-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="collaborateur@exemple.com"
                    className="mt-1 w-full rounded-2xl border border-border bg-background/60 px-4 py-3"
                  />
                  <div className="mt-3 flex items-center gap-2">
                    <select
                      aria-label="Rôle du collaborateur"
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as TeamRole)}
                      className="rounded-2xl border border-border bg-background/60 px-3 py-2.5 text-sm"
                    >
                      {(Object.keys(ROLE_LABEL) as TeamRole[]).map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() =>
                        void invite({ data: { email: inviteEmail.trim(), role: inviteRole } })
                          .then((r) => {
                            setNotice(r.message);
                            if (r.ok) setInviteEmail("");
                            return load();
                          })
                          .catch(() => setNotice("Invitation impossible."))
                      }
                      disabled={inviteEmail.trim().length < 5}
                      className="ml-auto rounded-full bg-foreground px-5 py-2.5 text-xs font-semibold text-background disabled:opacity-50"
                    >
                      Inviter
                    </button>
                  </div>
                  {notice && <p className="mt-2 text-xs text-primary">{notice}</p>}
                </div>

                <ul className="mt-3 space-y-2">
                  {members.map((m) => (
                    <li
                      key={m.user_id}
                      className="rounded-3xl border border-border/70 bg-card/50 p-4 text-sm backdrop-blur-xl"
                    >
                      <p className="truncate font-medium">{m.email ?? m.full_name ?? m.user_id}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {m.roles.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() =>
                              void revoke({ data: { userId: m.user_id, role: r } })
                                .then((res) => {
                                  setNotice(res.message);
                                  return load();
                                })
                                .catch(() => setNotice("Retrait impossible."))
                            }
                            className="rounded-full bg-secondary px-3 py-1 text-[11px]"
                            aria-label={`Retirer le rôle ${ROLE_LABEL[r]} à ${m.email ?? m.user_id}`}
                          >
                            {ROLE_LABEL[r]} ✕
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                  {members.length === 0 && (
                    <li className="py-6 text-center text-sm text-muted-foreground">
                      Aucun collaborateur.
                    </li>
                  )}
                </ul>

                {invites.filter((i) => !i.accepted_at).length > 0 && (
                  <>
                    <h3 className="mt-6 text-sm font-medium text-muted-foreground">
                      Invitations en attente
                    </h3>
                    <ul className="mt-2 space-y-2">
                      {invites
                        .filter((i) => !i.accepted_at)
                        .map((i) => (
                          <li
                            key={i.id}
                            className="flex items-center gap-2 rounded-3xl border border-border/70 bg-card/50 p-4 text-sm backdrop-blur-xl"
                          >
                            <span className="truncate">{i.email}</span>
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px]">
                              {ROLE_LABEL[i.role]}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                void cancelInvite({ data: { id: i.id } })
                                  .then((r) => {
                                    setNotice(r.message);
                                    return load();
                                  })
                                  .catch(() => setNotice("Annulation impossible."))
                              }
                              className="ml-auto text-[11px] text-destructive"
                            >
                              Annuler
                            </button>
                          </li>
                        ))}
                    </ul>
                  </>
                )}
              </section>
            )}

            {active === "support" && canSupport && (
              <section className="pt-5">
                <h2 className="text-[22px] font-semibold tracking-tight">Boîte de support</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Chaque réponse déclenche une notification chez le client.
                </p>
                <ul className="mt-4 space-y-2">
                  {tickets.map((tkt) => (
                    <li
                      key={tkt.id}
                      className="rounded-3xl border border-border/70 bg-card/50 p-4 text-sm backdrop-blur-xl"
                    >
                      <button
                        type="button"
                        onClick={() => void openThread(tkt.id)}
                        className="flex w-full items-center gap-2 text-left"
                      >
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px]">
                          {tkt.status}
                        </span>
                        <span className="truncate font-medium">{tkt.subject}</span>
                        <span className="ml-auto text-[11px] text-muted-foreground">
                          {new Date(tkt.created_at).toLocaleDateString("fr-FR")}
                        </span>
                      </button>
                      <p className="mt-1 text-[11px] text-muted-foreground">{tkt.email}</p>

                      {openTicket === tkt.id && (
                        <div className="mt-3 border-t border-border pt-3">
                          <p className="whitespace-pre-wrap">{tkt.body}</p>
                          <ul className="mt-2 space-y-1">
                            {replies.map((r) => (
                              <li
                                key={r.id}
                                className={`rounded-2xl px-3 py-2 text-[13px] ${r.is_staff ? "bg-primary/10" : "bg-secondary"}`}
                              >
                                <span className="text-[10px] text-muted-foreground">
                                  {r.is_staff ? "Équipe" : "Client"}
                                </span>
                                <p className="whitespace-pre-wrap">{r.body}</p>
                              </li>
                            ))}
                          </ul>
                          <textarea
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            aria-label="Votre réponse"
                            rows={3}
                            placeholder="Répondre au client…"
                            className="mt-2 w-full rounded-2xl border border-border bg-background/60 px-3 py-2"
                          />
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              disabled={replyText.trim().length === 0}
                              onClick={() =>
                                void sendReply({
                                  data: { messageId: tkt.id, body: replyText.trim() },
                                }).then(async () => {
                                  setReplyText("");
                                  setReplies(
                                    (await fetchReplies({
                                      data: { messageId: tkt.id },
                                    })) as SupportReply[],
                                  );
                                  await load();
                                  setOpenTicket(tkt.id);
                                })
                              }
                              className="rounded-full bg-foreground px-5 py-2.5 text-xs font-semibold text-background disabled:opacity-50"
                            >
                              Répondre
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                void setTicketStatus({
                                  data: { messageId: tkt.id, status: "resolu" },
                                }).then(() => load())
                              }
                              className="rounded-full bg-secondary px-5 py-2.5 text-xs"
                            >
                              Marquer résolu
                            </button>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                  {tickets.length === 0 && (
                    <li className="py-6 text-center text-sm text-muted-foreground">
                      Aucun message de support.
                    </li>
                  )}
                </ul>
              </section>
            )}

            {active === "orders" && (
              <section className="pt-5">
                <h2 className="text-[22px] font-semibold tracking-tight">Paiements récents</h2>
                <ul className="mt-4 space-y-2">
                  {orders.map((o) => (
                    <li
                      key={o.transaction_id}
                      className="rounded-3xl border border-border/70 bg-card/50 p-4 text-sm backdrop-blur-xl"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px]">
                          {o.status}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {o.country_code} · {o.payment_method}
                        </span>
                        <span className="ml-auto text-[11px] text-muted-foreground">
                          {new Date(o.created_at).toLocaleString("fr-FR")}
                        </span>
                      </div>
                      <p className="mt-1 truncate">{o.customer_email}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {o.amount_local} {o.currency} · {o.amount_eur.toFixed(2)} €
                      </p>
                    </li>
                  ))}
                  {orders.length === 0 && (
                    <li className="py-6 text-center text-sm text-muted-foreground">
                      Aucune commande enregistrée.
                    </li>
                  )}
                </ul>
              </section>
            )}

            {active === "moderation" && canModerate && (
              <section className="pt-5">
                <h2 className="text-[22px] font-semibold tracking-tight">
                  Modération de la galerie
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Toutes les créations arrivent ici automatiquement. Publiez, rejetez ou supprimez.
                </p>
                <ul className="mt-4 space-y-3">
                  {queue.map((g) => (
                    <li
                      key={g.id}
                      className="flex items-center gap-3 rounded-3xl border border-border/70 bg-card/50 p-3 backdrop-blur-xl"
                    >
                      <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-secondary">
                        {g.media_url &&
                          (g.media_type === "video" ? (
                            <video
                              src={g.media_url}
                              muted
                              playsInline
                              preload="metadata"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <img
                              src={g.media_url}
                              alt={g.prompt}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          ))}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm">{g.prompt}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {g.media_type} · {g.status} ·{" "}
                          {new Date(g.created_at).toLocaleString("fr-FR")}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label="Publier"
                        disabled={modBusy === g.id}
                        onClick={() => void actOnItem(g.id, "approve")}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
                      >
                        <Check className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Rejeter"
                        disabled={modBusy === g.id}
                        onClick={() => void actOnItem(g.id, "reject")}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-secondary disabled:opacity-40"
                      >
                        <X className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        aria-label="Supprimer"
                        disabled={modBusy === g.id}
                        onClick={() => void actOnItem(g.id, "delete")}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive text-destructive-foreground disabled:opacity-40"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </li>
                  ))}
                  {queue.length === 0 && (
                    <li className="py-10 text-center text-sm text-muted-foreground">
                      Aucune création à modérer.
                    </li>
                  )}
                </ul>
              </section>
            )}

            {active === "content" && isAdmin && (
              <section className="pt-5">
                <div className="flex items-center gap-2">
                  <h2 className="text-[22px] font-semibold tracking-tight">Créations récentes</h2>
                  <Link
                    to="/galerie"
                    className="ml-auto rounded-full bg-secondary px-4 py-2 text-xs font-medium"
                  >
                    Modération
                  </Link>
                </div>
                <ul className="mt-4 space-y-2">
                  {items.map((g) => (
                    <li
                      key={g.id}
                      className="rounded-3xl border border-border/70 bg-card/50 p-4 text-sm backdrop-blur-xl"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] uppercase">
                          {g.media_type}
                        </span>
                        <span
                          className={`text-[11px] ${g.status === "error" ? "text-destructive" : "text-muted-foreground"}`}
                        >
                          {g.status}
                        </span>
                        <span className="ml-auto text-[11px] text-muted-foreground">
                          {new Date(g.created_at).toLocaleString("fr-FR")}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2">{g.prompt}</p>
                      {g.error_message && (
                        <p className="mt-1 text-[11px] text-destructive">{g.error_message}</p>
                      )}
                    </li>
                  ))}
                  {items.length === 0 && (
                    <li className="py-10 text-center text-sm text-muted-foreground">
                      Aucune génération enregistrée.
                    </li>
                  )}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
