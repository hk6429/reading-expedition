const CSRF_KEY = "reading-expedition:family-csrf";
const ACTIVE_CHILD_KEY = "reading-expedition:active-child";
const SYNC_STATUS_KEY = "reading-expedition:family-sync-status";
const FAMILY_TIME_ZONE_KEY = "reading-expedition:family-time-zone";

async function readPayload(response) {
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(
      payload.error?.message ?? "家庭護照暫時無法使用。",
    );
    error.code = payload.error?.code ?? "family_request_failed";
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function createFamilyClient({
  fetchImpl = fetch,
  storage = window.localStorage,
} = {}) {
  function csrfToken() {
    return storage.getItem(CSRF_KEY) ?? "";
  }

  function timeZone() {
    return storage.getItem(FAMILY_TIME_ZONE_KEY) || null;
  }

  function activeChild() {
    try {
      const value = JSON.parse(storage.getItem(ACTIVE_CHILD_KEY) ?? "null");
      return value && typeof value.id === "string" ? value : null;
    } catch {
      return null;
    }
  }

  function syncStatus() {
    try {
      const value = JSON.parse(storage.getItem(SYNC_STATUS_KEY) ?? "null");
      return value && typeof value.status === "string"
        ? value
        : { status: "idle" };
    } catch {
      return { status: "idle" };
    }
  }

  function setSyncStatus(status) {
    storage.setItem(SYNC_STATUS_KEY, JSON.stringify(status));
  }

  function setActiveChild(child) {
    if (!child) {
      storage.removeItem(ACTIVE_CHILD_KEY);
      storage.removeItem(SYNC_STATUS_KEY);
      return;
    }
    storage.setItem(
      ACTIVE_CHILD_KEY,
      JSON.stringify({
        id: child.id,
        alias: child.alias,
        stateVersion: Number(child.stateVersion ?? child.version ?? 1),
      }),
    );
    if (syncStatus().status === "idle") {
      setSyncStatus({
        status: "synced",
        syncedAt: new Date().toISOString(),
      });
    }
  }

  function clearLocal({ clearDevice = false } = {}) {
    const keys = [
      CSRF_KEY,
      ACTIVE_CHILD_KEY,
      SYNC_STATUS_KEY,
      FAMILY_TIME_ZONE_KEY,
    ];
    if (clearDevice && Number.isInteger(storage.length) && storage.key) {
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key?.startsWith("reading-expedition")) keys.push(key);
      }
    }
    for (const key of new Set(keys)) storage.removeItem(key);
  }

  async function request(path, {
    method = "GET",
    body,
    csrf = false,
    csrfTokenOverride = "",
  } = {}) {
    const headers = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (csrf) headers["x-csrf-token"] = csrfTokenOverride || csrfToken();
    const response = await fetchImpl(path, {
      method,
      headers,
      credentials: "same-origin",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return readPayload(response);
  }

  function rememberSession(payload) {
    if (payload?.csrfToken) storage.setItem(CSRF_KEY, payload.csrfToken);
    if (payload?.family?.timeZone) {
      storage.setItem(FAMILY_TIME_ZONE_KEY, payload.family.timeZone);
    }
    return payload;
  }

  return Object.freeze({
    csrfToken,
    timeZone,
    activeChild,
    syncStatus,
    markPending() {
      if (!activeChild()) return;
      setSyncStatus({
        status: "pending",
        pendingSince: new Date().toISOString(),
      });
    },
    setActiveChild,

    async createPassport(timeZone) {
      return rememberSession(
        await request("/api/v1/family/passports", {
          method: "POST",
          body: { timeZone },
        }),
      );
    },

    async login(passportCode) {
      return rememberSession(
        await request("/api/v1/family/session", {
          method: "POST",
          body: { passportCode },
        }),
      );
    },

    async current() {
      try {
        const status = await request("/api/v1/family/session/status");
        if (!status?.authenticated) {
          clearLocal();
          return { family: null };
        }
        return rememberSession(
          await request("/api/v1/family/passports/current"),
        );
      } catch (error) {
        if (error.status === 401) {
          storage.removeItem(CSRF_KEY);
          storage.removeItem(ACTIVE_CHILD_KEY);
          storage.removeItem(FAMILY_TIME_ZONE_KEY);
        }
        throw error;
      }
    },

    async createChild(alias, state) {
      const payload = await request("/api/v1/family/children", {
        method: "POST",
        csrf: true,
        body: { alias, state },
      });
      return payload.child;
    },

    async childState(childId) {
      return request(`/api/v1/family/children/${childId}/state`);
    },

    async activateChild(child) {
      const record = await request(
        `/api/v1/family/children/${child.id}/state`,
      );
      setActiveChild({
        id: child.id,
        alias: child.alias,
        stateVersion: record.version,
      });
      return record;
    },

    async syncActiveChild(state) {
      const child = activeChild();
      if (!child) return null;
      setSyncStatus({
        status: "pending",
        pendingSince: new Date().toISOString(),
      });
      try {
        const record = await request(
          `/api/v1/family/children/${child.id}/state`,
          {
            method: "PUT",
            csrf: true,
            body: {
              state,
              expectedVersion: child.stateVersion,
            },
          },
        );
        setActiveChild({
          ...child,
          stateVersion: record.version,
        });
        setSyncStatus({
          status: "synced",
          syncedAt: new Date().toISOString(),
          version: record.version,
        });
        return record;
      } catch (error) {
        setSyncStatus({
          status:
            error.code === "version_conflict" ? "conflict" : "error",
          failedAt: new Date().toISOString(),
          errorCode: error.code ?? "family_request_failed",
          message: error.message,
        });
        throw error;
      }
    },

    async overwriteActiveChild(state) {
      const child = activeChild();
      if (!child) return null;
      const cloud = await request(
        `/api/v1/family/children/${child.id}/state`,
      );
      setActiveChild({ ...child, stateVersion: cloud.version });
      return this.syncActiveChild(state);
    },

    async deleteChild(childId) {
      await request(`/api/v1/family/children/${childId}`, {
        method: "DELETE",
        csrf: true,
      });
      if (activeChild()?.id === childId) setActiveChild(null);
    },

    async logout({ clearDevice = false } = {}) {
      const csrfTokenOverride = csrfToken();
      clearLocal({ clearDevice });
      await request("/api/v1/family/session", {
        method: "DELETE",
        csrf: true,
        csrfTokenOverride,
      });
    },

    async deleteFamily() {
      await request("/api/v1/family/passports/current", {
        method: "DELETE",
        csrf: true,
      });
      clearLocal();
    },
  });
}
