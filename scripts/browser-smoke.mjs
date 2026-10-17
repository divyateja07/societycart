import { createRequire } from "node:module";
import { readFile, mkdir } from "node:fs/promises";
import { randomUUID, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
const require = createRequire(
  new URL("../frontend/package.json", import.meta.url),
);
const { chromium } = require("playwright");
const root = new URL("../", import.meta.url);
const config = Object.fromEntries(
  (await readFile(new URL(".env", root), "utf8"))
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
);
const base = process.env.SOCIETYCART_BASE_URL || "http://127.0.0.1:5173";
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
  args: ["--no-sandbox"],
});
const errors = [];
const stamp = randomUUID().slice(0, 8);
const password = randomBytes(24).toString("base64url");
const resident = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const admin = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await resident.newPage();
const adminPage = await admin.newPage();
for (const p of [page, adminPage])
  p.on("pageerror", (e) => errors.push(e.message));
async function request(context, path, method = "GET", data) {
  const csrf = await (
    await context.request.get(base + "/api/v1/auth/csrf")
  ).json();
  const res = await context.request.fetch(base + "/api/v1" + path, {
    method,
    data,
    headers: { [csrf.headerName]: csrf.token },
  });
  assert.ok(res.ok(), `${method} ${path}: ${res.status()} ${await res.text()}`);
  return res.json();
}
async function register(p, name, email) {
  await p.goto(base + "/register");
  await p.getByLabel("Your name").fill(name);
  await p.getByLabel("Email address").fill(email);
  await p.getByLabel(/^Password/).fill(password);
  await p.getByLabel("Confirm password").fill(password);
  await p.getByRole("button", { name: "Create account" }).click();
  await p.waitForURL("**/societies");
}
try {
  await mkdir(new URL("docs/screenshots/", root), { recursive: true });
  await page.goto(base);
  await page.getByRole("heading", { name: /Good groceries/ }).waitFor();
  await page.screenshot({
    path: new URL("docs/screenshots/home-desktop.png", root).pathname,
    fullPage: true,
  });
  const email = `browser-${stamp}@example.test`;
  await register(page, "Browser resident " + stamp, email);
  await page.getByPlaceholder("e.g. A-204").fill("A-204");
  await page
    .locator("article")
    .filter({ hasText: "Green Valley Apartments" })
    .getByRole("button", { name: "Request to join" })
    .click();
  await page.getByText("PENDING", { exact: true }).waitFor();
  await adminPage.goto(base + "/login");
  await adminPage.getByLabel("Email address").fill(config.ADMIN_EMAIL);
  await adminPage.getByLabel(/^Password/).fill(config.ADMIN_PASSWORD);
  await adminPage.getByRole("button", { name: "Sign in" }).click();
  await adminPage.waitForURL("**/societies");
  await adminPage.getByRole("link", { name: "Admin", exact: true }).click();
  await adminPage
    .getByRole("button", { name: "Memberships", exact: true })
    .click();
  const membershipCard = adminPage
    .locator("article")
    .filter({ hasText: email });
  await membershipCard
    .getByRole("button", { name: "Approve", exact: true })
    .click();
  await membershipCard.getByText("APPROVED", { exact: true }).waitFor();
  const societies = await request(admin, "/societies");
  const society = societies.find((s) => s.name === "Green Valley Apartments");
  const products = await request(admin, "/products");
  const product = products.find((p) => p.name === "Basmati rice");
  const suppliers = await request(admin, "/admin/suppliers");
  const cycleName = "Browser collective " + stamp;
  const cycle = await request(admin, "/admin/cycles", "POST", {
    societyId: society.id,
    name: cycleName,
    startsAt: new Date(Date.now() - 60000).toISOString(),
    cutoffAt: new Date(Date.now() + 3600000).toISOString(),
    minimumPaise: 125000,
    prices: [
      {
        productId: product.id,
        supplierId: suppliers[0].id,
        pricePaise: 62500,
        referencePaise: 75000,
        costPaise: 56000,
        referenceSource: "Illustrative browser-test price",
        stock: 10,
      },
    ],
  });
  await page.goto(base + "/shop");
  await page.getByLabel("Buying cycle").selectOption(cycle.id);
  await page.getByRole("heading", { name: cycleName, exact: true }).waitFor();
  await page
    .locator(".product-card")
    .filter({ hasText: "Basmati rice" })
    .getByRole("button", { name: "Add", exact: true })
    .click();
  await page.getByRole("link", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "Confirm order" }).click();
  await page
    .getByRole("button", { name: "Simulate successful payment" })
    .click();
  await page.waitForURL("**/orders");
  await page.getByText("Payment: PAID", { exact: true }).waitFor();
  // A second household joins the same cycle through authenticated API requests.
  const other = await browser.newContext();
  const secondEmail = `browser-other-${stamp}@example.test`;
  await request(other, "/auth/register", "POST", {
    name: "Second household " + stamp,
    email: secondEmail,
    password,
  });
  await request(other, "/auth/login", "POST", { email: secondEmail, password });
  await request(other, "/memberships", "POST", {
    societyId: society.id,
    flat: "B-102",
  });
  const memberships = await request(admin, "/admin/memberships");
  const otherMembership = memberships.find((m) => m.email === secondEmail);
  await request(admin, "/admin/memberships/" + otherMembership.id, "PATCH", {
    status: "APPROVED",
  });
  const secondOrder = await request(other, "/orders", "POST", {
    cycleId: cycle.id,
    idempotencyKey: randomUUID(),
    method: "COLLECTION",
    items: [{ productId: product.id, quantity: 1 }],
  });
  await request(other, "/payments/simulate", "POST", {
    orderId: secondOrder.id,
    success: true,
  });
  const progress = await request(resident, "/cycles/" + cycle.id + "/progress");
  assert.equal(Number(progress.paid_paise), 125000);
  assert.equal(Number(progress.orders), 2);
  await adminPage.reload();
  await adminPage
    .getByRole("button", { name: "Buying cycles", exact: true })
    .click();
  const cycleCard = adminPage.locator("article").filter({ hasText: cycleName });
  await cycleCard.getByRole("button", { name: "Close cycle now" }).click();
  await cycleCard.getByText(/SUCCESS/).waitFor();
  await cycleCard.getByRole("button", { name: "Supplier summary" }).click();
  await adminPage.getByText(/Basmati rice × 2/).waitFor();
  const summary = await request(
    admin,
    "/admin/cycles/" + cycle.id + "/summary",
  );
  assert.equal(Number(summary[0].quantity), 2);
  await adminPage.getByRole("button", { name: "Orders", exact: true }).click();
  const orderCard = adminPage
    .locator("article")
    .filter({ hasText: "Browser resident " + stamp });
  for (const status of [
    "SUPPLIER_CONFIRMED",
    "PACKED",
    "READY_FOR_COLLECTION",
    "DELIVERED",
  ]) {
    await orderCard.getByLabel("Fulfillment status").selectOption(status);
    await adminPage.getByRole("status").waitFor();
    await page.waitForTimeout(150);
  }
  await page.reload();
  await page.getByText("DELIVERED", { exact: true }).waitFor();
  await page.goto(base + "/shop");
  await page.screenshot({
    path: new URL("docs/screenshots/catalog-desktop.png", root).pathname,
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(base);
  await page.screenshot({
    path: new URL("docs/screenshots/home-mobile.png", root).pathname,
    fullPage: true,
  });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "Mobile home must not overflow",
  );
  await page.goto(base + "/shop");
  await page.getByRole("heading", { name: "Your pantry favourites" }).waitFor();
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
    "Mobile catalog must not overflow",
  );
  await page.screenshot({
    path: new URL("docs/screenshots/catalog-mobile.png", root).pathname,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await page.waitForURL("**/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel(/^Password/).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/societies");
  await page.getByText("APPROVED", { exact: true }).waitFor();
  const metrics = await request(admin, "/admin/dashboard");
  assert.ok(Number(metrics.sales.gmv_paise) >= 125000);
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "PASS: browser registration, membership approval, two-household paid collective, procurement, fulfillment, analytics, and mobile layout.",
  );
} catch (error) {
  await page
    .screenshot({
      path: new URL("docs/screenshots/browser-failure.png", root).pathname,
      fullPage: true,
    })
    .catch(() => {});
  throw error;
} finally {
  await browser.close();
}
