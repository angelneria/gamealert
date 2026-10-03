/**
 * sendDiscordNotification — pacing contra el límite de rate de Discord.
 *
 * El runner puede lanzar hasta MAX_DEALS_PER_RUN envíos seguidos en una
 * sola ejecución; sin la pausa de 1 s tras cada intento, Discord empezaría
 * a responder 429 y las alertas se perderían (o se reintentarían en bucle).
 */
import axios from "axios";
import {
  sendDiscordNotification,
  sendDiscordDigest,
  MAX_EMBEDS_PER_MESSAGE,
} from "@/server/discord";

jest.mock("axios", () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

const mockedPost = axios.post as unknown as jest.Mock;

const WEBHOOK = "https://discord.com/api/webhooks/1234567890/valid-token";
const game = {
  title: "Juego Demo",
  platform: "steam",
  storeUrl: "https://store.steampowered.com/app/1",
  imageUrl: "",
  description: "",
  publisher: "Test",
};

describe("sendDiscordNotification — pausa entre envíos", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockedPost.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("espera 1 s tras el intento antes de devolver (límite de rate)", async () => {
    mockedPost.mockResolvedValue({ status: 204 });

    const result = sendDiscordNotification(game, WEBHOOK);
    await jest.advanceTimersByTimeAsync(0); // el POST se resuelve

    expect(mockedPost).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(1); // la pausa queda programada

    await jest.advanceTimersByTimeAsync(999);
    expect(jest.getTimerCount()).toBe(1); // a los 999 ms sigue pausado

    await jest.advanceTimersByTimeAsync(1);
    expect(jest.getTimerCount()).toBe(0); // a los 1000 ms se libera
    await expect(result).resolves.toBe(true);
  });

  it("si la URL no es un webhook oficial no hay petición ni pausa", async () => {
    const result = await sendDiscordNotification(
      game,
      "https://evil.example.com/hook"
    );

    expect(result).toBe(false);
    expect(mockedPost).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe("sendDiscordDigest — un resumen con todo", () => {
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ ...game, title: `Juego ${i + 1}` }));

  beforeEach(() => {
    jest.useFakeTimers();
    mockedPost.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("corta en mensajes de 10 embeds como máximo", async () => {
    expect(MAX_EMBEDS_PER_MESSAGE).toBe(10);
    mockedPost.mockResolvedValue({ status: 204 });

    const result = sendDiscordDigest(many(11), WEBHOOK);
    await jest.advanceTimersByTimeAsync(3000);

    expect(mockedPost).toHaveBeenCalledTimes(2);
    expect(mockedPost.mock.calls[0][1].embeds).toHaveLength(10);
    expect(mockedPost.mock.calls[1][1].embeds).toHaveLength(1);
    expect(mockedPost.mock.calls[0][1].username).toBe("GameAlert");
    await expect(result).resolves.toBe(true);
  });

  it("con 10 o menos sale en un solo mensaje", async () => {
    mockedPost.mockResolvedValue({ status: 204 });

    const result = sendDiscordDigest(many(3), WEBHOOK);
    await jest.advanceTimersByTimeAsync(2000);

    expect(mockedPost).toHaveBeenCalledTimes(1);
    expect(mockedPost.mock.calls[0][1].embeds).toHaveLength(3);
    await expect(result).resolves.toBe(true);
  });

  it("lista vacía no envía nada y devuelve true", async () => {
    await expect(sendDiscordDigest([], WEBHOOK)).resolves.toBe(true);
    expect(mockedPost).not.toHaveBeenCalled();
  });

  it("si un tramo falla, el resumen entero falla (se reintenta después)", async () => {
    mockedPost
      .mockResolvedValueOnce({ status: 204 })
      .mockRejectedValueOnce(new Error("boom"));

    const result = sendDiscordDigest(many(11), WEBHOOK);
    await jest.advanceTimersByTimeAsync(3000);

    await expect(result).resolves.toBe(false);
  });

  it("URL no oficial → false sin peticiones", async () => {
    await expect(
      sendDiscordDigest(many(2), "https://evil.example.com/hook")
    ).resolves.toBe(false);
    expect(mockedPost).not.toHaveBeenCalled();
  });
});
