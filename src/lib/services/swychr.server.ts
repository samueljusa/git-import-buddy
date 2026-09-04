/**
 * Service SwyChr / AccountPe — serveur uniquement.
 * La clé `SWYCHR_API_KEY` est lue à l'exécution et n'est jamais exposée au client.
 */

const BASE_URL = "https://api.accountpe.com";

export type PayoutMethod = {
  /** Identifiant à renvoyer dans `payment_method` (ex: MTN, ORANGE). */
  code: string;
  label: string;
  /** Format attendu du numéro (ex: "2376XXXXXXXX"). */
  mobileFormat: string | null;
  /** Longueur attendue du numéro, déduite du format quand l'API ne la fournit pas. */
  length: number | null;
  prefix: string | null;
};

type ApiResult<T> = { ok: true; data: T } | { ok: false; message: string; status?: number };

function apiKey(): string | null {
  return process.env["SWYCHR_API_KEY"] ?? null;
}

export function isSwychrConfigured(): boolean {
  return Boolean(process.env["SWYCHR_API_KEY"]);
}

async function callSwychr(
  path: string,
  body: Record<string, unknown>,
): Promise<ApiResult<Record<string, unknown>>> {
  const key = apiKey();
  if (!key) return { ok: false, message: "Clé API SwyChr non configurée côté serveur." };

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Api-Key": key,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "SwyChr injoignable.",
    };
  }

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = {};
  }

  if (!res.ok) {
    const message =
      (typeof json["message"] === "string" && json["message"]) ||
      (typeof json["error"] === "string" && json["error"]) ||
      text.slice(0, 300) ||
      `Erreur SwyChr (${res.status})`;
    return { ok: false, message, status: res.status };
  }

  return { ok: true, data: json };
}

function digitsLength(format: string | null): number | null {
  if (!format) return null;
  const digits = format.replace(/[^0-9Xx]/g, "");
  return digits.length > 0 ? digits.length : null;
}

/** POST /api/payout/payout_methods — moyens de paiement disponibles pour un pays. */
export async function fetchPayoutMethods(
  countryCode: string,
): Promise<ApiResult<PayoutMethod[]>> {
  const result = await callSwychr("/api/payout/payout_methods", { country_code: countryCode });
  if (!result.ok) return result;

  const raw = result.data;
  const container =
    raw["data"] && typeof raw["data"] === "object" && !Array.isArray(raw["data"])
      ? (raw["data"] as Record<string, unknown>)
      : raw;

  const list =
    (Array.isArray(container["payment_methods"]) && (container["payment_methods"] as unknown[])) ||
    (Array.isArray(container["methods"]) && (container["methods"] as unknown[])) ||
    (Array.isArray(raw["data"]) && (raw["data"] as unknown[])) ||
    [];

  const methods: PayoutMethod[] = list.map((entry) => {
    if (typeof entry === "string") {
      return { code: entry, label: entry, mobileFormat: null, length: null, prefix: null };
    }
    const item = (entry ?? {}) as Record<string, unknown>;
    const code = String(
      item["payment_method"] ?? item["method"] ?? item["code"] ?? item["name"] ?? "",
    );
    const mobileFormat =
      typeof item["mobile_format"] === "string" ? (item["mobile_format"] as string) : null;
    const rawLength = item["applicable_mobileno_length"] ?? item["length"];
    const parsedLength =
      typeof rawLength === "number"
        ? rawLength
        : typeof rawLength === "string" && rawLength.trim() !== "" && !Number.isNaN(Number(rawLength))
          ? Number(rawLength)
          : null;
    return {
      code,
      label: String(item["name"] ?? item["label"] ?? code),
      mobileFormat,
      length: parsedLength ?? digitsLength(mobileFormat),
      prefix: typeof item["prefix"] === "string" ? (item["prefix"] as string) : null,
    };
  });


  return { ok: true, data: methods.filter((m) => m.code.length > 0) };
}

export type PaymentLinkInput = {
  countryCode: string;
  name: string;
  transactionId: string;
  amount: number;
  currency: string;
  email: string;
  mobile: string;
  description: string;
};

export type PaymentLink = {
  paymentLink: string;
  providerTransactionId: string | null;
  providerId: string | null;
  raw: Record<string, unknown>;
};

/**
 * POST /api/payin/create_payment_links — crée un lien de paiement hébergé.
 * Le client est ensuite redirigé vers ce lien pour finaliser le paiement.
 */
export async function createPaymentLink(
  input: PaymentLinkInput,
): Promise<ApiResult<PaymentLink>> {
  const result = await callSwychr("/api/payin/create_payment_links", {
    country_code: input.countryCode,
    name: input.name,
    transaction_id: input.transactionId,
    amount: input.amount,
    currency: input.currency,
    email: input.email,
    mobile: input.mobile,
    description: input.description,
    pass_digital_charge: true,
  });
  if (!result.ok) return result;

  const raw = result.data;
  const status = typeof raw["status"] === "number" ? (raw["status"] as number) : 200;
  const data =
    raw["data"] && typeof raw["data"] === "object" && !Array.isArray(raw["data"])
      ? (raw["data"] as Record<string, unknown>)
      : {};

  const link =
    (typeof data["payment_link"] === "string" && data["payment_link"]) ||
    (typeof data["payment_url"] === "string" && data["payment_url"]) ||
    (typeof data["checkout_url"] === "string" && data["checkout_url"]) ||
    (typeof data["url"] === "string" && data["url"]) ||
    null;

  if (status >= 400 || !link) {
    const message =
      (typeof raw["message"] === "string" && raw["message"]) ||
      "Impossible de créer le lien de paiement.";
    return { ok: false, message };
  }

  return {
    ok: true,
    data: {
      paymentLink: link,
      providerTransactionId:
        typeof data["transaction_id"] === "string" ? (data["transaction_id"] as string) : null,
      providerId: data["id"] != null ? String(data["id"]) : null,
      raw,
    },
  };
}

export type LinkStatus = { status: string | null; raw: Record<string, unknown> };

/** POST /api/payin/payment_link_status — statut courant d'un lien de paiement. */
export async function fetchPaymentLinkStatus(
  transactionId: string,
): Promise<ApiResult<LinkStatus>> {
  const result = await callSwychr("/api/payin/payment_link_status", {
    transaction_id: transactionId,
  });
  if (!result.ok) return result;

  const raw = result.data;
  const outer = (raw["data"] ?? {}) as Record<string, unknown>;
  const inner = (outer["data"] ?? outer) as Record<string, unknown>;
  const attributes = (inner["attributes"] ?? inner) as Record<string, unknown>;
  const status =
    typeof attributes["status"] === "string" ? (attributes["status"] as string) : null;

  return { ok: true, data: { status, raw } };
}

