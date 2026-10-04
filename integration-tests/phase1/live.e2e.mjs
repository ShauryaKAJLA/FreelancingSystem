import assert from "node:assert/strict";
(async () => {
  const store_ = new Map();
  globalThis.sessionStorage = {
    getItem: (k) => store_.get(k) ?? null,
    setItem: (k, v) => store_.set(k, String(v)),
    removeItem: (k) => store_.delete(k),
  };
  const { store } =
    await import("../../frontend/src/modules/app/store/store.js");
  const { authApi } =
    await import("../../frontend/src/modules/auth/authApi.js");
  const { setSession } =
    await import("../../frontend/src/modules/auth/authSlice.js");
  const { http, request } =
    await import("../../frontend/src/modules/shared/api/http.js");
  const d = (a) => store.dispatch(a);
  const results = [];
  const t = async (name, fn) => {
    try {
      await fn();
      results.push("PASS " + name);
    } catch (e) {
      results.push("FAIL " + name + " -> " + e.message);
    }
  };

  await t(
    "login (same call the LoginPage makes) returns currentUser shape + token",
    async () => {
      const { data, error } = await d(
        authApi.endpoints.login.initiate({
          email: "meera.iyer@dev.com",
          role: "Freelancer",
          password: "Password@123",
        }),
      );
      assert.equal(error, undefined);
      assert.deepEqual(Object.keys(data).sort(), [
        "email",
        "name",
        "role",
        "token",
        "userId",
      ]);
      d(setSession(data));
      const u = store.getState().auth.currentUser;
      assert.deepEqual(Object.keys(u).sort(), [
        "email",
        "name",
        "role",
        "userId",
      ]); // token NOT in redux state
      assert.ok(store_.get("ff_token")); // token in tokenStore
    },
  );
  await t("wrong password -> error.data is a plain string", async () => {
    const { error } = await d(
      authApi.endpoints.login.initiate({
        email: "meera.iyer@dev.com",
        role: "Freelancer",
        password: "bad",
      }),
    );
    assert.equal(error.status, 401);
    assert.equal(error.data, "Invalid email or password");
  });
  await t("role mismatch -> mock-style message string", async () => {
    const { error } = await d(
      authApi.endpoints.login.initiate({
        email: "meera.iyer@dev.com",
        role: "Client",
        password: "Password@123",
      }),
    );
    assert.match(error.data, /selected role/);
  });
  await t(
    "register validation errors are flattened into one string",
    async () => {
      const { error } = await d(
        authApi.endpoints.register.initiate({
          name: "A",
          email: "nope",
          role: "Client",
          password: "x",
        }),
      );
      assert.equal(error.status, 400);
      assert.equal(typeof error.data, "string");
      assert.match(error.data, /password/);
    },
  );
  await t("register success returns a session with a token", async () => {
    const { data, error } = await d(
      authApi.endpoints.register.initiate({
        name: "New Client",
        email: "new@x.com",
        role: "Client",
        password: "Password@123",
      }),
    );
    assert.equal(error, undefined);
    assert.equal(data.role, "Client");
    assert.ok(data.userId && data.token);
  });
  await t("duplicate email -> 409 string", async () => {
    const { error } = await d(
      authApi.endpoints.register.initiate({
        name: "Dup",
        email: "meera.iyer@dev.com",
        role: "Client",
        password: "Password@123",
      }),
    );
    assert.equal(error.status, 409);
    assert.match(error.data, /already exists/);
  });
  await t("token is sent as Bearer: GET /auth/me works", async () => {
    const r = await request("get", "/auth/me");
    assert.equal(r.data.user.userId, store.getState().auth.currentUser.userId);
  });
  await t("expired/invalid token (401) auto-signs the user out", async () => {
    store_.set("ff_token", "garbage.token.value");
    const r = await request("get", "/auth/me");
    assert.equal(r.error.status, 401);
    assert.equal(store.getState().auth.currentUser, null);
    assert.equal(store_.get("ff_token"), undefined);
  });
  await t("unknown route -> clean string error", async () => {
    const r = await request("get", "/nope");
    assert.equal(r.error.status, 404);
    assert.equal(typeof r.error.data, "string");
  });
  console.log(results.join("\n"));
  process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
})();
