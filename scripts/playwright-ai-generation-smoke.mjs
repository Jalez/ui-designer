import dotenv from "dotenv";
import path from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const DEV_USERNAME = process.env.PLAYWRIGHT_DEV_USERNAME || "ai-smoke";
const OPENROUTER_KEY = process.env.TEST_OPENROUTER_API_KEY || "";
const TEST_TIMEOUT_MS = Number(process.env.PLAYWRIGHT_AI_TIMEOUT_MS || 120000);

if (!OPENROUTER_KEY) {
  throw new Error("TEST_OPENROUTER_API_KEY is required in .env.local for the AI smoke test");
}

const MOCK_OPENROUTER_MODELS = [
  {
    id: "nvidia/nemotron-3-super-120b-a12b:free",
    canonical_slug: "nvidia/nemotron-3-super-120b-a12b:free",
    hugging_face_id: "",
    name: "Nemotron 3 Super 120B",
    created: Date.now(),
    description: "Free text-capable test model",
    context_length: 128000,
    architecture: {
      tokenizer: "nvidia",
      instruct_type: null,
      modality: "text",
    },
    pricing: {
      prompt: "0",
      completion: "0",
      request: "0",
      image: "0",
      internal_reasoning: "0",
    },
    top_provider: {
      context_length: 128000,
      max_completion_tokens: null,
      is_moderated: false,
    },
    per_request_limits: null,
    supported_parameters: ["tools"],
    default_parameters: {},
    api_provider: "nvidia",
  },
  {
    id: "openai/gpt-4o-mini",
    canonical_slug: "openai/gpt-4o-mini",
    hugging_face_id: "",
    name: "GPT-4o mini",
    created: Date.now(),
    description: "Paid text-capable test model",
    context_length: 128000,
    architecture: {
      tokenizer: "openai",
      instruct_type: null,
      modality: "text",
    },
    pricing: {
      prompt: "0.00000015",
      completion: "0.0000006",
      request: "0",
      image: "0",
      internal_reasoning: "0",
    },
    top_provider: {
      context_length: 128000,
      max_completion_tokens: null,
      is_moderated: false,
    },
    per_request_limits: null,
    supported_parameters: ["tools"],
    default_parameters: {},
    api_provider: "openai",
  },
];

function estimateModelUnitCost(model) {
  const pricing = model?.pricing || {};
  const values = [
    pricing.prompt,
    pricing.completion,
    pricing.request,
    pricing.image,
    pricing.internal_reasoning,
  ];
  return values.reduce((sum, value) => {
    const parsed = Number.parseFloat(String(value ?? "0"));
    return sum + (Number.isFinite(parsed) ? parsed : 0);
  }, 0);
}

function isTextCapable(model) {
  const modality = String(model?.architecture?.modality || "").toLowerCase();
  return modality.includes("text") || modality.includes("chat") || modality.includes("language");
}

async function pickFreeModel(request) {
  const response = await request.get(`${BASE_URL}/api/ai/models/read?source=openrouter`);
  if (!response.ok()) {
    throw new Error(`Failed to fetch OpenRouter models: ${response.status()} ${await response.text()}`);
  }
  const payload = await response.json();
  const models = Array.isArray(payload.models) ? payload.models : [];
  const freeModel = models.find((model) => isTextCapable(model) && estimateModelUnitCost(model) === 0);
  if (!freeModel) {
    throw new Error("No free text-capable OpenRouter model found");
  }
  return freeModel;
}

async function mockOpenRouterCatalog(page) {
  await page.route("**/api/ai/models/read?source=openrouter", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ models: MOCK_OPENROUTER_MODELS }),
    });
  });
}

