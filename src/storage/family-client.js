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

  async function request(path, {
    method = "GET",
    body,
    csrf = false,
  } = {}) {
    const headers = {};
    if (body !== undefined) headers["content-type"] = "application/json";
    if (csrf) headers["x-csrf-token"] = csrfToken();
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

    async deleteChild(childId) {
      await request(`/api/v1/family/children/${childId}`, {
        method: "DELETE",
        csrf: true,
      });
      if (activeChild()?.id === childId) setActiveChild(null);
    },

    async logout() {
      await request("/api/v1/family/session", {
        method: "DELETE",
        csrf: true,
      });
      storage.removeItem(CSRF_KEY);
      storage.removeItem(ACTIVE_CHILD_KEY);
      storage.removeItem(SYNC_STATUS_KEY);
      storage.removeItem(FAMILY_TIME_ZONE_KEY);
    },

    async deleteFamily() {
      await request("/api/v1/family/passports/current", {
        method: "DELETE",
        csrf: true,
      });
      storage.removeItem(CSRF_KEY);
      storage.removeItem(ACTIVE_CHILD_KEY);
      storage.removeItem(SYNC_STATUS_KEY);
      storage.removeItem(FAMILY_TIME_ZONE_KEY);
    },
  });
}
