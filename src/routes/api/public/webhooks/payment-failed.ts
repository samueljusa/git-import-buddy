import { createFileRoute } from "@tanstack/react-router";
import { handlePaymentWebhook } from "@/lib/payments/webhook.server";

export const Route = createFileRoute("/api/public/webhooks/payment-failed")({
  server: {
    handlers: {
      POST: async ({ request }) => handlePaymentWebhook(request, "echouee"),
      GET: async ({ request }) => handlePaymentWebhook(request, "echouee"),
    },
  },
});
