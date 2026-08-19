import { describe, it, expect, vi } from "vitest";

/**
 * lib/whatsapp is `server-only`; stub that marker so the module can be imported
 * under Vitest (the real package throws when pulled into a client bundle).
 */
vi.mock("server-only", () => ({}));

const {
  toE164India,
  roomCredentialsMessage,
  buildRoomCredentialsLink,
  isWhatsAppProviderConfigured,
  sendWhatsApp,
} = await import("@/lib/whatsapp");

describe("toE164India", () => {
  it("prefixes a bare 10-digit mobile with the country code", () => {
    expect(toE164India("9876543210")).toBe("919876543210");
  });

  it.each([
    ["+91 98765 43210", "919876543210"],
    ["98765-43210", "919876543210"],
    ["(98765) 43210", "919876543210"],
    ["919876543210", "919876543210"],
    ["09876543210", "919876543210"],
    ["00919876543210", "919876543210"],
  ])("normalises %j", (input, expected) => {
    expect(toE164India(input)).toBe(expected);
  });

  it.each(["", "12345", "abcdefghij", "1234567890123456"])(
    "rejects an unusable number %j",
    (input) => {
      expect(toE164India(input)).toBeNull();
    },
  );
});

describe("roomCredentialsMessage", () => {
  const params = {
    eventTitle: "Friday Night Showdown",
    roomId: "12345678",
    roomPassword: "hunter2",
    eventUrl: "https://gravity.gg/events/friday",
  };

  it("includes the room id and password", () => {
    const msg = roomCredentialsMessage(params);
    expect(msg).toContain("12345678");
    expect(msg).toContain("hunter2");
  });

  it("names the event and links to it", () => {
    const msg = roomCredentialsMessage(params);
    expect(msg).toContain("Friday Night Showdown");
    expect(msg).toContain("https://gravity.gg/events/friday");
  });
});

describe("buildRoomCredentialsLink", () => {
  const base = {
    eventTitle: "Cup",
    roomId: "111",
    roomPassword: "pw",
    eventUrl: "https://gravity.gg/e/cup",
  };

  it("targets a specific number when given one", () => {
    expect(buildRoomCredentialsLink({ ...base, phone: "9876543210" })).toMatch(
      /^https:\/\/wa\.me\/919876543210\?text=/,
    );
  });

  it("falls back to an open share link without a phone", () => {
    expect(buildRoomCredentialsLink(base)).toMatch(/^https:\/\/wa\.me\/\?text=/);
  });

  it("falls back to an open share link when the phone is unusable", () => {
    expect(buildRoomCredentialsLink({ ...base, phone: "123" })).toMatch(
      /^https:\/\/wa\.me\/\?text=/,
    );
  });

  it("url-encodes the message so newlines don't truncate it", () => {
    const link = buildRoomCredentialsLink(base);
    expect(link).not.toContain("\n");
    expect(decodeURIComponent(link.split("text=")[1])).toContain("Room ID: 111");
  });
});

describe("sendWhatsApp", () => {
  it("skips (never throws) when no provider is configured", async () => {
    delete process.env.WHATSAPP_PROVIDER_API_KEY;
    delete process.env.WHATSAPP_PROVIDER_URL;

    expect(isWhatsAppProviderConfigured()).toBe(false);
    await expect(
      sendWhatsApp({ phone: "9876543210", message: "hi" }),
    ).resolves.toEqual({ ok: false, skipped: true });
  });

  it("skips an unusable number without calling the provider", async () => {
    process.env.WHATSAPP_PROVIDER_API_KEY = "test-key";
    process.env.WHATSAPP_PROVIDER_URL = "https://provider.test/send";
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const res = await sendWhatsApp({ phone: "nope", message: "hi" });

    expect(res).toEqual({ ok: false, skipped: true });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("reports failure rather than throwing when the provider errors", async () => {
    process.env.WHATSAPP_PROVIDER_API_KEY = "test-key";
    process.env.WHATSAPP_PROVIDER_URL = "https://provider.test/send";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network down"));

    // Room release fans out to every paid player — one dead provider must not
    // take the whole release down.
    await expect(
      sendWhatsApp({ phone: "9876543210", message: "hi" }),
    ).resolves.toEqual({ ok: false });

    fetchSpy.mockRestore();
  });

  it("posts the normalised number to the provider", async () => {
    process.env.WHATSAPP_PROVIDER_API_KEY = "test-key";
    process.env.WHATSAPP_PROVIDER_URL = "https://provider.test/send";
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("ok", { status: 200 }));

    const res = await sendWhatsApp({ phone: "+91 98765 43210", message: "hi" });

    expect(res.ok).toBe(true);
    const body = JSON.parse(
      (fetchSpy.mock.calls[0][1] as RequestInit).body as string,
    );
    expect(body.to).toBe("919876543210");
    expect(body.text.body).toBe("hi");

    fetchSpy.mockRestore();
  });
});
