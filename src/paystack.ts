const BASE = "https://api.paystack.co";

function secret() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error("PAYSTACK_SECRET_KEY is not set");
  return key;
}

async function call(path: string, init: RequestInit = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret()}`,
      "Content-Type": "application/json",
    },
  });
  const json = (await res.json()) as any;
  if (!res.ok || !json.status) {
    throw new Error("Paystack error: " + (json.message ?? res.status));
  }
  return json.data;
}

export function initializeTransaction(p: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
}): Promise<{ authorization_url: string; reference: string }> {
  return call("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: p.email,
      amount: p.amountKobo,
      reference: p.reference,
      currency: "NGN",
      callback_url: p.callbackUrl,
    }),
  });
}

export function verifyTransaction(
  reference: string
): Promise<{ status: string; amount: number; currency: string }> {
  return call("/transaction/verify/" + encodeURIComponent(reference));
}
