import type { Game } from "../../types";

export async function loadGames(): Promise<Game[]> {
  try {
    const response = await fetch(`/api/games`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Authentication required to load games");
      }
      throw new Error(`Failed to load games: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to load games:", error);
    throw error;
  }
}

export async function getGame(id: string): Promise<Game> {
  try {
    const response = await fetch(`/api/games/${id}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Game not found");
      }
      if (response.status === 401) {
        throw new Error("Authentication required");
      }
      throw new Error(`Failed to get game: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to get game:", error);
    throw error;
  }
}
