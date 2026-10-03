/**
 * sendDiscordNotification — pacing contra el límite de rate de Discord.
 *
 * El runner puede lanzar hasta MAX_DEALS_PER_RUN envíos seguidos en una
 * sola ejecución; sin la pausa de 1 s tras cada intento, Discord empezaría
 * a responder 429 y las alertas se perderían (o se reintentarían en bucle).
 */
import axios from "axios";
import { sendDiscordNotification } from "@/server/discord";

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
