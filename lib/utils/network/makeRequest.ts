export async function makeRequest<T>(
  url: string,
  options?: RequestInit,
  reqFunctionName?: string
): Promise<T> {
  try {
    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(response.status + " " + response.statusText);
    }
    const data = await response.json();
    return data;
  } catch (error: any) {
    // if we are in development mode, add which function failed
    if (process.env.NODE_ENV === "development" && reqFunctionName) {
      throw new Error(`${reqFunctionName} failed: ${error.message}`);
    } else throw new Error(error.message);
  }
}