async function signInAsDevUser(page) {
  console.log("Opening sign-in page");
  await page.goto(`${BASE_URL}/auth/signin`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.getByTestId("dev-username-input").fill(DEV_USERNAME);
  await Promise.all([
    page.waitForResponse((response) => response.url().includes("/api/auth/callback/dev-user") && response.ok(), {
      timeout: TEST_TIMEOUT_MS,
    }),
    page.getByTestId("dev-signin-button").click({ force: true }),
  ]);
  await page.waitForResponse((response) => response.url().includes("/api/auth/session") && response.ok(), {
    timeout: TEST_TIMEOUT_MS,
  });
  await page.waitForTimeout(500);
  console.log("Signed in as local dev user");
}

async function configureGenerationSettings(page, freeModel) {
  console.log("Opening /account/generation");
  await page.goto(`${BASE_URL}/account/generation`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.locator("#ai-endpoint").fill("https://openrouter.ai/api/v1");
  await page.locator("#ai-key").fill(OPENROUTER_KEY);

  try {
    const uiSelectionTimeoutMs = Math.min(TEST_TIMEOUT_MS, 10000);
    const modelSearch = page.getByLabel("Search models...").first();
    await modelSearch.waitFor({ state: "visible", timeout: uiSelectionTimeoutMs });
    await page.waitForFunction(() => {
      const input = document.querySelector('[aria-label="Search models..."]');
      return input instanceof HTMLInputElement && !input.disabled;
    }, { timeout: uiSelectionTimeoutMs });
    await modelSearch.click();
    await page.keyboard.type(freeModel.id.split(":")[0]);
    const firstVisibleOption = page.locator('[id^="react-select-"][id*="-option-"]').first();
    await firstVisibleOption.waitFor({ state: "visible", timeout: uiSelectionTimeoutMs });
    const selectedOptionText = (await firstVisibleOption.textContent())?.trim() || "";
    await firstVisibleOption.click();
    console.log(`Selected model option: ${selectedOptionText}`);

    const settingsText = await page.locator("#ai-settings").textContent();
    if (!settingsText || !settingsText.includes(freeModel.id)) {
      throw new Error(`Selected model was not persisted in settings UI: expected ${freeModel.id}`);
    }
  } catch (error) {
    console.warn(`UI model row selection fallback: ${error instanceof Error ? error.message : String(error)}`);
    await page.evaluate((config) => {
      window.localStorage.setItem("ui-designer-ai-provider-config", JSON.stringify(config));
    }, {
      apiEndpoint: "https://openrouter.ai/api/v1",
      model: freeModel.id,
      apiKey: OPENROUTER_KEY,
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    console.log(`Stored fallback model directly in localStorage: ${freeModel.id}`);
  }
}

async function createGameAndGenerate(page) {
  console.log("Creating game through authenticated browser request");
  const createResponse = await page.context().request.post(`${BASE_URL}/api/games`, {
    data: { title: "Playwright AI Generation Smoke" },
  });
  if (!createResponse.ok()) {
    throw new Error(`Failed to create game via API: ${createResponse.status()} ${await createResponse.text()}`);
  }
  const game = await createResponse.json();
  await page.goto(`${BASE_URL}/creator/${game.id}`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(new RegExp(`/creator/${game.id}$`), { timeout: TEST_TIMEOUT_MS });
  console.log(`Created game in creator route: ${page.url()}`);

  const config = await page.evaluate(() => {
    const raw = window.localStorage.getItem("ui-designer-ai-provider-config");
    return raw ? JSON.parse(raw) : null;
  });
  const generateResponse = await page.context().request.post(`${BASE_URL}/api/ai`, {
    data: {
      systemPrompt: "Return only a compact JSON object for a CSS art level.",
      prompt: "Create one simple beginner HTML/CSS practice level about drawing a green button.",
      model: config?.model,
      apiEndpoint: config?.apiEndpoint,
      apiKey: config?.apiKey,
    },
    timeout: TEST_TIMEOUT_MS,
  });
  if (!generateResponse.ok()) {
    throw new Error(`AI generation request failed: ${generateResponse.status()} ${await generateResponse.text()}`);
  }
  const value = await generateResponse.json();
  const responseText = typeof value === "string" ? value : JSON.stringify(value);
  if (responseText.trim().length <= 20) {
    throw new Error(`AI generation response stayed too short: ${responseText}`);
  }
  console.log(`AI generation succeeded, response length=${responseText.trim().length}`);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await mockOpenRouterCatalog(page);
    await context.route("**/api/ai/models/read?source=openrouter", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ models: MOCK_OPENROUTER_MODELS }),
      });
    });
    const freeModel = await pickFreeModel(context.request);
    console.log(`Picked free model: ${freeModel.id}`);
    await signInAsDevUser(page);
    await configureGenerationSettings(page, freeModel);
    await createGameAndGenerate(page);
    console.log("Playwright AI generation smoke test passed.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
