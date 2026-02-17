export async function deleteGame(id: string): Promise<void> {
  try {
    const response = await fetch(`/api/games/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error("Game not found");
      }
      if (response.status === 401) {
        throw new Error("Authentication required");
      }
      throw new Error(`Failed to delete game: ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to delete game:", error);
    throw error;
  }
}
