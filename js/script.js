function tcIsProbablyBot() {
  try {
    const ua = (navigator.userAgent || "").toLowerCase();
    return (
      !!ua &&
      (ua.includes("googlebot") ||
        ua.includes("bingbot") ||
        ua.includes("yandex") ||
        ua.includes("baiduspider") ||
        ua.includes("duckduckbot") ||
        ua.includes("slurp") ||
        ua.includes("bot") ||
        ua.includes("spider") ||
        ua.includes("crawler") ||
        ua.includes("lighthouse") ||
        ua.includes("pagespeed"))
    );
  } catch (_) {
    return !1;
  }
}
function tcBuildMakeFormBody(payload) {
  const data = new URLSearchParams();
  try {
    if (payload && "object" == typeof payload)
      for (const k of Object.keys(payload)) {
        const v = payload[k];
        if (void 0 !== v)
          if (null !== v)
            if ("object" != typeof v) data.append(k, String(v));
            else
              try {
                data.append(k, JSON.stringify(v));
              } catch (_) {
                data.append(k, String(v));
              }
          else data.append(k, "");
      }
  } catch (_) {}
  try {
    data.append("__payload_json", JSON.stringify(payload || {}));
  } catch (_) {
    data.append("__payload_json", "{}");
  }
  return data.toString();
}
async function tcSendPayloadToMake(webhookUrl, payload, controller) {
  console.log("[tcSendPayloadToMake] Iniciando envío a:", webhookUrl);
  let bodyJson = "{}";
  try {
    bodyJson = JSON.stringify(payload || {});
  } catch (_) {
    bodyJson = "{}";
  }
  const form = new FormData();
  try {
    if (payload && "object" == typeof payload)
      for (const k of Object.keys(payload)) {
        const v = payload[k];
        if (void 0 !== v)
          if (null !== v)
            if ("object" != typeof v) form.append(k, String(v));
            else
              try {
                form.append(k, JSON.stringify(v));
              } catch (_) {
                form.append(k, String(v));
              }
          else form.append(k, "");
      }
  } catch (_) {}
  try {
    const sendAt =
        payload && "object" == typeof payload ? payload.send_at_local : "",
      tripEnd =
        payload && "object" == typeof payload ? payload.trip_end_local : "";
    (null != sendAt &&
      String(sendAt).trim() &&
      form.append("trip.send_at_local", String(sendAt)),
      null != tripEnd &&
        String(tripEnd).trim() &&
        form.append("trip.trip_end_local", String(tripEnd)));
  } catch (_) {}
  try {
    form.append("__payload_json", bodyJson);
  } catch (_) {}
  try {
    "undefined" != typeof window && window.__tc_make_debug;
  } catch (_) {}
  // Deshabilitado sendBeacon porque no respeta credentials: "omit" y causa errores de CORS
  // try {
  //   if (
  //     "undefined" != typeof navigator &&
  //     "function" == typeof navigator.sendBeacon
  //   ) {
  //     console.log("[tcSendPayloadToMake] Intentando sendBeacon");
  //     const blob = new Blob([bodyJson], { type: "application/json" });
  //     if (navigator.sendBeacon(webhookUrl, blob)) {
  //       console.log("[tcSendPayloadToMake] sendBeacon exitoso");
  //       return;
  //     }
  //   }
  // } catch (e) {
  //   console.error("[tcSendPayloadToMake] Error en sendBeacon:", e);
  // }
  try {
    console.log("[tcSendPayloadToMake] Intentando fetch con credentials: omit");
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: bodyJson,
      credentials: "omit",
      signal: controller ? controller.signal : void 0,
    });
    console.log("[tcSendPayloadToMake] Response status:", response.status);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    console.log("[tcSendPayloadToMake] Fetch exitoso");
  } catch (e) {
    console.error("[tcSendPayloadToMake] Error en fetch:", e);
    throw e;
  }
}
async function tcSendBookingToMake() {
  try {
    if ("undefined" != typeof window) {
      const now = Date.now(),
        last = window.__tc_last_make_booking_send_at || 0;
      if (window.__tc_make_booking_inflight) {
        console.warn("[tcSendBookingToMake] Bloqueado: make_booking_inflight ya está activo");
        return !1;
      }
      if (now - last < 5e3) {
        console.warn("[tcSendBookingToMake] Bloqueado: rate limit (menos de 5 segundos desde último envío)");
        return !1;
      }
      ((window.__tc_make_booking_inflight = !0),
        (window.__tc_last_make_booking_send_at = now));
    }
  } catch (_) {}
  const webhookUrl = tcGetConfiguredMakeReviewWebhookUrl();
  if (!webhookUrl) {
    console.error("[tcSendBookingToMake] Error: webhookUrl no configurado");
    return !1;
  }
  const params = buildTemplateParamsForEmailJS(),
    returnTripSelected = !!document.getElementById("return-trip-yes")?.checked,
    idaStart = tcParseLocalDateFromInputs("fecha-book", "hora-book"),
    wantsReturn = !!(
      (currentBookingDetails && currentBookingDetails.returnTrip) ||
      returnTripSelected
    ),
    vueltaStartCandidate = wantsReturn
      ? tcParseLocalDateFromInputs("return-date", "return-time")
      : null,
    hasReturn = !(!wantsReturn || !vueltaStartCandidate),
    vueltaStart = hasReturn ? vueltaStartCandidate : null,
    idaDurationMinutes = estimateDurationMinutesFromText(
      document.getElementById("hidden-duracion-ida")?.value || "",
    ),
    vueltaDurationMinutes = estimateDurationMinutesFromText(
      document.getElementById("hidden-duracion-vuelta")?.value || "",
    ),
    lastStart = hasReturn && vueltaStart ? vueltaStart : idaStart,
    lastDuration =
      hasReturn && vueltaStart ? vueltaDurationMinutes : idaDurationMinutes;
  if (!lastStart) {
    console.error("[tcSendBookingToMake] Error: lastStart es null/undefined");
    return !1;
  }
  
  // NOTA: Las validaciones de campos críticos se realizan en el formulario submit
  // después de fillHiddenFields (líneas 11993-12010). Aquí asumimos que los datos
  // son válidos porque si no, el submit habría fallado antes.
  
  const tripEnd = new Date(
      lastStart.getTime() + 60 * (lastDuration + 30) * 1e3,
    ),
    reviewSendAt = tcBuildReviewSendAt(tripEnd),
    legs = [];
  let waIdaSendAtISO = "",
    waIdaForISO = "",
    waVueltaSendAtISO = "",
    waVueltaForISO = "";
  if (idaStart) {
    const sendAt = tcBuildWhatsAppReminderSendAt(idaStart);
    ((waIdaForISO = idaStart.toISOString()),
      (waIdaSendAtISO = sendAt ? sendAt.toISOString() : ""),
      legs.push({
        Leg: "ida",
        Reminder_For_ISO: waIdaForISO,
        Reminder_Send_At_ISO: waIdaSendAtISO,
      }));
  }
  if (vueltaStart) {
    const sendAt = tcBuildWhatsAppReminderSendAt(vueltaStart);
    ((waVueltaForISO = vueltaStart.toISOString()),
      (waVueltaSendAtISO = sendAt ? sendAt.toISOString() : ""),
      legs.push({
        Leg: "vuelta",
        Reminder_For_ISO: waVueltaForISO,
        Reminder_Send_At_ISO: waVueltaSendAtISO,
      }));
  }
  const langCode = (function () {
      const l =
        void 0 !== CURRENT_LANG && CURRENT_LANG
          ? String(CURRENT_LANG).toLowerCase()
          : "es";
      return "en" === l ? "EN" : "de" === l ? "DE" : "fr" === l ? "FR" : "ES";
    })(),
    rawEmailCandidate =
      document.getElementById("email")?.value || params.email || "",
    rawNameCandidate =
      document.getElementById("nombre")?.value || params.Nombre || "",
    normalizedEmail = ((value) => {
      const s = String(value || "").trim();
      if (!s) return "";
      const angle = s.match(/<\s*([^>\s]+@[^>\s]+)\s*>/);
      if (angle && angle[1]) return String(angle[1]).trim();
      const any = s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      return any && any[0] ? String(any[0]).trim() : s;
    })(rawEmailCandidate),
    normalizedName = String(rawNameCandidate || "").trim(),
    lastRouteText = hasReturn
      ? params.Trayecto_Vuelta || ""
      : params.Trayecto_Ida || "",
    destinationCity =
      tcGetLocalityFromPlace(
        void 0 !== autocompleteSelectedPlaces
          ? hasReturn
            ? autocompleteSelectedPlaces.destinoVuelta
            : autocompleteSelectedPlaces.destinoCalc
          : null,
      ) || tcExtractCityFromRouteText(lastRouteText),
    payload = {
      type: "booking",
      request_id: tcGenerateRequestId(),
      lang: void 0 !== CURRENT_LANG ? CURRENT_LANG : "es",
      ...params,
      Lang: langCode,
      Nombre: normalizedName,
      email: normalizedEmail,
      EMAIL: normalizedEmail,
      idioma: langCode,
      Fecha_envio: waIdaSendAtISO || "",
      Fecha_envio_vuelta: waVueltaSendAtISO || "",
      fecha_envio: waIdaSendAtISO || "",
      fecha_envio_vuelta: waVueltaSendAtISO || "",
      Envio_correo: 0,
      WhatsApp_Enviado: 0,
      Destino_Ciudad: destinationCity,
      Destino_Texto: lastRouteText,
      Has_Return: hasReturn ? "yes" : "no",
      Ida_Start_ISO: idaStart ? idaStart.toISOString() : "",
      Vuelta_Start_ISO: vueltaStart ? vueltaStart.toISOString() : "",
      Trip_End_ISO: tripEnd.toISOString(),
      Send_At_ISO: reviewSendAt ? reviewSendAt.toISOString() : "",
      Review_Send_At_ISO: reviewSendAt ? reviewSendAt.toISOString() : "",
      Leg: waIdaForISO ? "ida" : waVueltaForISO ? "vuelta" : "",
      Reminder_For_ISO: waIdaForISO || waVueltaForISO || "",
      Reminder_Send_At_ISO: waIdaSendAtISO || waVueltaSendAtISO || "",
      Leg_Ida: waIdaForISO ? "ida" : "",
      Reminder_For_ISO_Ida: waIdaForISO,
      Reminder_Send_At_ISO_Ida: waIdaSendAtISO,
      Leg_Vuelta: waVueltaForISO ? "vuelta" : "",
      Reminder_For_ISO_Vuelta: waVueltaForISO,
      Reminder_Send_At_ISO_Vuelta: waVueltaSendAtISO,
      customer: { name: normalizedName, email: normalizedEmail },
      booking: {
        has_return: hasReturn,
        last_leg: hasReturn ? "vuelta" : "ida",
        trayecto_ida: params.Trayecto_Ida || "",
        trayecto_vuelta: params.Trayecto_Vuelta || "",
        precio_total: params.Precio_Total_Reserva || "",
        destination_text: lastRouteText,
        destination_city: destinationCity,
      },
      trip_end_local: tripEnd.toISOString(),
      send_at_local: waIdaSendAtISO || waVueltaSendAtISO || "",
      trip_send_at_local: waIdaSendAtISO || waVueltaSendAtISO || "",
      trip_send_at_local_ida: waIdaSendAtISO || "",
      trip_send_at_local_vuelta: waVueltaSendAtISO || "",
      legs: legs,
      additional_trips: (window.additionalTrips || []).map((trip, index) => {
        let formattedDate = trip.date || "";
        if (trip.date && trip.date.includes("-")) {
          const parts = trip.date.split("-");
          if (3 === parts.length) {
            const [yyyy, mm, dd] = parts;
            formattedDate = `${dd}/${mm}/${yyyy}`;
          }
        }
        const distanceKm = typeof trip.distance === "number" ? parseFloat(trip.distance.toFixed(1)) : 0;
        const price = typeof trip.price === "number" ? Math.round(trip.price * 100) / 100 : 0;
        return `<h4 style="color:#1a2a45; font-size:13px; font-weight:700; margin:15px 0 10px 0; text-transform:uppercase;">Trayecto ${index + 1}</h4><table class="data-table"><tr><td class="label">Fecha/Hora</td><td class="value highlight-date">${formattedDate} ${trip.time || ""}</td></tr><tr><td class="label">Origen/Destino</td><td class="value">${trip.origin || ""} → ${trip.destination || ""}</td></tr><tr><td class="label">Distancia</td><td class="value">${distanceKm} km</td></tr><tr><td class="label">Duración</td><td class="value">${trip.duration || ""}</td></tr><tr><td class="label" style="color:#1a2a45; font-weight:800;">Precio</td><td class="value highlight-price">€${price}</td></tr></table>`;
      }).join(""),
      additional_trips_whatsapp: (window.additionalTrips || []).map((trip, index) => {
        let formattedDate = trip.date || "";
        if (trip.date && trip.date.includes("-")) {
          const parts = trip.date.split("-");
          if (3 === parts.length) {
            const [yyyy, mm, dd] = parts;
            formattedDate = `${dd}/${mm}/${yyyy}`;
          }
        }
        const distanceKm = typeof trip.distance === "number" ? parseFloat(trip.distance.toFixed(1)) : 0;
        const price = typeof trip.price === "number" ? Math.round(trip.price * 100) / 100 : 0;
        return `*Trayecto ${index + 1}*%0A📅 _${formattedDate} ${trip.time || ""}_%0A📍 ${trip.origin || ""} → ${trip.destination || ""}%0A📏 ${distanceKm} km%0A⏱️ ${trip.duration || ""}%0A💶 *€${price}*`;
      }).join("%0A%0A"),
    };
  let dedupKey = "";
  try {
    const fp = tcBuildBookingFingerprint(params);
    if (
      ((payload.booking_fingerprint = fp),
      fp &&
        ((dedupKey = "booking_" + fp), tcWasRecentlySentToMake(dedupKey, 12e4)))
    ) {
      console.warn("[tcSendBookingToMake] Bloqueado: duplicado detectado (dedupKey:", dedupKey + ")");
      return !1;
    }
  } catch (e) {
    console.error("[tcSendBookingToMake] Error en deduplication:", e);
  }
  const controller =
      "undefined" != typeof AbortController ? new AbortController() : null,
    timeout = setTimeout(() => {
      try {
        controller && controller.abort();
      } catch (_) {}
    }, 5e3);
  try {
    console.log("[tcSendBookingToMake] Enviando payload a Make:", webhookUrl);
    await tcSendPayloadToMake(webhookUrl, payload, controller);
    try {
      dedupKey && tcMarkSentToMake(dedupKey);
    } catch (_) {}
    console.log("[tcSendBookingToMake] Envío exitoso a Make");
    return !0;
  } catch (error) {
    console.error("[tcSendBookingToMake] Error al enviar a Make:", error);
    return !1;
  } finally {
    try {
      "undefined" != typeof window && (window.__tc_make_booking_inflight = !1);
    } catch (_) {}
    clearTimeout(timeout);
  }
}
function tcGetManuallyChosenLang() {
  try {
    const manual = (localStorage.getItem("tcLangManual") || "").toLowerCase();
    if ("1" !== manual && "true" !== manual) return null;
    const stored = (
      localStorage.getItem("tcPreferredLang") || ""
    ).toLowerCase();
    return "es" === stored ||
      "en" === stored ||
      "de" === stored ||
      "fr" === stored
      ? stored
      : null;
  } catch (_) {
    return null;
  }
}
function tcInferBrowserLang() {
  try {
    const langs = (
        navigator.languages && navigator.languages.length
          ? navigator.languages
          : [navigator.language]
      ).filter(Boolean),
      primary = String(langs[0] || "").toLowerCase();
    return primary.startsWith("de")
      ? "de"
      : primary.startsWith("en")
        ? "en"
        : primary.startsWith("es")
          ? "es"
          : "en";
  } catch (_) {
    return "en";
  }
}
function tcEnsureMobileOnlyQuickIconsCSS() {
  try {
    if ("undefined" == typeof document) return;
    if (document.getElementById("tc-mobile-only-quick-icons-style")) return;
    const style = document.createElement("style");
    ((style.id = "tc-mobile-only-quick-icons-style"),
      (style.textContent =
        "@media (min-width: 993px){/* .nav-links .nav-quick-icons{display:none!important} */}@media (max-width:667px){.nav-links .nav-quick-flags{display:flex!important;flex-wrap:wrap!important;gap:.6rem!important;justify-content:center!important;align-items:center!important}.nav-links .nav-quick-flags a{display:inline-flex!important;align-items:center!important;justify-content:center!important}}"),
      document.head.appendChild(style));
  } catch (_) {}
}
function tcFixFrenchFlagIcons(root) {
  try {
    if ("undefined" == typeof document) return;
    const scope = root || document;
    scope
      .querySelectorAll(".nav-quick-flags a[href], .nav-flags a[href]")
      .forEach((a) => {
        try {
          const href = a.getAttribute("href") || "";
          if ("fr" !== tcGetLangFromHref(href)) return;
          const img = a.querySelector("img");
          if (!img) return;
          ((img.src = "/IMG/flags/fr.svg?v=20260313-1235"),
            img.getAttribute("width") || img.setAttribute("width", "20"),
            img.getAttribute("height") || img.setAttribute("height", "15"));
        } catch (_) {}
      });
  } catch (_) {}
}
function tcNormalizePathname(pathname) {
  try {
    if (!pathname) return "/";
    const normalized = pathname.startsWith("/") ? pathname : "/" + pathname;
    return "/index.html" === normalized ? "/" : normalized;
  } catch (_) {
    return "/";
  }
}
function tcRunWhenIdle(fn, timeoutMs = 1500) {
  try {
    if (
      "undefined" != typeof window &&
      "function" == typeof window.requestIdleCallback
    )
      return void window.requestIdleCallback(
        () => {
          try {
            fn();
          } catch (_) {}
        },
        { timeout: timeoutMs },
      );
  } catch (_) {}
  try {
    setTimeout(() => {
      try {
        fn();
      } catch (_) {}
    }, 0);
  } catch (_) {}
}
function tcInferPreferredLang() {
  try {
    const stored = (
      localStorage.getItem("tcPreferredLang") || ""
    ).toLowerCase();
    if (
      "es" === stored ||
      "en" === stored ||
      "de" === stored ||
      "fr" === stored
    )
      return stored;
  } catch (_) {}
  try {
    const langs = (
        navigator.languages && navigator.languages.length
          ? navigator.languages
          : [navigator.language]
      ).filter(Boolean),
      primary = String(langs[0] || "").toLowerCase();
    return primary.startsWith("de")
      ? "de"
      : primary.startsWith("en")
        ? "en"
        : primary.startsWith("es")
          ? "es"
          : "en";
  } catch (_) {
    return "en";
  }
}
function tcGetCurrentLangFromPath(pathname) {
  try {
    const p = tcNormalizePathname(pathname);
    return "/" === p
      ? "es"
      : "/fr" === p
        ? "fr"
        : "/en" === p
          ? "en"
          : "/de" === p
            ? "de"
            : p.startsWith("/fr/")
              ? "fr"
              : p.startsWith("/en/")
                ? "en"
                : p.startsWith("/de/")
                  ? "de"
                  : p.endsWith("-fr.html") ||
                      p.includes("-fr.html#") ||
                      p.includes("-fr.html?")
                    ? "fr"
                    : p.endsWith("-de.html") ||
                        p.includes("-de.html#") ||
                        p.includes("-de.html?")
                      ? "de"
                      : p.endsWith("-en.html") ||
                          p.includes("-en.html#") ||
                          p.includes("-en.html?")
                        ? "en"
                        : "/index-de.html" === p
                          ? "de"
                          : "/index-en.html" === p
                            ? "en"
                            : "es";
  } catch (_) {
    return "es";
  }
}
function tcLocalizedPathForLang(pathname, lang) {
  const p = tcNormalizePathname(pathname);
  if (
    "/" === p ||
    "/en" === p ||
    "/de" === p ||
    "/index-en.html" === p ||
    "/index-de.html" === p
  )
    return "en" === lang ? "/en" : "de" === lang ? "/de" : "/";
  if (!p.endsWith(".html")) return p;
  const base = p.replace(/-(en|de)\.html$/i, ".html");
  return "es" === lang
    ? base
    : "en" === lang
      ? base.replace(/\.html$/i, "-en.html")
      : "de" === lang
        ? base.replace(/\.html$/i, "-de.html")
        : base;
}
function tcMaybeRedirectByLanguage() {
  try {
    if (tcIsProbablyBot()) return;
    const url = new URL(window.location.href);
    if (url.searchParams.has("noLangRedirect")) return;
    const pathname = tcNormalizePathname(url.pathname),
      manuallyChosen = tcGetManuallyChosenLang(),
      preferred = manuallyChosen || tcInferBrowserLang(),
      current = tcGetCurrentLangFromPath(pathname);
    if ("/" !== pathname) return;
    if (manuallyChosen) return;
    if ("es" !== current) return;
    if (preferred === current) return;
    const targetPath = tcLocalizedPathForLang(pathname, preferred);
    if (!targetPath || targetPath === pathname) return;
    url.pathname = targetPath;
    const target = url.pathname + url.search + url.hash;
    target !== pathname + url.search + url.hash &&
      window.location.replace(target);
  } catch (_) {}
}
function tcGetLangFromHref(href) {
  try {
    if ("undefined" == typeof window) return null;
    if (!href) return null;
    const p = tcNormalizePathname(
      new URL(href, window.location.origin).pathname,
    );
    return "/fr" === p
      ? "fr"
      : "/en" === p
        ? "en"
        : "/de" === p
          ? "de"
          : p.startsWith("/fr/")
            ? "fr"
            : p.startsWith("/en/")
              ? "en"
              : p.startsWith("/de/")
                ? "de"
                : "/index-en.html" === p || /-en\.html$/i.test(p)
                  ? "en"
                  : "/index-de.html" === p || /-de\.html$/i.test(p)
                    ? "de"
                    : "/index-fr.html" === p || /-fr\.html$/i.test(p)
                      ? "fr"
                      : "/" === p || "/index.html" === p || /\.html$/i.test(p)
                        ? "es"
                        : null;
  } catch (_) {
    return null;
  }
}
function tcInstallLangChoiceListener() {
  try {
    if ("undefined" == typeof document) return;
    document.addEventListener(
      "click",
      function (e) {
        try {
          const a =
            e && e.target && e.target.closest
              ? e.target.closest("a[href]")
              : null;
          if (!a) return;
          const href = a.getAttribute("href") || "";
          if (!href || href.startsWith("#") || href.startsWith("javascript:"))
            return;
          if (
            !!(
              !a.closest ||
              !a.closest(
                ".nav-flags, .nav-quick-flags, .lang-selector, .article-hero-lang-selector",
              )
            )
          )
            return;
          const lang = tcGetLangFromHref(href);
          if (!lang) return;
          if ("es" !== lang && "en" !== lang && "de" !== lang && "fr" !== lang)
            return;
          (localStorage.setItem("tcPreferredLang", lang),
            localStorage.setItem("tcLangManual", "1"));
        } catch (_) {}
      },
      { capture: !0 },
    );
  } catch (_) {}
}
var CURRENT_LANG = "";
function getCurrentLangFromDOM() {
  try {
    const lang = (
      (document.documentElement && document.documentElement.lang
        ? document.documentElement.lang
        : "") + ""
    ).toLowerCase();
    return lang.startsWith("en")
      ? "en"
      : lang.startsWith("de")
        ? "de"
        : lang.startsWith("fr")
          ? "fr"
          : "es";
  } catch (e) {
    return "es";
  }
}
function updateCurrentLang() {
  CURRENT_LANG = getCurrentLangFromDOM();
}
function tcHideCurrentLangInSelectors(root) {
  try {
    if ("undefined" == typeof document) return;
    const scope = root || document;
    let current = void 0 !== CURRENT_LANG ? CURRENT_LANG : null;
    current ||
      (current = tcGetCurrentLangFromPath(
        window.location && window.location.pathname
          ? window.location.pathname
          : "/",
      ));
    scope
      .querySelectorAll(
        ".lang-selector, .nav-flags, .nav-quick-flags, .article-hero-lang-selector",
      )
      .forEach((container) => {
        try {
          container.querySelectorAll("a[href]").forEach((a) => {
            try {
              const lang = tcGetLangFromHref(a.getAttribute("href") || "");
              if (!lang) return;
              if (lang !== current) return;
              try {
                (a.style.setProperty("visibility", "hidden", "important"),
                  a.style.setProperty("width", "0", "important"),
                  a.style.setProperty("min-width", "0", "important"),
                  a.style.setProperty("margin", "0", "important"),
                  a.style.setProperty("padding", "0", "important"),
                  a.style.setProperty("border", "none", "important"),
                  a.style.setProperty("opacity", "0", "important"));
              } catch (_) {
                ((a.style.visibility = "hidden"),
                  (a.style.width = "0"),
                  (a.style.minWidth = "0"),
                  (a.style.margin = "0"),
                  (a.style.padding = "0"),
                  (a.style.border = "none"),
                  (a.style.opacity = "0"));
              }
              (a.setAttribute("aria-hidden", "true"),
                a.setAttribute("tabindex", "-1"));
            } catch (_) {}
          });
        } catch (_) {}
      });
  } catch (_) {}
}
(updateCurrentLang(),
  "undefined" != typeof document &&
    ("loading" === document.readyState
      ? document.addEventListener("DOMContentLoaded", updateCurrentLang)
      : updateCurrentLang()));
try {
  tcInstallLangChoiceListener();
} catch (_) {}
try {
  "undefined" != typeof document &&
    ("loading" === document.readyState
      ? document.addEventListener("DOMContentLoaded", function () {
          try {
            tcHideCurrentLangInSelectors();
          } catch (_) {}
        })
      : tcHideCurrentLangInSelectors());
} catch (_) {}
let googleApiLoaded = !1;
try {
  if (
    "undefined" != typeof window &&
    void 0 === window.__tcConsoleWarnPatched
  ) {
    window.__tcConsoleWarnPatched = !0;
    const originalWarn = console.warn;
    console.warn = function () {
      try {
        if (
          (arguments && arguments.length
            ? String(arguments[0] || "")
            : ""
          ).includes(
            "google.maps.places.Autocomplete is not available to new customers",
          )
        )
          return;
      } catch (_) {}
      return originalWarn.apply(console, arguments);
    };
  }
} catch (_) {}
const autocompleteInstances = {
    origenCalc: null,
    destinoCalc: null,
    origenVuelta: null,
    destinoVuelta: null,
  },
  autocompleteSelectedPlaces = {
    origenCalc: null,
    destinoCalc: null,
    origenVuelta: null,
    destinoVuelta: null,
    additionalTripOrigen: null,
    additionalTripDestino: null,
  },
  autocompleteLastConfirmedText = {
    origenCalc: "",
    destinoCalc: "",
    origenVuelta: "",
    destinoVuelta: "",
    additionalTripOrigen: "",
    additionalTripDestino: "",
  },
  autocompleteSuppressNextInputInvalidation = {
    origenCalc: !1,
    destinoCalc: !1,
    origenVuelta: !1,
    destinoVuelta: !1,
    additionalTripOrigen: !1,
    additionalTripDestino: !1,
  },
  autocompleteSessionTokens = {
    origenCalc: null,
    destinoCalc: null,
    origenVuelta: null,
    destinoVuelta: null,
    additionalTripOrigen: null,
    additionalTripDestino: null,
  };
let routeMapInstance = null,
  routeMapPolyline = null,
  routeMapMarkers = [],
  currentRouteBounds = null,
  currentRouteOverviewPath = null,
  currentRouteStartLocation = null,
  currentRouteEndLocation = null,
  returnRouteMapInstance = null,
  returnRoutePolyline = null,
  returnRouteMarkers = [],
  currentReturnRouteBounds = null,
  additionalRouteMapInstance = null,
  additionalRoutePolyline = null,
  additionalRouteMarkers = [],
  currentAdditionalRouteBounds = null,
  currentAdditionalRouteOverviewPath = null,
  currentAdditionalRouteStartLocation = null,
  currentAdditionalRouteEndLocation = null,
  currentReturnRouteOverviewPath = null,
  currentReturnRouteStartLocation = null,
  currentReturnRouteEndLocation = null;
const MIN_LEAD_TIME_HOURS = 12,
  MIN_PRICE_DEFAULT = 45,
  FLAG_FALL = 5,
  RATE_WEEKDAY = 1.466,
  RATE_WEEKEND_NIGHT = 1.688,
  NIGHT_RATE_START_HOUR = 21.8333,
  NIGHT_RATE_END_HOUR = 7;
function selectBestRoute(routes) {
  if (!routes || !routes.length) return null;
  if (1 === routes.length) return routes[0];
  const routesWithWaypoints = routes.filter(
      (route) => route.waypoints && route.waypoints.length > 0,
    ),
    candidateRoutes =
      routesWithWaypoints.length > 0 ? routesWithWaypoints : routes,
    googleRecommended = routes[0],
    googleDistance = googleRecommended.legs[0].distance.value / 1e3;
  googleRecommended.legs[0].duration.value;
  let fastestRoute = candidateRoutes[0],
    fastestDuration = fastestRoute.legs[0].duration.value;
  for (let i = 1; i < candidateRoutes.length; i++) {
    const route = candidateRoutes[i],
      routeDuration = route.legs[0].duration.value;
    routeDuration < fastestDuration &&
      ((fastestRoute = route), (fastestDuration = routeDuration));
  }
  let shortestRoute = candidateRoutes[0],
    shortestDistance = shortestRoute.legs[0].distance.value / 1e3;
  for (let i = 1; i < candidateRoutes.length; i++) {
    const route = candidateRoutes[i],
      routeDistance = route.legs[0].distance.value / 1e3;
    routeDistance < shortestDistance &&
      ((shortestRoute = route), (shortestDistance = routeDistance));
  }
  const timeDifferenceSeconds = Math.abs(
    fastestDuration - shortestRoute.legs[0].duration.value,
  );
  Math.abs(shortestDistance - fastestRoute.legs[0].distance.value / 1e3);
  if (
    timeDifferenceSeconds <= 240 &&
    shortestDistance < fastestRoute.legs[0].distance.value / 1e3
  )
    return shortestRoute;
  const fastestDistance = fastestRoute.legs[0].distance.value / 1e3;
  return Math.abs(fastestDistance - googleDistance) <= 10
    ? fastestRoute
    : googleRecommended;
}
const SURCHARGE_3_KM = 400,
  SURCHARGE_3_AMOUNT = 5,
  CONIL_HOLIDAYS = new Set([]),
  CUSTOM_HOLIDAYS_BY_YEAR = {
    2026: new Set([
      "2026-01-01",
      "2026-01-06",
      "2026-02-28",
      "2026-04-02",
      "2026-04-03",
      "2026-05-01",
      "2026-07-16",
      "2026-08-15",
      "2026-09-08",
      "2026-10-12",
      "2026-11-02",
      "2026-12-07",
      "2026-12-08",
      "2026-12-25",
    ]),
  };
function getPageLangCode() {
  if ("undefined" == typeof document) return "es";
  let path = "";
  try {
    path = String(
      window.location && window.location.pathname
        ? window.location.pathname
        : "",
    ).toLowerCase();
  } catch (_) {
    path = "";
  }
  if ("/fr" === path || path.startsWith("/fr/")) return "fr";
  if ("/de" === path || path.startsWith("/de/")) return "de";
  if ("/en" === path || path.startsWith("/en/")) return "en";
  if (
    "/index-fr.html" === path ||
    path.endsWith("/index-fr.html") ||
    path.endsWith("index-fr.html")
  )
    return "fr";
  if (
    "/index-de.html" === path ||
    path.endsWith("/index-de.html") ||
    path.endsWith("index-de.html")
  )
    return "de";
  if (
    "/index-en.html" === path ||
    path.endsWith("/index-en.html") ||
    path.endsWith("index-en.html")
  )
    return "en";
  if (
    path.endsWith("-fr.html") ||
    path.includes("-fr.html#") ||
    path.includes("-fr.html?")
  )
    return "fr";
  if (
    path.endsWith("-de.html") ||
    path.includes("-de.html#") ||
    path.includes("-de.html?")
  )
    return "de";
  if (
    path.endsWith("-en.html") ||
    path.includes("-en.html#") ||
    path.includes("-en.html?")
  )
    return "en";
  try {
    const override =
      "undefined" != typeof window && window.__TC_LANG
        ? String(window.__TC_LANG).toLowerCase()
        : "";
    if (
      "en" === override ||
      "de" === override ||
      "fr" === override ||
      "es" === override
    )
      return override;
  } catch (_) {}
  const langAttr = (document.documentElement.lang || "").toLowerCase();
  if (langAttr.startsWith("fr")) return "fr";
  if (langAttr.startsWith("de")) return "de";
  if (langAttr.startsWith("en")) return "en";
  if (
    "undefined" != typeof window &&
    window.location &&
    ("localhost" === window.location.hostname ||
      "127.0.0.1" === window.location.hostname ||
      "::1" === window.location.hostname ||
      "0:0:0:0:0:0:0:1" === window.location.hostname)
  )
    try {
      const key = "__tc_local_cache_reset_done__";
      !(window.sessionStorage && "1" === window.sessionStorage.getItem(key)) &&
        "serviceWorker" in navigator &&
        (window.sessionStorage && window.sessionStorage.setItem(key, "1"),
        Promise.resolve()
          .then(() => navigator.serviceWorker.getRegistrations())
          .then((regs) => {
            try {
              regs.forEach((r) => {
                try {
                  r.unregister();
                } catch (_) {}
              });
            } catch (_) {}
          })
          .then(() =>
            window.caches && "function" == typeof caches.keys
              ? caches.keys().then((keys) =>
                  Promise.all(
                    keys.map((k) => {
                      try {
                        return caches.delete(k);
                      } catch (_) {
                        return Promise.resolve(!1);
                      }
                    }),
                  ),
                )
              : null,
          )
          .then(() => {
            try {
              window.location.reload();
            } catch (_) {}
          })
          .catch(() => {
            try {
              window.location.reload();
            } catch (_) {}
          }));
    } catch (_) {}
  return "es";
}
const LOCALES = { es: "es-ES", en: "en-GB", de: "de-DE", fr: "fr-FR" },
  I18N = {
    es: {
      alerts: {
        googleMapsCritical:
          "Error crítico: No se pudo cargar la API de Google Maps. La calculadora no funcionará.",
        googleMapsNotLoaded:
          "Error: La API de Google Maps no se ha cargado. Por favor, revise su clave de API (API KEY) o su conexión a internet.",
        directionsServiceNotReady:
          "Error: El servicio de Direcciones de Google no está listo. Reintentelo más tarde o llamenos al: +34 670 70 57 74",
        routeCalculationFailed: (status) =>
          "No se pudo calcular la ruta. Verifique las direcciones. (Error: " +
          status +
          ")",
        routeRestrictedArea:
          "No ha sido posible calcular la ruta hasta el punto indicado. Es posible que se trate de una zona restringida. Por favor, seleccione una dirección cercana accesible por carretera.",
        invalidDateTime: "La fecha u hora introducida no es válida.",
        noPriceCalculated:
          "Error: Por favor, calcule primero el precio del trayecto.",
        returnFieldsMissing:
          "Por favor, complete los campos necesarios para el trayecto de vuelta o anúlelo.",
        googleMapsNotLoadedShort:
          "Error: La API de Google Maps no se ha cargado.",
        missingCriticalData: (missing) =>
          "Faltan datos críticos para el envío: " +
          missing.join(", ") +
          ". Por favor calcule la ruta.",
      },
      calc: {
        distanceLabel: "Distancia",
        durationLabel: "Duración",
        totalPriceIntro: "El precio total de este trayecto es de:",
        pricesNotBindingNotice:
          "Los precios mostrados no son vinculantes hasta su confirmación.",
        cancelButton: "Cancelar",
        continueBookingButton: "Complete su reserva",
        viewRouteButton: "Consultar itinerario",
        hideRouteButton: "Ocultar mapa",
        routeOriginLabel: "Origen",
        routeDestinationLabel: "Destino",
        tripLabel: "Trayecto",
        showDetailsButton: "Mostrar detalles",
        hideDetailsButton: "Ocultar detalles",
        removeButton: "Eliminar",
        fullAddressLabel: "Dirección completa",
        dateTimeLabel: "Fecha y hora",
        priceLabel: "Precio",
        routeNotice:
          "Itinerario aproximado según Google Maps. El recorrido real puede variar ligeramente en función del tráfico y las condiciones de la vía.",
        calculating: "Calculando...",
        calculatingPrice: "Calculando precio...",
        minPriceIntro:
          "Nuestro compromiso con un servicio distinguido requiere que el vehículo permanezca reservado exclusivamente para usted una hora antes de la salida, garantizando plena disponibilidad y puntualidad.",
        minPriceLine: (minPrice) =>
          "Por ello, el <strong>precio mínimo</strong> de cualquier reserva es de <strong>" +
          minPrice +
          "</strong>.",
        minPriceNote:
          'Recomendamos este servicio principalmente a clientes que necesiten llegar puntuales a un evento o compromiso especial. Para otros casos, puede contactarnos cuando necesite el servicio en el <a href="tel:+34670705774" style="color: white; font-weight: bold;">+34 670 70 57 74</a>.',
        minPriceContinueButton: (minPrice) =>
          "Continuar con la reserva (" + minPrice + ")",
        minPriceAcceptButton: (minPrice) =>
          "Aceptar servicio mínimo (" + minPrice + ")",
        minPriceCancelButton: "Cancelar",
        minLeadTimeLine: (hours) =>
          "No se admiten reservas online con menos de " +
          hours +
          " horas de antelación.",
        urgentServicesLine:
          'Para servicios inmediatos, por favor elija su opción preferente:',
        whatsappMessageTemplate:
          '*Hola*, he consultado un trayecto de *{origin}* → *{destination}* a las _{time}_. El precio de la web es de *{price}*. ¿Tendrían disponibilidad para realizarlo hoy?',
        returnDistanceLabel: "Distancia",
        returnDurationLabel: "Duración",
        returnTotalPriceIntro: "El precio total de este trayecto es de:",
        cancelReturnButton: "Cancelar",
        returnAddServiceButton: "Añadir servicio",
        returnCancelButton: "Cancelar",
        confirmReturnButton: "Incluir trayecto",
        returnIncludedSuccess:
          "Su trayecto de vuelta ha sido añadido con éxito.",
        oneWayIncludedSuccess: "Su trayecto ha sido añadido con éxito.",
      },
      validation: {
        errorNameRequired: "Nombre: indique su nombre y apellidos.",
        errorEmailRequired:
          "Correo electrónico: indique su correo electrónico.",
        errorEmailInvalid: "Correo electrónico: el formato no es válido.",
        errorPhoneRequired: "Teléfono: indique su teléfono de contacto.",
        errorPhoneTooShort:
          "Teléfono: debe tener al menos 4 cifras (puede incluir espacios, prefijo internacional con + y otros separadores).",
        errorPassengersRequired:
          "Número de pasajeros: seleccione el número de pasajeros.",
        errorTermsRequired:
          "Debe aceptar las condiciones legales para continuar.",
        errorReturnOriginRequired:
          "Origen (vuelta): indique el origen del viaje de vuelta.",
        errorReturnDestinationRequired:
          "Destino (vuelta): indique el destino del viaje de vuelta.",
        errorReturnDateRequired:
          "Fecha (vuelta): indique la fecha del viaje de vuelta.",
        errorReturnTimeRequired:
          "Hora (vuelta): indique la hora del viaje de vuelta.",
        errorCalcOriginRequired:
          "Por favor, seleccione una dirección de la lista de sugerencias para el origen.",
        errorCalcDestinationRequired:
          "Por favor, seleccione una dirección de la lista de sugerencias para el destino.",
        errorReturnDecisionRequired: (confirmLabel, cancelLabel) =>
          'Trayecto de vuelta: antes de continuar, haga clic en "' +
          (confirmLabel || "Continuar con la reserva") +
          '" o en "' +
          (cancelLabel || "Cancelar") +
          '" en el cuadro de precio del trayecto de vuelta.',
        reviewFieldsBase: "Revise los siguientes campos:",
      },
      confirmation: {
        notAvailable: "N/A",
        atTimeConnector: " a las ",
        confirmButton: "Complete su reserva",
        cancelButton: "MODIFICAR DATOS",
        luggageCabinLabel: "Cabina",
        luggageLargeLabel: "Grandes",
        yes: "Sí",
        no: "No",
        none: "Ninguna",
        sriYes: (baby, child) =>
          "Sí (Bebé G0/1: " + baby + ", Elevador G2/3: " + child + ")",
        sriAgeWeightPrefix: " | Edad/Peso: ",
      },
      booking: {
        sending: '<i class="fas fa-spinner fa-spin"></i> Enviando...',
        bookingSentTitle: "¡Reserva enviada!",
        formError:
          "Error al enviar el formulario. Por favor, intente nuevamente o contáctenos por teléfono.",
        emailJsError:
          "Error al enviar la reserva. Por favor, inténtelo de nuevo o contacte por teléfono.",
        confirmButton: "¡Confirmar mi reserva!",
      },
      ui: { vehicleVideoTitle: "Nuestro vehículo - Taxi Conil" },
    },
    fr: {
      alerts: {
        googleMapsCritical:
          "Erreur critique : l'API Google Maps n'a pas pu être chargée. Le calculateur ne fonctionnera pas.",
        googleMapsNotLoaded:
          "Erreur : l'API Google Maps ne s'est pas chargée. Veuillez vérifier votre clé API ou votre connexion Internet.",
        directionsServiceNotReady:
          "Erreur : le service d'itinéraires Google n'est pas prêt.",
        routeCalculationFailed: (status) =>
          "Impossible de calculer l'itinéraire. Vérifiez les adresses. (Erreur : " +
          status +
          ")",
        routeRestrictedArea:
          "Impossible de calculer un itinéraire jusqu'au point indiqué. Il peut s'agir d'une zone restreinte. Veuillez choisir une adresse proche accessible par la route.",
        invalidDateTime: "La date ou l'heure saisie n'est pas valide.",
        noPriceCalculated:
          "Erreur : veuillez d'abord calculer le prix du trajet.",
        returnFieldsMissing:
          "Veuillez compléter les champs requis pour le trajet retour ou l'annuler.",
        googleMapsNotLoadedShort:
          "Erreur : l'API Google Maps ne s'est pas chargée.",
        missingCriticalData: (missing) =>
          "Des données critiques manquent pour l'envoi : " +
          missing.join(", ") +
          ". Veuillez calculer l'itinéraire.",
      },
      calc: {
        distanceLabel: "Distance",
        durationLabel: "Durée",
        totalPriceIntro: "Le prix total de ce trajet est :",
        pricesNotBindingNotice:
          "Les prix affichés ne sont pas contractuels tant qu'ils ne sont pas confirmés.",
        cancelButton: "Annuler",
        continueBookingButton: "Confirmer réservation",
        viewRouteButton: "Voir l'itinéraire",
        hideRouteButton: "Masquer la carte",
        routeOriginLabel: "Origine",
        routeDestinationLabel: "Destination",
        tripLabel: "Trajet",
        showDetailsButton: "Afficher les détails",
        hideDetailsButton: "Masquer les détails",
        removeButton: "Supprimer",
        fullAddressLabel: "Adresse complète",
        dateTimeLabel: "Date et heure",
        priceLabel: "Prix",
        routeNotice:
          "Itinéraire approximatif selon Google Maps. Le trajet réel peut varier légèrement selon le trafic et l'état des routes.",
        calculating: "Calcul en cours...",
        calculatingPrice: "Calcul du prix...",
        minPriceIntro:
          "Afin d'offrir un service distingué, le véhicule est réservé exclusivement pour vous une heure avant le départ, garantissant disponibilité et ponctualité.",
        minPriceLine: (minPrice) =>
          "Pour cette raison, le <strong>prix minimum</strong> de toute réservation est de <strong>" +
          minPrice +
          "</strong>.",
        minPriceNote:
          'Nous recommandons ce service en particulier aux clients qui doivent arriver à l\'heure à un événement ou un engagement spécial. Dans les autres cas, vous pouvez nous contacter quand vous avez besoin du service au <a href="tel:+34670705774" style="color: white; font-weight: bold;">+34 670 70 57 74</a>.',
        minPriceContinueButton: (minPrice) =>
          "Continuer avec la réservation (" + minPrice + ")",
        minPriceAcceptButton: (minPrice) =>
          "Accepter le service minimum (" + minPrice + ")",
        minPriceCancelButton: "Annuler",
        minLeadTimeLine: (hours) =>
          "Les réservations en ligne ne sont pas acceptées à moins de " +
          hours +
          " heures à l'avance.",
        urgentServicesLine:
          'Pour les services immédiats, veuillez choisir votre option préférée :',
        whatsappMessageTemplate:
          '*Bonjour*, j\'ai consulté un trajet de *{origin}* → *{destination}* à _{time}_. Le prix sur le site est de *{price}*. Auriez-vous la disponibilité pour l\'effectuer aujourd\'hui ?',
        returnDistanceLabel: "Distance",
        returnDurationLabel: "Durée",
        returnTotalPriceIntro: "Le prix total de ce trajet est :",
        cancelReturnButton: "Annuler",
        returnAddServiceButton: "Ajouter le service",
        returnCancelButton: "Annuler",
        confirmReturnButton: "Inclure ce trajet",
        returnIncludedSuccess: "Votre trajet retour a été ajouté avec succès.",
        oneWayIncludedSuccess: "Votre trajet a été ajouté avec succès.",
      },
      validation: {
        errorNameRequired: "Nom : veuillez indiquer votre nom et prénom.",
        errorEmailRequired: "Email : veuillez indiquer votre adresse email.",
        errorEmailInvalid: "Email : le format n'est pas valide.",
        errorPhoneRequired:
          "Téléphone : veuillez indiquer votre numéro de contact.",
        errorPhoneTooShort:
          "Téléphone : il doit contenir au moins 4 chiffres (espaces, préfixe international avec + et autres séparateurs autorisés).",
        errorPassengersRequired:
          "Nombre de passagers : veuillez sélectionner le nombre de passagers.",
        errorTermsRequired:
          "Vous devez accepter les conditions légales pour continuer.",
        errorReturnOriginRequired:
          "Origine (retour) : veuillez indiquer le point de départ du trajet retour.",
        errorReturnDestinationRequired:
          "Destination (retour) : veuillez indiquer la destination du trajet retour.",
        errorReturnDateRequired:
          "Date (retour) : veuillez indiquer la date du trajet retour.",
        errorReturnTimeRequired:
          "Heure (retour) : veuillez indiquer l’heure du trajet retour.",
        errorCalcOriginRequired:
          "Veuillez sélectionner une adresse dans la liste de suggestions pour l'origine.",
        errorCalcDestinationRequired:
          "Veuillez sélectionner une adresse dans la liste de suggestions pour la destination.",
        errorReturnDecisionRequired: (confirmLabel, cancelLabel) =>
          'Trajet retour : avant de continuer, veuillez cliquer sur "' +
          (confirmLabel || "Inclure ce trajet dans ma réservation") +
          '" ou sur "' +
          (cancelLabel || "Annuler") +
          '" dans le cadre du prix du retour.',
        reviewFieldsBase: "Veuillez vérifier les champs suivants :",
      },
      confirmation: {
        notAvailable: "N/A",
        atTimeConnector: " à ",
        luggageCabinLabel: "Cabine",
        luggageLargeLabel: "Grandes",
        yes: "Oui",
        no: "Non",
        none: "Aucun",
        sriYes: (baby, child) =>
          "Oui (Siège bébé G0/1 : " +
          baby +
          ", Réhausseur G2/3 : " +
          child +
          ")",
        sriAgeWeightPrefix: " | Âge/Poids : ",
      },
      booking: {
        sending: '<i class="fas fa-spinner fa-spin"></i> Envoi...',
        bookingSentTitle: "Réservation envoyée !",
        formError:
          "Erreur lors de l'envoi du formulaire. Veuillez réessayer ou nous contacter par téléphone.",
        emailJsError:
          "Erreur lors de l'envoi de la réservation. Veuillez réessayer ou nous contacter par téléphone.",
        confirmButton: "Confirmer ma réservation",
      },
      ui: { vehicleVideoTitle: "Notre véhicule - Taxi Conil" },
    },
    en: {
      alerts: {
        googleMapsCritical:
          "Critical error: The Google Maps API could not be loaded. The calculator will not work.",
        googleMapsNotLoaded:
          "Error: The Google Maps API has not loaded. Please check your API key or your internet connection.",
        directionsServiceNotReady:
          "Error: The Google Directions service is not ready.",
        routeCalculationFailed: (status) =>
          "The route could not be calculated. Please check the addresses. (Error: " +
          status +
          ")",
        routeRestrictedArea:
          "It was not possible to calculate a route to the selected point. It may be a restricted area. Please select a nearby address that is accessible by road.",
        invalidDateTime: "The date or time entered is not valid.",
        noPriceCalculated:
          "Error: Please calculate the fare for the journey first.",
        returnFieldsMissing:
          "Please complete the required fields for the return journey or cancel it.",
        googleMapsNotLoadedShort: "Error: The Google Maps API has not loaded.",
        missingCriticalData: (missing) =>
          "Critical data required for sending are missing: " +
          missing.join(", ") +
          ". Please calculate the route first.",
      },
      calc: {
        distanceLabel: "Distance",
        durationLabel: "Duration",
        totalPriceIntro: "The total fare for this journey is:",
        pricesNotBindingNotice:
          "The prices shown are not binding until they are confirmed.",
        cancelButton: "Cancel",
        continueBookingButton: "Complete your booking",
        viewRouteButton: "View route",
        hideRouteButton: "Hide map",
        routeOriginLabel: "Origin",
        routeDestinationLabel: "Destination",
        tripLabel: "Trip",
        showDetailsButton: "Show details",
        hideDetailsButton: "Hide details",
        removeButton: "Remove",
        fullAddressLabel: "Full address",
        dateTimeLabel: "Date and time",
        priceLabel: "Price",
        routeNotice:
          "Approximate itinerary based on Google Maps. The actual route may vary slightly depending on traffic and road conditions.",
        calculating: "Calculating...",
        calculatingPrice: "Calculating fare...",
        minPriceIntro:
          "In order to provide a distinguished service, the vehicle is reserved exclusively for you one hour before departure, guaranteeing full availability and punctuality.",
        minPriceLine: (minPrice) =>
          "For this reason, the <strong>minimum fare</strong> for any reservation is <strong>" +
          minPrice +
          "</strong>.",
        minPriceNote:
          'We particularly recommend this service for clients who need to arrive punctually at an event or special engagement. For other cases, you may contact us whenever you require the service on <a href="tel:+34670705774" style="color: white; font-weight: bold;">+34 670 70 57 74</a>.',
        minPriceContinueButton: (minPrice) => "BOOK (" + minPrice + ")",
        minPriceAcceptButton: (minPrice) =>
          "Accept minimum fare (" + minPrice + ")",
        minPriceCancelButton: "Cancel",
        minLeadTimeLine: (hours) =>
          "Online reservations are not accepted less than " +
          hours +
          " hours in advance.",
        urgentServicesLine:
          'For immediate services, please choose your preferred option:',
        whatsappMessageTemplate:
          '*Hello*, I have checked a journey from *{origin}* → *{destination}* at _{time}_. The price on the website is *{price}*. Would you have availability to do it today?',
        returnDistanceLabel: "Distance",
        returnDurationLabel: "Duration",
        returnTotalPriceIntro: "The total fare for this journey is:",
        cancelReturnButton: "Cancel",
        returnAddServiceButton: "Add service",
        returnCancelButton: "Cancel",
        confirmReturnButton: "Include this journey",
        returnIncludedSuccess:
          "Your return journey has been added successfully.",
        oneWayIncludedSuccess: "Your journey has been added successfully.",
      },
      validation: {
        errorNameRequired: "Name: please enter your full name.",
        errorEmailRequired: "Email: please enter your email address.",
        errorEmailInvalid: "Email: the format is not valid.",
        errorPhoneRequired:
          "Telephone: please enter your contact telephone number.",
        errorPhoneTooShort:
          "Telephone: it must contain at least 4 digits (you may include spaces, international prefix with + and other separators).",
        errorPassengersRequired:
          "Number of passengers: please select the number of passengers.",
        atTimeConnector: " at ",
        confirmButton: "Complete your booking",
        cancelButton: "MODIFY DATA",
      },
      confirmation: {
        notAvailable: "N/A",
        atTimeConnector: " at ",
        confirmButton: "Complete your booking",
        cancelButton: "MODIFY DATA",
        luggageCabinLabel: "Cabin",
        luggageLargeLabel: "Large",
        yes: "Yes",
        no: "No",
        none: "None",
        sriYes: (baby, child) =>
          "Yes (Baby seat G0/1: " + baby + ", Booster G2/3: " + child + ")",
        sriAgeWeightPrefix: " | Age/Weight: ",
      },
      booking: {
        sending: '<i class="fas fa-spinner fa-spin"></i> Sending...',
        bookingSentTitle: "Booking sent!",
        formError:
          "Error sending the form. Please try again or contact us by phone.",
        emailJsError:
          "Error sending the booking. Please try again or contact by phone.",
        confirmButton: "Confirm my booking!",
      },
      ui: { vehicleVideoTitle: "Our vehicle - Taxi Conil" },
    },
    de: {
      alerts: {
        googleMapsCritical:
          "Kritischer Fehler: Die Google Maps API konnte nicht geladen werden. Der Rechner wird nicht funktionieren.",
        googleMapsNotLoaded:
          "Fehler: Die Google Maps API wurde nicht geladen. Bitte prüfen Sie Ihren API-Schlüssel oder Ihre Internetverbindung.",
        directionsServiceNotReady:
          "Fehler: Der Google-Routenservice ist nicht bereit.",
        routeCalculationFailed: (status) =>
          "Die Route konnte nicht berechnet werden. Bitte überprüfen Sie die Adressen. (Fehler: " +
          status +
          ")",
        routeRestrictedArea:
          "Es war nicht möglich, eine Route zu dem ausgewählten Punkt zu berechnen. Möglicherweise handelt es sich um ein gesperrtes Gebiet. Bitte wählen Sie eine nahegelegene Adresse, die mit dem Auto erreichbar ist.",
        invalidDateTime: "Das eingegebene Datum oder die Uhrzeit ist ungültig.",
        noPriceCalculated:
          "Fehler: Bitte berechnen Sie zuerst den Fahrpreis für die Strecke.",
        returnFieldsMissing:
          "Bitte füllen Sie die erforderlichen Felder für die Rückfahrt aus oder stornieren Sie diese.",
        googleMapsNotLoadedShort:
          "Fehler: Die Google Maps API wurde nicht geladen.",
        missingCriticalData: (missing) =>
          "Für den Versand fehlen wichtige Daten: " +
          missing.join(", ") +
          ". Bitte berechnen Sie zuerst die Route.",
      },
      calc: {
        distanceLabel: "Entfernung",
        durationLabel: "Dauer",
        totalPriceIntro: "Der Gesamtpreis für diese Fahrt beträgt:",
        pricesNotBindingNotice:
          "Die angezeigten Preise sind bis zu ihrer Bestätigung nicht verbindlich.",
        cancelButton: "Abbrechen",
        continueBookingButton: "Buchung bestätigen",
        viewRouteButton: "Route anzeigen",
        hideRouteButton: "Karte ausblenden",
        routeOriginLabel: "Abfahrtsort",
        routeDestinationLabel: "Zielort",
        tripLabel: "Fahrt",
        showDetailsButton: "Details anzeigen",
        hideDetailsButton: "Details ausblenden",
        removeButton: "Entfernen",
        fullAddressLabel: "Vollständige Adresse",
        dateTimeLabel: "Datum und Uhrzeit",
        priceLabel: "Preis",
        routeNotice:
          "Ungefähre Route laut Google Maps. Die tatsächliche Strecke kann je nach Verkehr und Straßenverhältnissen leicht abweichen.",
        calculating: "Wird berechnet...",
        calculatingPrice: "Fahrpreis wird berechnet...",
        minPriceIntro:
          "Unser Anspruch an einen erstklassigen Service erfordert, dass das Fahrzeug bereits eine Stunde vor Ihrer Abfahrt exklusiv für Sie reserviert wird – so stellen wir volle Verfügbarkeit und Pünktlichkeit sicher.",
        minPriceLine: (minPrice) =>
          "Aus diesem Grund beträgt der <strong>Mindestpreis</strong> für jede Reservierung <strong>" +
          minPrice +
          "</strong>.",
        minPriceNote:
          'Wir empfehlen diesen Service insbesondere Gästen, die pünktlich zu einem wichtigen Termin oder besonderen Anlass ankommen müssen. Für andere Fälle können Sie uns gerne spontan kontaktieren, wenn Sie ein Taxi benötigen, unter <a href="tel:+34670705774" style="color: white; font-weight: bold;">+34 670 70 57 74</a>.',
        minPriceContinueButton: (minPrice) =>
          "Mit der Reservierung fortfahren (" + minPrice + ")",
        minPriceAcceptButton: (minPrice) =>
          "Mindestpreis akzeptieren (" + minPrice + ")",
        minPriceCancelButton: "Abbrechen",
        minLeadTimeLine: (hours) =>
          "Online-Reservierungen sind nur mit mindestens " +
          hours +
          " Stunden Vorlauf möglich.",
        urgentServicesLine:
          'Für sofortige Fahrten wählen Sie bitte Ihre bevorzugte Option:',
        whatsappMessageTemplate:
          '*Hallo*, ich habe eine Fahrt von *{origin}* → *{destination}* um _{time}_ geprüft. Der Preis auf der Website beträgt *{price}*. Hätten Sie heute Verfügbarkeit dafür?',
        returnDistanceLabel: "Entfernung",
        returnDurationLabel: "Dauer",
        returnTotalPriceIntro: "Der Gesamtpreis für diese Fahrt beträgt:",
        cancelReturnButton: "Abbrechen",
        returnAddServiceButton: "Fahrt hinzufügen",
        returnCancelButton: "Abbrechen",
        confirmReturnButton: "Diese Fahrt aufnehmen",
        returnIncludedSuccess: "Ihre Rückfahrt wurde erfolgreich hinzugefügt.",
        oneWayIncludedSuccess: "Ihre Fahrt wurde erfolgreich hinzugefügt.",
      },
      validation: {
        errorNameRequired:
          "Name: Bitte geben Sie Ihren vollständigen Namen an.",
        errorEmailRequired: "E-Mail: Bitte geben Sie Ihre E-Mail-Adresse an.",
        errorEmailInvalid: "E-Mail: Das Format ist ungültig.",
        errorPhoneRequired: "Telefon: Bitte geben Sie Ihre Telefonnummer an.",
        errorPhoneTooShort:
          "Telefon: Die Nummer muss mindestens 4 Ziffern enthalten (Leerzeichen, Ländervorwahl mit + und andere Trennzeichen sind erlaubt).",
        errorPassengersRequired:
          "Anzahl der Fahrgäste: Bitte wählen Sie die Anzahl der Fahrgäste.",
        errorTermsRequired:
          "Sie müssen die rechtlichen Bedingungen akzeptieren, um fortzufahren.",
        errorReturnOriginRequired:
          "Abfahrtsort (Rückfahrt): Bitte geben Sie den Abfahrtsort der Rückfahrt an.",
        errorReturnDestinationRequired:
          "Zielort (Rückfahrt): Bitte geben Sie den Zielort der Rückfahrt an.",
        errorReturnDateRequired:
          "Datum (Rückfahrt): Bitte geben Sie das Datum der Rückfahrt an.",
        errorReturnTimeRequired:
          "Uhrzeit (Rückfahrt): Bitte geben Sie die Uhrzeit der Rückfahrt an.",
        errorCalcOriginRequired:
          "Bitte wählen Sie für den Abfahrtsort eine Adresse aus der Vorschlagsliste aus.",
        errorCalcDestinationRequired:
          "Bitte wählen Sie für den Zielort eine Adresse aus der Vorschlagsliste aus.",
        errorReturnDecisionRequired: (confirmLabel, cancelLabel) =>
          'Rückfahrt: Bevor Sie fortfahren, klicken Sie bitte im Feld für den Rückfahrpreis auf "' +
          (confirmLabel || "Diese Fahrt in meine Reservierung aufnehmen") +
          '" oder "' +
          (cancelLabel || "Abbrechen") +
          '".',
        reviewFieldsBase: "Bitte überprüfen Sie die folgenden Felder:",
      },
      confirmation: {
        notAvailable: "k. A.",
        atTimeConnector: " um ",
        luggageCabinLabel: "Kabine",
        luggageLargeLabel: "Groß",
        yes: "Ja",
        no: "Nein",
        none: "Keine",
        sriYes: (baby, child) =>
          "Ja (Babysitz G0/1: " + baby + ", Sitzerhöhung G2/3: " + child + ")",
        sriAgeWeightPrefix: " | Alter/Gewicht: ",
      },
      booking: {
        sending: '<i class="fas fa-spinner fa-spin"></i> Wird gesendet...',
        bookingSentTitle: "Reservierung gesendet!",
        formError:
          "Fehler beim Senden des Formulars. Bitte versuchen Sie es erneut oder kontaktieren Sie uns telefonisch.",
        emailJsError:
          "Fehler beim Senden der Reservierung. Bitte versuchen Sie es erneut oder kontaktieren Sie uns telefonisch.",
        confirmButton: "Meine Reservierung bestätigen",
      },
      ui: { vehicleVideoTitle: "Unser Fahrzeug – Taxi Conil" },
    },
  };
try {
  if (
    (!I18N.de && I18N.en && I18N.en.de && (I18N.de = I18N.en.de),
    !I18N.de ||
      (I18N.de.calc && I18N.de.calc.distanceLabel) ||
      (I18N.en &&
        I18N.en.de &&
        I18N.en.de.calc &&
        (I18N.de.calc = I18N.en.de.calc)),
    I18N.en && (!I18N.en.calc || I18N.en.calc.distanceLabel),
    I18N.de &&
      I18N.de.calc &&
      !I18N.de.calc.distanceLabel &&
      "undefined" != typeof window &&
      window.__taxiI18n &&
      window.__taxiI18n.I18N &&
      window.__taxiI18n.I18N.de &&
      window.__taxiI18n.I18N.de.calc &&
      (I18N.de.calc = window.__taxiI18n.I18N.de.calc),
    I18N.de && (!I18N.de.calc || "Entfernung" !== I18N.de.calc.distanceLabel))
  ) {
    const mainBundle = {
      distanceLabel: "Entfernung",
      durationLabel: "Dauer",
      totalPriceIntro: "Der Gesamtpreis für diese Fahrt beträgt:",
      pricesNotBindingNotice:
        "Die angezeigten Preise sind bis zu ihrer Bestätigung nicht verbindlich.",
      cancelButton: "Abbrechen",
      continueBookingButton: "Buchung bestätigen",
      viewRouteButton: "Route anzeigen",
      hideRouteButton: "Karte ausblenden",
      routeOriginLabel: "Abfahrtsort",
      routeDestinationLabel: "Zielort",
      routeNotice:
        "Ungefähre Route laut Google Maps. Die tatsächliche Strecke kann je nach Verkehr und Straßenverhältnissen leicht abweichen.",
      calculating: "Wird berechnet...",
      calculatingPrice: "Fahrpreis wird berechnet...",
      minPriceIntro:
        "Unser Anspruch an einen erstklassigen Service erfordert, dass das Fahrzeug bereits eine Stunde vor Ihrer Abfahrt exklusiv für Sie reserviert wird – so stellen wir volle Verfügbarkeit und Pünktlichkeit sicher.",
      minPriceLine: (minPrice) =>
        "Aus diesem Grund beträgt der <strong>Mindestpreis</strong> für jede Reservierung <strong>" +
        minPrice +
        "</strong>.",
      minPriceNote:
        'Wir empfehlen diesen Service insbesondere Gästen, die pünktlich zu einem wichtigen Termin oder besonderen Anlass ankommen müssen. Für andere Fälle können Sie uns gerne spontan kontaktieren, wenn Sie ein Taxi benötigen, unter <a href="tel:+34670705774" style="color: white; font-weight: bold;">+34 670 70 57 74</a>.',
      minPriceContinueButton: (minPrice) =>
        "Mit der Reservierung fortfahren (" + minPrice + ")",
      minPriceAcceptButton: (minPrice) =>
        "Mindestpreis akzeptieren (" + minPrice + ")",
      minPriceCancelButton: "Abbrechen",
      minLeadTimeLine: (hours) =>
        "Online-Reservierungen sind nur mit mindestens " +
        hours +
        " Stunden Vorlauf möglich.",
      urgentServicesLine:
        'Für sofortige Fahrten rufen Sie uns bitte unter <a href="tel:+34670705774">+34 670 70 57 74</a> an.',
      returnDistanceLabel: "Entfernung",
      returnDurationLabel: "Dauer",
      returnTotalPriceIntro: "Der Gesamtpreis für diese Fahrt beträgt:",
      cancelReturnButton: "Abbrechen",
      returnAddServiceButton: "Fahrt hinzufügen",
      returnCancelButton: "Abbrechen",
      confirmReturnButton: "Diese Fahrt in meine Reservierung aufnehmen",
      returnIncludedSuccess: "Ihre Rückfahrt wurde erfolgreich hinzugefügt.",
      oneWayIncludedSuccess: "Ihre Fahrt wurde erfolgreich hinzugefügt.",
    };
    (I18N.de.calc || (I18N.de.calc = {}),
      Object.assign(I18N.de.calc, mainBundle));
  }
  if (
    (!I18N.de ||
      (I18N.de.confirmation && "Nein" === I18N.de.confirmation.no) ||
      (I18N.de.confirmation || (I18N.de.confirmation = {}),
      Object.assign(I18N.de.confirmation, {
        luggageCabinLabel: "Kabine",
        luggageLargeLabel: "Groß",
        yes: "Ja",
        no: "Nein",
        none: "Keine",
      })),
    !I18N.en ||
      (I18N.en.confirmation && "No" === I18N.en.confirmation.no) ||
      (I18N.en.confirmation || (I18N.en.confirmation = {}),
      Object.assign(I18N.en.confirmation, {
        luggageCabinLabel: "Cabin",
        luggageLargeLabel: "Large",
        yes: "Yes",
        no: "No",
        none: "None",
      })),
    !I18N.fr ||
      (I18N.fr.confirmation && "Non" === I18N.fr.confirmation.no) ||
      (I18N.fr.confirmation || (I18N.fr.confirmation = {}),
      Object.assign(I18N.fr.confirmation, {
        luggageCabinLabel: "Cabine",
        luggageLargeLabel: "Grandes",
        yes: "Oui",
        no: "Non",
        none: "Aucun",
      })),
    I18N.en && (!I18N.en.calc || "Distance" !== I18N.en.calc.distanceLabel))
  ) {
    const enBundle = {
      distanceLabel: "Distance",
      durationLabel: "Duration",
      totalPriceIntro: "The total price for this journey is:",
      pricesNotBindingNotice:
        "The prices shown are not binding until confirmation.",
      cancelButton: "Cancel",
      continueBookingButton: "Complete your booking",
      viewRouteButton: "View route",
      hideRouteButton: "Hide map",
      routeOriginLabel: "Origin",
      routeDestinationLabel: "Destination",
      routeNotice:
        "Approximate route according to Google Maps. The actual route may vary slightly depending on traffic and road conditions.",
      calculating: "Calculating...",
      calculatingPrice: "Calculating fare...",
      minPriceIntro:
        "Our commitment to first-class service requires the vehicle to be exclusively reserved for you one hour before your departure – this ensures full availability and punctuality.",
      minPriceLine: (minPrice) =>
        "For this reason, the <strong>minimum price</strong> for each reservation is <strong>" +
        minPrice +
        "</strong>.",
      minPriceNote:
        'We especially recommend this service to guests who need to arrive on time for an important appointment or special occasion. For other cases, you can contact us spontaneously when you need a taxi at <a href="tel:+34670705774" style="color: white; font-weight: bold;">+34 670 70 57 74</a>.',
      minPriceContinueButton: (minPrice) =>
        "Continue with reservation (" + minPrice + ")",
      minPriceAcceptButton: (minPrice) =>
        "Accept minimum price (" + minPrice + ")",
      minPriceCancelButton: "Cancel",
      minLeadTimeLine: (hours) =>
        "Online reservations are only possible with at least " +
        hours +
        " hours in advance.",
      urgentServicesLine:
        'For immediate rides, please call us at <a href="tel:+34670705774">+34 670 70 57 74</a>.',
      returnDistanceLabel: "Distance",
      returnDurationLabel: "Duration",
      returnTotalPriceIntro: "The total price for this journey is:",
      cancelReturnButton: "Cancel",
      returnAddServiceButton: "Add journey",
      returnCancelButton: "Cancel",
      confirmReturnButton: "Include this journey in my reservation",
      returnIncludedSuccess: "Your return journey has been added successfully.",
      oneWayIncludedSuccess: "Your journey has been added successfully.",
    };
    (I18N.en.calc || (I18N.en.calc = {}),
      Object.assign(I18N.en.calc, enBundle));
  }
} catch (_) {}
function tcTrackEvent(eventName, params) {
  try {
    if ("undefined" == typeof window) return;
    "function" == typeof window.gtag &&
      window.gtag(
        "event",
        String(eventName || ""),
        params && "object" == typeof params ? params : {},
      );
  } catch (_) {}
}
function getMessagesSection(section) {
  const lang = getPageLangCode();
  return (
    (I18N[lang] || (I18N.en && I18N.en[lang]) || I18N.es)[section] ||
    I18N.es[section]
  );
}
function getEasterSunday(year) {
  const a = year % 19,
    b = Math.floor(year / 100),
    c = year % 100,
    d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25),
    h = (19 * a + b - d - Math.floor((b - f + 1) / 3) + 15) % 30,
    l = (32 + 2 * e + 2 * Math.floor(c / 4) - h - (c % 4)) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451),
    month = Math.floor((h + l - 7 * m + 114) / 31);
  return new Date(year, month - 1, ((h + l - 7 * m + 114) % 31) + 1);
}
function isFixedOrEasterHoliday(date) {
  if (!(date && date instanceof Date)) return !1;
  const year = date.getFullYear(),
    md = `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  if (
    new Set([
      "01-01",
      "01-06",
      "02-28",
      "05-01",
      "07-16",
      "08-15",
      "09-08",
      "10-12",
      "11-01",
      "12-06",
      "12-08",
      "12-25",
    ]).has(md)
  )
    return !0;
  const easter = getEasterSunday(year),
    holyThursday = new Date(easter);
  holyThursday.setDate(easter.getDate() - 3);
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    htMonth = String(holyThursday.getMonth() + 1).padStart(2, "0"),
    htDay = String(holyThursday.getDate()).padStart(2, "0"),
    gfMonth = String(goodFriday.getMonth() + 1).padStart(2, "0"),
    gfDay = String(goodFriday.getDate()).padStart(2, "0"),
    holyThuStr = `${holyThursday.getFullYear()}-${htMonth}-${htDay}`,
    goodFriStr = `${goodFriday.getFullYear()}-${gfMonth}-${gfDay}`;
  return dateStr === holyThuStr || dateStr === goodFriStr;
}
function isConilHoliday(date) {
  if (!(date && date instanceof Date)) return !1;
  const year = date.getFullYear(),
    dateStr = `${year}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    customYearHolidays = CUSTOM_HOLIDAYS_BY_YEAR[year];
  if (customYearHolidays)
    return !!customYearHolidays.has(dateStr) || !!CONIL_HOLIDAYS.has(dateStr);
  if (CONIL_HOLIDAYS.has(dateStr)) return !0;
  if (isFixedOrEasterHoliday(date)) return !0;
  if (1 === date.getDay()) {
    const prevDay = new Date(date);
    if (
      (prevDay.setDate(prevDay.getDate() - 1), isFixedOrEasterHoliday(prevDay))
    )
      return !0;
  }
  return !1;
}
function isMobileDevice() {
  return (
    "undefined" != typeof window &&
    "undefined" != typeof navigator &&
    (!!/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      !(!window.matchMedia || !window.matchMedia("(pointer: coarse)").matches))
  );
}
function isHandheldMobileDevice() {
  if ("undefined" == typeof navigator) return !1;
  try {
    if (
      navigator.userAgentData &&
      "boolean" == typeof navigator.userAgentData.mobile
    )
      return navigator.userAgentData.mobile;
  } catch (_) {}
  const ua = String(navigator.userAgent || "");
  if (/Android|iPhone|iPad|iPod|Mobi|Mobile/i.test(ua)) return !0;
  const platform = String(navigator.platform || ""),
    maxTouchPoints = Number(navigator.maxTouchPoints || 0);
  return "MacIntel" === platform && maxTouchPoints > 1;
}
function isDesktopOrTabletViewport() {
  return (
    "undefined" == typeof window ||
    !window.matchMedia ||
    window.matchMedia("(min-width: 769px)").matches
  );
}
function escapeHtml(str) {
  return str
    ? String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
    : "";
}
function encodeEmailHtmlEntities(str) {
  return null == str
    ? ""
    : String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/Á/g, "&Aacute;")
        .replace(/É/g, "&Eacute;")
        .replace(/Í/g, "&Iacute;")
        .replace(/Ó/g, "&Oacute;")
        .replace(/Ú/g, "&Uacute;")
        .replace(/Ñ/g, "&Ntilde;")
        .replace(/Ü/g, "&Uuml;")
        .replace(/á/g, "&aacute;")
        .replace(/é/g, "&eacute;")
        .replace(/í/g, "&iacute;")
        .replace(/ó/g, "&oacute;")
        .replace(/ú/g, "&uacute;")
        .replace(/ñ/g, "&ntilde;")
        .replace(/ü/g, "&uuml;");
}
function stripPostalCodes(address) {
  return address
    ? String(address)
        .replace(/\b\d{5}\b/g, "")
        .replace(/\s+,/g, ",")
        .replace(/,\s*,/g, ",")
        .replace(/\s{2,}/g, " ")
        .replace(/,\s*$/, "")
        .trim()
    : "";
}
function extractCityName(address) {
  if (!address) return "";
  let city = String(address).trim();
  return (
    (city = city.replace(/^Aeropuerto de\s+/i, "")),
    (city = city.replace(/^Airport\s+/i, "")),
    (city = city.split(",")[0].trim()),
    (city = city.replace(
      /\b(Calle|Plaza|Avenida|Av\.|C\/|P\/|Avinguda|Carrer|Rua|Street|St\.|Ave\.|Road|Rd\.)\s+/gi,
      "",
    )),
    (city = city.replace(/\d+.*$/, "").trim()),
    city.length < 3 && (city = String(address).split(",")[0].trim()),
    city
  );
}
function buildAddressSummaryText(place) {
  if (!place) return "";
  const formatted = (place.formatted_address || "").trim(),
    name = (place.name || "").trim();
  let displayName = name;
  if (name) {
    const airportLabel = simplifyAirportName(name);
    airportLabel && (displayName = airportLabel);
  }
  if (!formatted && !displayName) return "";
  let address = formatted || displayName;
  displayName &&
    formatted &&
    formatted.toLowerCase().startsWith(displayName.toLowerCase() + ",") &&
    (address = formatted.slice(displayName.length + 1).trim());
  const countrySuffixes = [", España", ", Spain", ", Spanien"];
  for (let i = 0; i < countrySuffixes.length; i++) {
    const suffix = countrySuffixes[i];
    if (address.endsWith(suffix)) {
      address = address.slice(0, -suffix.length).trim();
      break;
    }
  }
  return (
    address && (address = stripPostalCodes(address)),
    displayName &&
    address &&
    address.toLowerCase() !== displayName.toLowerCase()
      ? "<strong>" +
        escapeHtml(displayName) +
        "</strong><br><span>" +
        escapeHtml(address) +
        "</span>"
      : "<span>" + escapeHtml(address || formatted || displayName) + "</span>"
  );
}
function buildShortAddressLabel(address) {
  if (!address) return "";
  let str = String(address).trim();
  if (!str) return "";
  const countrySuffixes = [", España", ", Spain", ", Spanien"];
  for (let i = 0; i < countrySuffixes.length; i++) {
    const suffix = countrySuffixes[i];
    if (str.endsWith(suffix)) {
      str = str.slice(0, -suffix.length).trim();
      break;
    }
  }
  if (
    ((str = stripPostalCodes(str)),
    str.toLowerCase().includes("aeropuerto") ||
      str.toLowerCase().includes("airport"))
  ) {
    const parts = str.split(",");
    if (parts.length >= 1) {
      const airportName = parts[0].trim();
      let shortAirport = airportName
        .replace(/\s*\([A-Z]{3,4}\)\s*/g, "")
        .trim();
      return (
        shortAirport.length < 10 && (shortAirport = airportName),
        abbreviateStreetType(shortAirport)
      );
    }
  }
  const parts = str.split(",");
  if (1 === parts.length) return abbreviateStreetType(parts[0].trim());
  const first = parts[0].trim(),
    second = parts[1] ? parts[1].trim() : "";
  return /\d/.test(first)
    ? abbreviateStreetType(first)
    : second && /\d/.test(second)
      ? abbreviateStreetType(first + ", " + second)
      : abbreviateStreetType(first);
}
function normalizeLocationForEmail(value) {
  const str = String(value || "").trim();
  if (!str) return "";
  const provincesEs = [
      "a coruña",
      "álava",
      "alava",
      "albacete",
      "alicante",
      "almería",
      "almeria",
      "asturias",
      "ávila",
      "avila",
      "badajoz",
      "barcelona",
      "burgos",
      "cáceres",
      "caceres",
      "cádiz",
      "cadiz",
      "cantabria",
      "castellón",
      "castellon",
      "ciudad real",
      "córdoba",
      "cordoba",
      "cuenca",
      "girona",
      "granada",
      "guadalajara",
      "guipúzcoa",
      "guipuzcoa",
      "huelva",
      "huesca",
      "illes balears",
      "islas baleares",
      "jaén",
      "jaen",
      "la rioja",
      "las palmas",
      "león",
      "leon",
      "lleida",
      "lugo",
      "madrid",
      "málaga",
      "malaga",
      "murcia",
      "navarra",
      "ourense",
      "palencia",
      "pontevedra",
      "salamanca",
      "santa cruz de tenerife",
      "segovia",
      "sevilla",
      "soria",
      "tarragona",
      "teruel",
      "toledo",
      "valencia",
      "valladolid",
      "vizcaya",
      "zamora",
      "zaragoza",
    ],
    extractCityFromAddress = (address) => {
      if (!address) return "";
      let a = String(address).trim();
      if (!a) return "";
      const countrySuffixes = [", España", ", Spain", ", Spanien"];
      for (let i = 0; i < countrySuffixes.length; i++) {
        const suffix = countrySuffixes[i];
        if (a.endsWith(suffix)) {
          a = a.slice(0, -suffix.length).trim();
          break;
        }
      }
      a = stripPostalCodes(a);
      const parts = a
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length < 2) return "";
      const last = parts[parts.length - 1],
        prev = parts[parts.length - 2];
      return provincesEs.includes(last.toLowerCase()) ||
        (!/\d/.test(last) && last.length <= 18 && prev && !/\d/.test(prev))
        ? prev
        : last;
    },
    cleanName = (name) => {
      const n = String(name || "").trim();
      return n ? n.replace(/\s+/g, " ") : "";
    },
    formatNameWithCity = (name, city) => {
      const n = cleanName(name),
        c = cleanName(city);
      return n ? (c ? `${n}, ${c}` : n) : "";
    };
  if (str.includes("·")) {
    const partsDot = str.split("·"),
      name = cleanName(partsDot[0]),
      city = extractCityFromAddress(partsDot.slice(1).join("·").trim());
    if (name) return formatNameWithCity(name, city);
  }
  const commaParts = str
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (commaParts.length >= 2) {
    const first = commaParts[0],
      rest = commaParts.slice(1).join(", ");
    if (
      ((text) => {
        const t = String(text || "");
        return /\b(hotel|hostal|hostel|colegio|instituto|ies|bar|caf[eé]|restaurante|rest\.|pub|discoteca|camping|apartamento|apartamentos|residencia|cl[íi]nica|hospital|estaci[oó]n|aeropuerto|airport|flughafen|bahnhof|station)\b/i.test(
          t,
        );
      })(first) ||
      (!/\d/.test(first) && /\d/.test(rest))
    ) {
      const name = cleanName(first),
        city = extractCityFromAddress(rest);
      if (name) return formatNameWithCity(name, city);
    }
  }
  const short = buildShortAddressLabel(str),
    city = extractCityFromAddress(str);
  return short && city && -1 === short.toLowerCase().indexOf(city.toLowerCase())
    ? `${short}, ${city}`
    : short;
}
function extractLocalityFromAddressComponents(components) {
  if (!components || !Array.isArray(components)) return "";
  const getTypes = (c) =>
      c && (Array.isArray(c.types) || Array.isArray(c.types?.map))
        ? c.types
        : [],
    getLongText = (c) =>
      c
        ? "string" == typeof c.long_name
          ? c.long_name
          : "string" == typeof c.longText
            ? c.longText
            : "string" == typeof c.longText?.text
              ? c.longText.text
              : "function" == typeof c.longText?.toString
                ? String(c.longText)
                : ""
        : "",
    prefer = [
      "locality",
      "postal_town",
      "administrative_area_level_3",
      "administrative_area_level_2",
    ];
  for (let i = 0; i < prefer.length; i++) {
    const wanted = prefer[i],
      txt = getLongText(components.find((c) => getTypes(c).includes(wanted)));
    if (txt) return String(txt).trim();
  }
  return "";
}
function tcGetConfiguredMakeWhatsAppWebhookUrl() {
  if ("undefined" == typeof window) return "";
  const url =
      window.TC_MAKE_WHATSAPP_WEBHOOK_URL ||
      window.__TC_MAKE_WHATSAPP_WEBHOOK_URL,
    trimmed = "string" == typeof url ? url.trim() : "";
  return trimmed || "";
}
function normalizeLocationForEmailWithPlace(rawText, place) {
  const base = normalizeLocationForEmail(rawText);
  if (!base) return "";
  const placeName =
      place && "string" == typeof place.name ? place.name.trim() : "",
    placeFormatted =
      place && "string" == typeof place.formatted_address
        ? place.formatted_address.trim()
        : "";
  let effectiveBase = base;
  try {
    const baseLower = base.toLowerCase(),
      formattedLower = placeFormatted ? placeFormatted.toLowerCase() : "";
    placeName &&
      ((formattedLower && baseLower === formattedLower) ||
        ((txt) => {
          if (!txt) return !1;
          const s = String(txt).toLowerCase();
          return !!(
            /[0-9]/.test(s) ||
            s.includes(",") ||
            s.includes(" calle ") ||
            s.startsWith("calle ") ||
            s.includes(" avenida ") ||
            s.startsWith("avenida ") ||
            s.includes(" av. ") ||
            s.startsWith("av. ") ||
            s.includes(" c/") ||
            s.startsWith("c/") ||
            s.includes(" urb.") ||
            s.includes(" urbanización ") ||
            s.includes(" urbanizacion ") ||
            s.includes(" carretera ") ||
            s.includes(" ctra. ")
          );
        })(base)) &&
      (effectiveBase = placeName);
  } catch (_) {}
  const city = extractLocalityFromAddressComponents(
    place && place.address_components ? place.address_components : null,
  );
  if (!city) return effectiveBase;
  const baseLower = effectiveBase.toLowerCase(),
    cityLower = String(city).toLowerCase();
  if (baseLower.includes(cityLower)) return effectiveBase;
  const withoutTrailingParen = effectiveBase
    .replace(/\s*\([^)]*\)\s*$/g, "")
    .trim();
  return withoutTrailingParen
    ? `${withoutTrailingParen}, ${city}`
    : String(city).trim();
}
function buildMapLabelFromPlaceOrAddress(place, fallbackAddress) {
  if (place) {
    const name = (place.name || "").trim(),
      formatted = (place.formatted_address || "").trim();
    if (name) {
      return simplifyAirportName(name) || name;
    }
    if (formatted) return buildShortAddressLabel(formatted);
  }
  return fallbackAddress ? buildShortAddressLabel(fallbackAddress) : "";
}
function abbreviateStreetType(text) {
  if (!text) return "";
  let result = String(text);
  return (
    (result = result.replace(/\bCalle\b/gi, "C/")),
    (result = result.replace(/\bAvenida\b/gi, "Av.")),
    (result = result.replace(/\bAvda\.?\b/gi, "Av.")),
    (result = result.replace(/\bCarretera\b/gi, "Ctra.")),
    (result = result.replace(/\bUrbanizaci[oó]n\b/gi, "Urb.")),
    (result = result.replace(/\bPlaza\b/gi, "Pl.")),
    (result = result.replace(/\bGlorieta\b/gi, "Gta.")),
    (result = result.replace(/\bCamino\b/gi, "Cno.")),
    (result = result.replace(/\bPaseo\b/gi, "Pº")),
    (result = result.replace(/\bPasaje\b/gi, "Pje.")),
    (result = result.replace(/\bRonda\b/gi, "Rda.")),
    (result = result.replace(/\bTraves[ií]a\b/gi, "Trv.")),
    (result = result.replace(/\bBarrio\b/gi, "Bº")),
    (result = result.replace(/\bPol[ií]gono\b/gi, "Pol.")),
    (result = result.replace(/\bResidencial\b/gi, "Res.")),
    (result = result.replace(/\bEdificio\b/gi, "Ed.")),
    (result = result.replace(/\bCentro Comercial\b/gi, "C.C.")),
    (result = result.replace(/\bStreet\b/gi, "St.")),
    (result = result.replace(/\bRoad\b/gi, "Rd.")),
    (result = result.replace(/\bAvenue\b/gi, "Ave.")),
    (result = result.replace(/\bBoulevard\b/gi, "Blvd.")),
    (result = result.replace(/\bSquare\b/gi, "Sq.")),
    (result = result.replace(/\bLane\b/gi, "Ln.")),
    (result = result.replace(/\bDrive\b/gi, "Dr.")),
    (result = result.replace(/\bPlace\b/gi, "Pl.")),
    (result = result.replace(/\bCourt\b/gi, "Ct.")),
    (result = result.replace(/\bHighway\b/gi, "Hwy.")),
    (result = result.replace(/\bParkway\b/gi, "Pkwy.")),
    (result = result.replace(/\bStraße\b/gi, "Str.")),
    (result = result.replace(/\bStrasse\b/gi, "Str.")),
    (result = result.replace(/\bPlatz\b/gi, "Pl.")),
    (result = result.replace(/\bAllee\b/gi, "Al.")),
    (result = result.replace(/\bWeg\b/gi, "Wg.")),
    (result = result.replace(/\bGasse\b/gi, "G.")),
    result
  );
}
function shortenMapLabelForMobile(text) {
  if (!text) return "";
  const trimmed = String(text).trim();
  return trimmed.length <= 26 ? trimmed : trimmed.slice(0, 23) + "…";
}
function simplifyAirportName(name) {
  if (!name) return "";
  const raw = String(name).trim(),
    lower = raw.toLowerCase();
  if (
    !lower.includes("aeropuerto") &&
    !lower.includes("airport") &&
    !lower.includes("flughafen")
  )
    return "";
  let base = raw.split(/[\-–(]/)[0].trim(),
    city = "",
    match = base.match(/^(.+?)\s+Airport$/i);
  switch (
    (match ||
      (match = base.match(
        /^Aeropuerto\s+(?:Internacional\s+de\s+|de\s+)?(.+)/i,
      )),
    match || (match = base.match(/^Flughafen\s+(.+)/i)),
    (city = match
      ? match[1].trim()
      : base
          .replace(/Aeropuerto\s*(Internacional)?\s*de?/i, "")
          .replace(/Airport/i, "")
          .replace(/Flughafen/i, "")
          .trim()),
    city || (city = base),
    CURRENT_LANG)
  ) {
    case "en":
      return city + " Airport";
    case "de":
      return "Flughafen " + city;
    default:
      return "Aeropuerto de " + city;
  }
}
function updateAddressSummary(summaryEl, place) {
  if (!summaryEl) return;
  if (
    !!(!place || !place.place_id || (!place.formatted_address && !place.name))
  )
    return void clearAddressSummary(summaryEl);
  const html = buildAddressSummaryText(place);
  html
    ? ((summaryEl.innerHTML = html),
      summaryEl.classList.add(
        "address-summary--visible",
        "address-summary--valid",
      ))
    : clearAddressSummary(summaryEl);
}
function clearAddressSummary(summaryEl) {
  summaryEl &&
    ((summaryEl.innerHTML = ""),
    summaryEl.classList.remove(
      "address-summary--visible",
      "address-summary--valid",
    ));
}
function setupPlaceAutocompleteElementField(inputEl, summaryEl, key) {
  if (!inputEl) return !1;
  if (!google.maps.places || !google.maps.places.PlaceAutocompleteElement)
    return !1;
  try {
    try {
      autocompleteSessionTokens[key] =
        new google.maps.places.AutocompleteSessionToken();
    } catch (e) {
      (console.warn("Failed to create AutocompleteSessionToken:", e),
        (autocompleteSessionTokens[key] = null));
    }
    const parent = inputEl.parentElement,
      placeAutocomplete = new google.maps.places.PlaceAutocompleteElement({});
    if (autocompleteSessionTokens[key])
      try {
        placeAutocomplete.sessionToken = autocompleteSessionTokens[key];
      } catch (e) {
        console.warn(
          "Failed to set sessionToken on PlaceAutocompleteElement:",
          e,
        );
      }
    try {
      placeAutocomplete.classList.add("tc-place-autocomplete");
    } catch (_) {}
    let associatedLabel = null;
    try {
      inputEl.id &&
        (associatedLabel = document.querySelector(
          'label[for="' + inputEl.id + '"]',
        ));
    } catch (_) {}
    (inputEl.placeholder &&
      (placeAutocomplete.placeholder = inputEl.placeholder),
      parent &&
        (parent.insertBefore(placeAutocomplete, inputEl),
        (inputEl.style.position = "absolute"),
        (inputEl.style.pointerEvents = "none"),
        (inputEl.style.height = "0"),
        (inputEl.style.margin = "0"),
        (inputEl.style.padding = "0")));
    const getInternalInput = () => {
        try {
          return (
            placeAutocomplete.querySelector("input") ||
            (placeAutocomplete.shadowRoot &&
              placeAutocomplete.shadowRoot.querySelector("input"))
          );
        } catch (_) {
          return null;
        }
      },
      ensureInternalInputSetup = () => {
        const internalInput = getInternalInput();
        if (!internalInput) return !1;
        const internalId = inputEl.id ? inputEl.id + "-pac" : "";
        try {
          internalId && !internalInput.id && (internalInput.id = internalId);
        } catch (_) {}
        try {
          internalInput.name ||
            (internalInput.name =
              inputEl.getAttribute("name") || inputEl.id || key);
        } catch (_) {}
        try {
          const describedBy = inputEl.getAttribute("aria-describedby");
          describedBy &&
            internalInput.setAttribute("aria-describedby", describedBy);
        } catch (_) {}
        try {
          associatedLabel &&
            internalId &&
            associatedLabel.setAttribute("for", internalId);
        } catch (_) {}
        try {
          "string" == typeof inputEl.placeholder &&
            inputEl.placeholder &&
            (internalInput.placeholder = inputEl.placeholder);
        } catch (_) {}
        try {
          internalInput.autocomplete = "off";
        } catch (_) {}
        return !0;
      };
    (!(function waitForInternalInputSetup(attempt) {
      ensureInternalInputSetup() ||
        attempt >= 60 ||
        requestAnimationFrame(() => waitForInternalInputSetup(attempt + 1));
    })(0),
      placeAutocomplete.addEventListener(
        "gmp-select",
        async ({ placePrediction: placePrediction }) => {
          try {
            if (
              !placePrediction ||
              "function" != typeof placePrediction.toPlace
            )
              return (
                (autocompleteSelectedPlaces[key] = null),
                (autocompleteLastConfirmedText[key] = ""),
                clearAddressSummary(summaryEl),
                void (inputEl && (inputEl.value = ""))
              );
            const place = placePrediction.toPlace();
            place &&
              "function" == typeof place.fetchFields &&
              (await place.fetchFields({
                fields: [
                  "id",
                  "displayName",
                  "formattedAddress",
                  "addressComponents",
                  "location",
                ],
              }));
            const adaptedPlace = {
                place_id: place && place.id ? place.id : null,
                name:
                  place && place.displayName && place.displayName.text
                    ? place.displayName.text
                    : "",
                formatted_address:
                  place && place.formattedAddress ? place.formattedAddress : "",
                address_components:
                  place && place.addressComponents
                    ? place.addressComponents
                    : null,
                geometry:
                  place && place.location ? { location: place.location } : null,
              },
              validPlace = !!adaptedPlace.place_id ? adaptedPlace : null;
            ((autocompleteSelectedPlaces[key] = validPlace),
              (autocompleteLastConfirmedText[key] = ""),
              updateAddressSummary(summaryEl, validPlace));
            try {
              if (
                ((autocompleteSessionTokens[key] =
                  new google.maps.places.AutocompleteSessionToken()),
                placeAutocomplete && autocompleteSessionTokens[key])
              )
                try {
                  placeAutocomplete.sessionToken =
                    autocompleteSessionTokens[key];
                } catch (e) {
                  console.warn(
                    "Failed to refresh sessionToken on PlaceAutocompleteElement:",
                    e,
                  );
                }
            } catch (e) {
              (console.warn("Failed to refresh AutocompleteSessionToken:", e),
                (autocompleteSessionTokens[key] = null));
            }
            if (validPlace) {
              const displayText =
                validPlace.formatted_address || validPlace.name || "";
              inputEl &&
                ((autocompleteSuppressNextInputInvalidation[key] = !0),
                (inputEl.value = displayText),
                (autocompleteLastConfirmedText[key] = String(
                  displayText || "",
                ).trim()),
                setTimeout(() => {
                  autocompleteSuppressNextInputInvalidation[key] = !1;
                }, 0));
            } else
              (inputEl && (inputEl.value = ""),
                (autocompleteLastConfirmedText[key] = ""),
                clearAddressSummary(summaryEl));
          } catch (_) {
            ((autocompleteSelectedPlaces[key] = null),
              (autocompleteLastConfirmedText[key] = ""),
              clearAddressSummary(summaryEl),
              inputEl && (inputEl.value = ""));
          }
        },
      ));
    try {
      const attachInternalInputListener = () => {
        const internalInput = getInternalInput();
        return (
          !!internalInput &&
          (internalInput.addEventListener("input", () => {
            if (autocompleteSuppressNextInputInvalidation[key]) return;
            try {
              inputEl && (inputEl.value = internalInput.value);
            } catch (_) {}
            if (!internalInput.value)
              return (
                (autocompleteSelectedPlaces[key] = null),
                (autocompleteLastConfirmedText[key] = ""),
                clearAddressSummary(summaryEl),
                void (inputEl && (inputEl.value = ""))
              );
            const currentText = String(internalInput.value || "").trim(),
              confirmedText = String(
                autocompleteLastConfirmedText[key] || "",
              ).trim();
            autocompleteSelectedPlaces[key] &&
              confirmedText &&
              currentText !== confirmedText &&
              ((autocompleteSelectedPlaces[key] = null),
              (autocompleteLastConfirmedText[key] = ""),
              clearAddressSummary(summaryEl));
          }),
          !0)
        );
      };
      !(function waitForInternalInputListener(attempt) {
        attachInternalInputListener() ||
          attempt >= 60 ||
          requestAnimationFrame(() =>
            waitForInternalInputListener(attempt + 1),
          );
      })(0);
    } catch (_) {}
    return !0;
  } catch (e) {
    return (
      console.error("Error initialising PlaceAutocompleteElement for", key, e),
      !1
    );
  }
}
function setupLegacyAutocompleteField(inputEl, options, summaryEl, key) {
  if (!inputEl || !google.maps.places || !google.maps.places.Autocomplete)
    return;
  try {
    autocompleteSessionTokens[key] =
      new google.maps.places.AutocompleteSessionToken();
  } catch (e) {
    (console.warn("Failed to create AutocompleteSessionToken:", e),
      (autocompleteSessionTokens[key] = null));
  }
  const optionsWithToken = Object.assign({}, options);
  autocompleteSessionTokens[key] &&
    (optionsWithToken.sessionToken = autocompleteSessionTokens[key]);
  const instance = new google.maps.places.Autocomplete(
    inputEl,
    optionsWithToken,
  );
  ((autocompleteInstances[key] = instance),
    instance.addListener("place_changed", () => {
      try {
        const place = instance.getPlace(),
          validPlace = place && place.place_id ? place : null;
        ((autocompleteSelectedPlaces[key] = validPlace),
          (autocompleteSuppressNextInputInvalidation[key] = !0),
          (autocompleteLastConfirmedText[key] = String(
            inputEl && inputEl.value ? inputEl.value : "",
          ).trim()),
          updateAddressSummary(summaryEl, validPlace));
        try {
          autocompleteSessionTokens[key] =
            new google.maps.places.AutocompleteSessionToken();
        } catch (e) {
          (console.warn("Failed to refresh AutocompleteSessionToken:", e),
            (autocompleteSessionTokens[key] = null));
        }
        setTimeout(() => {
          autocompleteSuppressNextInputInvalidation[key] = !1;
        }, 0);
      } catch (_) {
        ((autocompleteSelectedPlaces[key] = null),
          (autocompleteLastConfirmedText[key] = ""),
          (autocompleteSuppressNextInputInvalidation[key] = !1),
          clearAddressSummary(summaryEl));
      }
    }),
    inputEl.addEventListener("input", () => {
      if (autocompleteSuppressNextInputInvalidation[key]) return;
      if (!inputEl.value || !inputEl.value.trim())
        return (
          (autocompleteSelectedPlaces[key] = null),
          (autocompleteLastConfirmedText[key] = ""),
          void clearAddressSummary(summaryEl)
        );
      const currentText = String(inputEl.value || "").trim(),
        confirmedText = String(autocompleteLastConfirmedText[key] || "").trim();
      autocompleteSelectedPlaces[key] &&
        confirmedText &&
        currentText !== confirmedText &&
        ((autocompleteSelectedPlaces[key] = null),
        (autocompleteLastConfirmedText[key] = ""),
        clearAddressSummary(summaryEl));
    }));
}
"undefined" != typeof window &&
  ((window.__taxiI18n = window.__taxiI18n || {}),
  (window.__taxiI18n.CURRENT_LANG = getPageLangCode()),
  (window.__taxiI18n.LOCALES = LOCALES),
  (window.__taxiI18n.I18N = I18N),
  (window.__taxiI18n.getMessagesSection = getMessagesSection));
let pacItemIconsObserverInitialised = !1;
function getPacItemCategoryForText(mainText, secondaryText) {
  const all = ((mainText || "") + " " + (secondaryText || "")).toLowerCase(),
    tokens = all.split(/[\s,.;:()\-]+/).filter(Boolean),
    hasToken = (...candidates) => tokens.some((t) => candidates.includes(t));
  return hasToken(
    "hotel",
    "hostal",
    "hostel",
    "apartamento",
    "apartamentos",
    "apartment",
    "apartments",
    "aparthotel",
    "pensión",
    "pension",
    "bnb",
    "b&b",
    "hipotels",
    "hipotel",
  ) || all.includes("hipote")
    ? "lodging"
    : hasToken(
          "camping",
          "camper",
          "caravan",
          "caravana",
          "caravanning",
          "wohnmobil",
          "stellplatz",
        ) ||
        all.includes("camp site") ||
        all.includes("campsite") ||
        all.includes("camp ground") ||
        all.includes("campground") ||
        all.includes("area autocaravanas") ||
        all.includes("área de autocaravanas") ||
        all.includes("area de autocaravanas")
      ? "camping"
      : hasToken("surf", "kitesurf", "windsurf", "sup") ||
          all.includes("escuela de surf") ||
          all.includes("surf school") ||
          all.includes("paddle surf")
        ? "surf"
        : hasToken(
              "taller",
              "talleres",
              "mechanic",
              "mechanics",
              "mecánico",
              "mecanico",
              "garage",
              "garaje",
            )
          ? "mechanic"
          : hasToken("gasolinera", "gasoline", "fuel", "petrol") ||
              all.includes("gas station") ||
              all.includes("service station") ||
              all.includes("estación de servicio") ||
              all.includes("estacion de servicio")
            ? "fuel"
            : hasToken(
                  "supermercado",
                  "supermarket",
                  "hipermercado",
                  "hypermarket",
                  "grocery",
                  "mercado",
                ) ||
                all.includes("cash & carry") ||
                all.includes("cash and carry")
              ? "grocery"
              : hasToken(
                    "restaurante",
                    "restaurant",
                    "bistró",
                    "bistro",
                    "trattoria",
                    "osteria",
                    "pizzería",
                    "pizzeria",
                    "tapas",
                    "bar",
                    "bares",
                    "bodega",
                    "taberna",
                    "mesón",
                    "meson",
                  )
                ? "food"
                : hasToken(
                      "hospital",
                      "clinic",
                      "clínica",
                      "clinica",
                      "medical",
                      "médico",
                      "medico",
                      "doctor",
                      "doctors",
                      "dentist",
                      "dentista",
                      "pharmacy",
                      "farmacia",
                      "veterinario",
                      "veterinaria",
                      "veterinary",
                      "vet",
                      "peluquería",
                      "peluqueria",
                      "peluquerías",
                      "peluquerias",
                      "hairdresser",
                      "hairdressers",
                      "hair",
                      "barber",
                      "barbers",
                      "barbería",
                      "barberia",
                    )
                  ? "health"
                  : hasToken(
                        "spa",
                        "balneario",
                        "wellness",
                        "hammam",
                        "sauna",
                        "thermal",
                        "termas",
                        "thalasso",
                        "thalassotherapy",
                      )
                    ? "spa"
                    : all.includes("centro comercial") ||
                        all.includes("shopping center") ||
                        all.includes("shopping centre") ||
                        all.includes("mall") ||
                        all.includes("retail park") ||
                        all.includes("outlet")
                      ? "mall"
                      : all.includes("circuito") ||
                          all.includes("race track") ||
                          all.includes("racetrack") ||
                          all.includes("autódromo") ||
                          all.includes("autodromo") ||
                          all.includes("karting")
                        ? "racetrack"
                        : hasToken("playa", "beach")
                          ? "beach"
                          : hasToken("chiringuito") ||
                              all.includes("beach bar") ||
                              all.includes("beach club") ||
                              all.includes("strandbar")
                            ? "beachbar"
                            : hasToken(
                                  "parque",
                                  "park",
                                  "jardín",
                                  "jardin",
                                  "garden",
                                  "gardens",
                                )
                              ? "park"
                              : hasToken(
                                    "colegio",
                                    "escuela",
                                    "school",
                                    "instituto",
                                    "lyceum",
                                    "liceo",
                                    "university",
                                    "universidad",
                                    "campus",
                                    "college",
                                    "facultad",
                                  )
                                ? "education"
                                : hasToken("golf", "golfplatz", "golfclub") ||
                                    all.includes("campo de golf") ||
                                    all.includes("club de golf") ||
                                    all.includes("golf course")
                                  ? "golf"
                                  : hasToken(
                                        "pádel",
                                        "padel",
                                        "tenis",
                                        "tennis",
                                        "club deportivo",
                                        "polideportivo",
                                        "sports club",
                                        "sport club",
                                        "gym",
                                        "gimnasio",
                                        "fitness",
                                        "crossfit",
                                      )
                                    ? "sports"
                                    : hasToken(
                                          "puerto",
                                          "port",
                                          "harbor",
                                          "harbour",
                                          "marina",
                                          "muelle",
                                          "dock",
                                        )
                                      ? "port"
                                      : hasToken(
                                            "fábrica",
                                            "fabrica",
                                            "industrial",
                                          ) ||
                                          all.includes("polígono industrial") ||
                                          all.includes("poligono industrial") ||
                                          all.includes("industrial park") ||
                                          all.includes("industrial estate") ||
                                          all.includes("industrial zone") ||
                                          hasToken("polígono", "poligono")
                                        ? "industrial"
                                        : hasToken(
                                              "parking",
                                              "aparcamiento",
                                              "aparcamiento",
                                              "aparcacoches",
                                            ) ||
                                            all.includes("car park") ||
                                            all.includes("park & ride") ||
                                            all.includes("park and ride")
                                          ? "parking"
                                          : all.includes(
                                                "estación de autobuses",
                                              ) ||
                                              all.includes(
                                                "estacion de autobuses",
                                              ) ||
                                              all.includes("bus station") ||
                                              hasToken(
                                                "autobús",
                                                "autobus",
                                                "bus",
                                              )
                                            ? "bus"
                                            : all.includes("rent a car") ||
                                                all.includes("rentacar") ||
                                                all.includes("rent-a-car") ||
                                                all.includes("car rental") ||
                                                all.includes(
                                                  "alquiler de coches",
                                                ) ||
                                                all.includes(
                                                  "alquiler de vehículos",
                                                ) ||
                                                all.includes(
                                                  "alquiler de vehiculos",
                                                ) ||
                                                hasToken(
                                                  "concesionario",
                                                  "concesionarios",
                                                  "dealer",
                                                  "dealership",
                                                )
                                              ? "car"
                                              : hasToken(
                                                    "moto",
                                                    "motos",
                                                    "motocicleta",
                                                    "motocicletas",
                                                    "scooter",
                                                    "bike",
                                                    "bikes",
                                                    "bicycle",
                                                    "bicycles",
                                                    "bicicleta",
                                                    "bicicletas",
                                                  )
                                                ? "bike"
                                                : hasToken(
                                                      "oficina",
                                                      "oficinas",
                                                      "office",
                                                      "offices",
                                                      "business",
                                                      "empresa",
                                                      "empresas",
                                                      "coworking",
                                                      "negocio",
                                                      "negocios",
                                                      "shop",
                                                      "tienda",
                                                      "tiendas",
                                                    ) ||
                                                    all.includes(
                                                      "business park",
                                                    ) ||
                                                    all.includes(
                                                      "business center",
                                                    ) ||
                                                    all.includes(
                                                      "business centre",
                                                    )
                                                  ? "business"
                                                  : hasToken(
                                                        "ayuntamiento",
                                                        "cityhall",
                                                        "cityhall",
                                                        "alcaldía",
                                                        "alcaldia",
                                                        "municipal",
                                                      ) ||
                                                      all.includes(
                                                        "city hall",
                                                      ) ||
                                                      all.includes(
                                                        "town hall",
                                                      ) ||
                                                      all.includes("council")
                                                    ? "civic"
                                                    : hasToken(
                                                          "aeropuerto",
                                                          "airport",
                                                          "flughafen",
                                                        )
                                                      ? "airport"
                                                      : hasToken(
                                                            "estación",
                                                            "estacion",
                                                            "station",
                                                            "bahnhof",
                                                            "gare",
                                                            "terminal",
                                                          )
                                                        ? "station"
                                                        : all.includes(
                                                              "concert music",
                                                            ) ||
                                                            all.includes(
                                                              "bahia sound",
                                                            ) ||
                                                            all.includes(
                                                              "bahía sound",
                                                            ) ||
                                                            all.includes(
                                                              "la mina",
                                                            ) ||
                                                            all.includes(
                                                              "live music",
                                                            ) ||
                                                            all.includes(
                                                              "live-music",
                                                            ) ||
                                                            hasToken(
                                                              "concierto",
                                                              "conciertos",
                                                              "concert",
                                                              "konzert",
                                                              "festival",
                                                              "festivales",
                                                              "fest",
                                                            ) ||
                                                            hasToken(
                                                              "auditorio",
                                                              "auditorium",
                                                            )
                                                          ? "concert"
                                                          : hasToken(
                                                                "iglesia",
                                                                "ermita",
                                                                "parroquia",
                                                                "church",
                                                                "cathedral",
                                                                "catedral",
                                                                "basilica",
                                                                "basílica",
                                                                "kirche",
                                                              ) ||
                                                              hasToken(
                                                                "castillo",
                                                                "castle",
                                                                "torre",
                                                                "fortaleza",
                                                                "monumento",
                                                                "monument",
                                                                "denkmal",
                                                              ) ||
                                                              hasToken(
                                                                "museo",
                                                                "museum",
                                                              )
                                                            ? "landmark"
                                                            : hasToken(
                                                                  "teatro",
                                                                  "theatre",
                                                                  "theater",
                                                                  "schauspielhaus",
                                                                ) ||
                                                                all.includes(
                                                                  "playhouse",
                                                                )
                                                              ? "theatre"
                                                              : hasToken(
                                                                    "cine",
                                                                    "cinema",
                                                                    "kino",
                                                                    "multicines",
                                                                    "multicine",
                                                                  )
                                                                ? "cinema"
                                                                : hasToken(
                                                                      "discoteca",
                                                                      "nightclub",
                                                                      "nachtclub",
                                                                      "pub",
                                                                      "club",
                                                                    )
                                                                  ? "nightlife"
                                                                  : "default";
}
function setupPacItemIconsObserver() {
  if (pacItemIconsObserverInitialised) return;
  if (
    ((pacItemIconsObserverInitialised = !0),
    "undefined" == typeof MutationObserver)
  )
    return;
  const enhanceContainer = (container) => {
      if (!container) return;
      const enhanceItems = () => {
        container.querySelectorAll(".pac-item").forEach((item) => {
          if (!item) return;
          let textWrapper = item.querySelector(".pac-item-text");
          if (!textWrapper) {
            const firstTextSpan =
              item.querySelector(".pac-item-query") ||
              item.querySelector(
                "span:not(.pac-icon):not(.pac-item-custom-icon)",
              );
            if (firstTextSpan) {
              ((textWrapper = document.createElement("div")),
                (textWrapper.className = "pac-item-text"),
                item.insertBefore(textWrapper, firstTextSpan));
              let sibling = textWrapper.nextSibling;
              for (
                ;
                sibling &&
                sibling.nodeType === Node.ELEMENT_NODE &&
                "SPAN" === sibling.tagName &&
                !sibling.classList.contains("pac-icon") &&
                !sibling.classList.contains("pac-item-custom-icon");
              ) {
                const next = sibling.nextSibling;
                (textWrapper.appendChild(sibling), (sibling = next));
              }
            }
          }
          if (item.querySelector(".pac-item-custom-icon")) return;
          const mainSpan = item.querySelector(".pac-item-query"),
            secondarySpan = mainSpan ? mainSpan.nextElementSibling : null,
            category = getPacItemCategoryForText(
              (mainSpan && mainSpan.textContent) || "",
              (secondarySpan && secondarySpan.textContent) || "",
            );
          if (!category) return;
          const iconSpan = document.createElement("span");
          iconSpan.className =
            "pac-item-custom-icon pac-item-custom-icon--" + category;
          let usedSvg = !1;
          const iconElement = document.createElement("i");
          let iconClass = "fa-solid ";
          switch (category) {
            case "camping":
              iconClass += "fa-campground";
              break;
            case "surf":
              iconClass += "fa-person-swimming";
              break;
            case "mechanic":
              iconClass += "fa-wrench";
              break;
            case "fuel":
              iconClass += "fa-gas-pump";
              break;
            case "grocery":
              iconClass += "fa-cart-shopping";
              break;
            case "food":
              iconClass += "fa-utensils";
              break;
            case "health":
              iconClass += "fa-hospital";
              break;
            case "spa":
              iconClass += "fa-spa";
              break;
            case "mall":
              iconClass += "fa-store";
              break;
            case "racetrack":
              iconClass += "fa-flag-checkered";
              break;
            case "beach":
              iconClass += "fa-umbrella-beach";
              break;
            case "park":
              iconClass += "fa-tree";
              break;
            case "landmark":
              iconClass += "fa-landmark";
              break;
            case "education":
              iconClass += "fa-graduation-cap";
              break;
            case "golf":
              ((usedSvg = !0),
                (iconSpan.innerHTML =
                  '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false" style="display:block"><path fill="currentColor" d="M7 3h10l-1.2 3H9.2v14H7V3Zm2.2 5.2 7.8 2.6-2 3.7-6.1-2v7.5H7.2V8.2h2Z"/><path fill="currentColor" d="M18.5 18.5a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" opacity=".85"/></svg>'));
              break;
            case "port":
              iconClass += "fa-ship";
              break;
            case "industrial":
              iconClass += "fa-industry";
              break;
            case "parking":
              iconClass += "fa-square-parking";
              break;
            case "bus":
              iconClass += "fa-bus";
              break;
            case "car":
              iconClass += "fa-car";
              break;
            case "bike":
              iconClass += "fa-bicycle";
              break;
            case "sports":
              iconClass += "fa-dumbbell";
              break;
            case "concert":
              iconClass += "fa-music";
              break;
            case "theatre":
              iconClass += "fa-masks-theater";
              break;
            case "cinema":
              iconClass += "fa-film";
              break;
            case "business":
              iconClass += "fa-briefcase";
              break;
            case "civic":
              iconClass += "fa-building-columns";
              break;
            case "airport":
              iconClass += "fa-plane";
              break;
            case "station":
              iconClass += "fa-train";
              break;
            case "lodging":
              iconClass += "fa-bed";
              break;
            case "nightlife":
              iconClass += "fa-martini-glass";
              break;
            default:
              iconClass += "fa-location-dot";
          }
          usedSvg ||
            ((iconElement.className = iconClass),
            iconSpan.appendChild(iconElement));
          const insertBeforeNode =
            item.querySelector(".pac-item-text") ||
            item.querySelector(".pac-item-query") ||
            item.firstChild;
          item.insertBefore(iconSpan, insertBeforeNode);
        });
      };
      enhanceItems();
      new MutationObserver(() => {
        enhanceItems();
      }).observe(container, { childList: !0, subtree: !0 });
    },
    rootObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node instanceof HTMLElement)
            if (node.classList.contains("pac-container"))
              enhanceContainer(node);
            else {
              node.querySelectorAll(".pac-container").forEach(enhanceContainer);
            }
        });
      });
    });
  if (document.body) {
    rootObserver.observe(document.body, { childList: !0, subtree: !0 });
    document.querySelectorAll(".pac-container").forEach(enhanceContainer);
  }
}
let currentCalculation = {
  origin: "",
  destination: "",
  distanceKm: 0,
  durationSeconds: 0,
  durationText: "",
  billedDistanceKm: 0,
  billedDurationSeconds: 0,
  billedDurationText: "",
  rawPrice: 0,
  totalPriceOneWay: 0,
  pickupDateTime: null,
  isBelowMinPrice: !1,
  isMinPriceApplied: !1,
  lastRequestKey: "",
};
try {
  "undefined" != typeof window &&
    ((window.currentRouteOverviewPath = null),
    (window.currentReturnRouteOverviewPath = null),
    (window.__tc_debug = window.__tc_debug || {}));
} catch (_) {}
const DIRECTIONS_ROUTE_CACHE_MAX_ENTRIES = 30,
  DIRECTIONS_ROUTE_CACHE_TTL_MS = 216e5,
  DIRECTIONS_ROUTE_CACHE_STORAGE_KEY = "tc_directions_route_cache",
  directionsRouteCache = new Map();
function buildDirectionsRouteCacheKey(
  originParam,
  destinationParam,
  extraToken,
) {
  try {
    const normalise = (value) =>
        String(value || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, " "),
      tokenise = (param) =>
        param &&
        "object" == typeof param &&
        "string" == typeof param.placeId &&
        param.placeId
          ? "pid:" + param.placeId
          : "txt:" + normalise(param),
      o = tokenise(originParam),
      d = tokenise(destinationParam);
    if (!o || !d) return "";
    const t = normalise(extraToken);
    return t ? o + "||" + d + "||" + t : o + "||" + d;
  } catch (_) {
    return "";
  }
}
function setDirectionsRouteCache(key, response) {
  try {
    if (!key) return;
    const cacheEntry = { response: response, timestamp: Date.now() };
    for (
      directionsRouteCache.has(key) && directionsRouteCache.delete(key),
        directionsRouteCache.set(key, cacheEntry);
      directionsRouteCache.size > 30;
    ) {
      const firstKey = directionsRouteCache.keys().next().value;
      if (!firstKey) break;
      directionsRouteCache.delete(firstKey);
    }
    try {
      if ("undefined" != typeof window && window.localStorage) {
        const cacheObj = {};
        (directionsRouteCache.forEach((value, k) => {
          cacheObj[k] = value;
        }),
          window.localStorage.setItem(
            "tc_directions_route_cache",
            JSON.stringify(cacheObj),
          ));
      }
    } catch (_) {}
  } catch (_) {}
}
function loadDirectionsRouteCacheFromStorage() {
  try {
    if ("undefined" != typeof window && window.localStorage) {
      const raw = window.localStorage.getItem("tc_directions_route_cache");
      if (raw) {
        const cacheObj = JSON.parse(raw),
          now = Date.now();
        Object.entries(cacheObj).forEach(([key, entry]) => {
          entry &&
            entry.timestamp &&
            now - entry.timestamp < 216e5 &&
            directionsRouteCache.set(key, entry);
        });
      }
    }
  } catch (_) {}
}
function getDirectionsRouteCache(key) {
  try {
    if (!key) return null;
    const entry = directionsRouteCache.get(key);
    if (!entry) return null;
    const now = Date.now();
    return entry.timestamp && now - entry.timestamp > 216e5
      ? (directionsRouteCache.delete(key), null)
      : entry.response;
  } catch (_) {
    return null;
  }
}
let currentBookingDetails = {
    returnTrip: !1,
    returnPrice: 0,
    finalTotalPrice: 0,
    oneWayPrice: 0,
    returnDistanceKm: 0,
    returnDurationText: "",
    returnBilledDistanceKm: 0,
    returnBilledDurationText: "",
    returnBilledDurationSeconds: 0,
    returnOrigin: "",
    returnDestination: "",
    returnRawPrice: 0,
    returnPickupDateTime: null,
  },
  googleMapsInitRetryCount = 0,
  googleMapsNotLoadedAlertShown = !1,
  googleMapsInitRetryTimer = null;
const googleMapsAutocompleteRequestedKeys = new Set();
loadDirectionsRouteCacheFromStorage();
let googleMapsAllowNotLoadedAlert = !1;
function initMap() {
  if (
    ((googleApiLoaded =
      "object" == typeof google && "object" == typeof google.maps),
    !googleApiLoaded)
  )
    return void console.error("Google Maps API failed to load.");
  if (
    !googleMapsAutocompleteRequestedKeys ||
    0 === googleMapsAutocompleteRequestedKeys.size
  )
    return;
  try {
    if (!google.maps.places || !google.maps.places.Autocomplete) {
      if (googleMapsInitRetryCount < 12) {
        googleMapsInitRetryCount += 1;
        try {
          googleMapsInitRetryTimer && clearTimeout(googleMapsInitRetryTimer);
        } catch (_) {}
        googleMapsInitRetryTimer = setTimeout(() => {
          try {
            initMap();
          } catch (_) {}
        }, 200);
      } else if (
        (console.error(
          "Google Maps Places library is not available. Check that the Places API is enabled and billing/referrer restrictions are correct.",
        ),
        googleMapsAllowNotLoadedAlert && !googleMapsNotLoadedAlertShown)
      ) {
        googleMapsNotLoadedAlertShown = !0;
        try {
          const alerts = getMessagesSection("alerts");
          alert(alerts.googleMapsNotLoaded);
        } catch (_) {}
      }
      return;
    }
  } catch (_) {
    return;
  }
  googleMapsInitRetryCount = 0;
  try {
    googleMapsInitRetryTimer &&
      (clearTimeout(googleMapsInitRetryTimer),
      (googleMapsInitRetryTimer = null));
  } catch (_) {}
  const CONIL_LAT_LNG_lat = 36.2746,
    CONIL_LAT_LNG_lng = -6.089,
    conilBounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(CONIL_LAT_LNG_lat - 0.1, CONIL_LAT_LNG_lng - 0.1),
      new google.maps.LatLng(CONIL_LAT_LNG_lat + 0.1, CONIL_LAT_LNG_lng + 0.1),
    ),
    localAutocompleteOptions = {
      fields: [
        "formatted_address",
        "name",
        "place_id",
        "address_components",
        "geometry",
      ],
      bounds: conilBounds,
      strictBounds: !1,
    },
    spainAutocompleteOptions = {
      fields: [
        "formatted_address",
        "name",
        "place_id",
        "address_components",
        "geometry",
      ],
      bounds: conilBounds,
      strictBounds: !1,
    };
  try {
    const origenCalcInput = document.getElementById("origen-calc"),
      destinoCalcInput = document.getElementById("destino-calc"),
      origenVueltaInput = document.getElementById("origen-vuelta-calc"),
      destinoVueltaInput = document.getElementById("destino-vuelta-calc"),
      additionalTripOrigenInput = document.getElementById(
        "additional-trip-origen",
      ),
      additionalTripDestinoInput = document.getElementById(
        "additional-trip-destino",
      ),
      origenCalcSummary = document.getElementById("origen-calc-summary"),
      destinoCalcSummary = document.getElementById("destino-calc-summary"),
      origenVueltaSummary = document.getElementById(
        "origen-vuelta-calc-summary",
      ),
      destinoVueltaSummary = document.getElementById(
        "destino-vuelta-calc-summary",
      ),
      additionalTripOrigenSummary = document.getElementById(
        "additional-trip-origen-summary",
      ),
      additionalTripDestinoSummary = document.getElementById(
        "additional-trip-destino-summary",
      );
    (googleMapsAutocompleteRequestedKeys.has("origenCalc") &&
      origenCalcInput &&
      !autocompleteInstances.origenCalc &&
      setupLegacyAutocompleteField(
        origenCalcInput,
        localAutocompleteOptions,
        origenCalcSummary,
        "origenCalc",
      ),
      googleMapsAutocompleteRequestedKeys.has("destinoCalc") &&
        destinoCalcInput &&
        !autocompleteInstances.destinoCalc &&
        setupLegacyAutocompleteField(
          destinoCalcInput,
          spainAutocompleteOptions,
          destinoCalcSummary,
          "destinoCalc",
        ),
      googleMapsAutocompleteRequestedKeys.has("origenVuelta") &&
        origenVueltaInput &&
        !autocompleteInstances.origenVuelta &&
        setupLegacyAutocompleteField(
          origenVueltaInput,
          localAutocompleteOptions,
          origenVueltaSummary,
          "origenVuelta",
        ),
      googleMapsAutocompleteRequestedKeys.has("destinoVuelta") &&
        destinoVueltaInput &&
        !autocompleteInstances.destinoVuelta &&
        setupLegacyAutocompleteField(
          destinoVueltaInput,
          spainAutocompleteOptions,
          destinoVueltaSummary,
          "destinoVuelta",
        ),
      googleMapsAutocompleteRequestedKeys.has("additionalTripOrigen") &&
        additionalTripOrigenInput &&
        !autocompleteInstances.additionalTripOrigen &&
        setupLegacyAutocompleteField(
          additionalTripOrigenInput,
          localAutocompleteOptions,
          additionalTripOrigenSummary,
          "additionalTripOrigen",
        ),
      googleMapsAutocompleteRequestedKeys.has("additionalTripDestino") &&
        additionalTripDestinoInput &&
        !autocompleteInstances.additionalTripDestino &&
        setupLegacyAutocompleteField(
          additionalTripDestinoInput,
          spainAutocompleteOptions,
          additionalTripDestinoSummary,
          "additionalTripDestino",
        ));
  } catch (e) {
    console.error("Error initialising Google autocomplete:", e);
  }
}
let googleMapsLoadingPromise = null;
const CONIL_CENTER_POINT = { lat: 36.2746, lng: -6.089 },
  CONIL_CENTER_ADDRESS =
    "Calle Carretera 18, 11140 Conil de la Frontera, Cádiz, España",
  CONIL_CENTER_OUTSKIRTS_RADIUS_M = 2500,
  CONIL_CENTER_PASS_NEAR_RADIUS_M = 2500,
  CONIL_RETURN_CORRIDOR_RADIUS_M = 2e3,
  CONIL_MUNICIPALITY_BOUNDS = {
    north: 36.36,
    south: 36.25,
    east: -6.02,
    west: -6.17,
  },
  CADIZ_MUNICIPALITY_BOUNDS = {
    north: 36.56,
    south: 36.48,
    east: -6.24,
    west: -6.33,
  },
  CONIL_MUNICIPALITY_ZONES = [
    "roche",
    "roche urbanizacion",
    "roche urbanización",
    "urbanizacion roche",
    "urbanización roche",
    "calas de roche",
    "calas de conil",
    "colorado",
    "el colorado",
    "barrio nuevo",
    "la florida",
    "la vigia",
    "la vigía",
    "pocito blanco",
    "pozcito blanco",
    "fuente del gallo",
    "fontanilla",
    "los canos",
    "punta alegre",
    "costa calma",
    "atlanterra",
    "bateles",
    "camposoto",
    "ilunion",
    "hotel ilunion",
    "ilunion conil",
    "conil center",
    "conil centre",
    "playa de conil",
    "playas de conil",
    "carretera de las parcelas",
    "parcelas",
    "carril de los fuguillas",
    "fuguillas",
    "carril del chiclanero",
    "chiclanero",
  ],
  TC_NO_RETURN_DISCOUNT_MIN_BASE_KM = 27,
  TC_NO_RETURN_DISCOUNT_EUR = 5,
  TC_NO_RETURN_DISCOUNT_ZONES = [
    {
      name: "Urbanización de Roche",
      bounds: { north: 36.325, south: 36.305, east: -6.135, west: -6.16 },
      discount: 8,
    },
    {
      name: "Roche Viejo",
      bounds: {
        north: 36.335908,
        south: 36.311353,
        east: -6.102194,
        west: -6.136934,
      },
      discount: 4,
    },
    {
      name: "Puerto Pesquero de Conil",
      bounds: { north: 36.3, south: 36.285, east: -6.13, west: -6.145 },
      discount: 5,
    },
    {
      name: "Fuente del Gallo",
      bounds: { north: 36.289, south: 36.276, east: -6.115, west: -6.135 },
      discount: 5,
    },
    {
      name: "Urbanización Fuente del Sol",
      bounds: { north: 36.298, south: 36.292, east: -6.109, west: -6.117 },
      discount: 4,
    },
    {
      name: "Zona Waypoint Cádiz 1",
      bounds: {
        north: 36.486698,
        south: 36.426698,
        east: -6.189504,
        west: -6.249504,
      },
      discount: 8,
    },
    {
      name: "Zona Waypoint Cádiz 2",
      bounds: {
        north: 36.503368,
        south: 36.443368,
        east: -6.171747,
        west: -6.231747,
      },
      discount: 8,
    },
  ];
function isOriginInDiscountZone(originLocation) {
  if (!originLocation || !originLocation.lat || !originLocation.lng)
    return { inZone: !1, discount: 5 };
  const lat = originLocation.lat,
    lng = originLocation.lng,
    zone = TC_NO_RETURN_DISCOUNT_ZONES.find((z) => {
      const b = z.bounds;
      return lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;
    });
  return zone
    ? { inZone: !0, discount: zone.discount || 5 }
    : { inZone: !1, discount: 5 };
}
const TC_GOOGLE_MAP_ID = "150019df79666595709f2472",
  TC_FORCE_COLORADO_WAYPOINT = { lat: 36.33839, lng: -6.09332 },
  TC_FORCE_COLORADO_PRE_WAYPOINT = { lat: 36.305, lng: -6.115 },
  TC_FORCE_COLORADO_POST_WAYPOINT = { lat: 36.325, lng: -6.085 },
  TC_CADIZ_WAYPOINT_TO_CONIL = { lat: 36.460127, lng: -6.246335 },
  TC_CADIZ_WAYPOINT_FROM_CONIL = { lat: 36.459999, lng: -6.246337 },
  TC_FORCE_COLORADO_CORRIDOR_CITIES = ["conil", "conil de la frontera"],
  TC_FORCE_COLORADO_DEST_CITIES = [
    "cadiz",
    "cádiz",
    "san fernando",
    "puerto real",
    "chiclana",
    "chiclana de la frontera",
    "el puerto de santa maria",
    "el puerto de santa maría",
    "puerto de santa maria",
    "puerto de santa maría",
    "rota",
    "chipiona",
    "sanlucar",
    "sanlucar de barrameda",
    "sanlúcar",
    "sanlúcar de barrameda",
    "jerez",
    "jerez de la frontera",
    "sevilla",
    "arcos",
    "arcos de la frontera",
    "medina sidonia",
    "medina-sidonia",
    "alcala de los gazules",
    "paterna de rivera",
    "bahia sur",
    "bahía sur",
    "bahiasur",
    "bahíasur",
    "estacion de tren bahia sur",
    "estación de tren bahía sur",
    "bahia sur train station",
    "bahía sur train station",
    "bahnhof bahia sur",
    "bahnhof bahía sur",
    "gare de bahia sur",
    "gare de bahía sur",
    "cadiz spain",
    "cádiz spain",
    "san fernando spain",
    "puerto real spain",
    "chiclana de la frontera spain",
    "el puerto de santa maria spain",
    "el puerto de santa maría spain",
    "rota spain",
    "chipiona spain",
    "sanlucar de barrameda spain",
    "sanlúcar de barrameda spain",
    "jerez de la frontera spain",
    "seville spain",
    "arcos de la frontera spain",
    "medina sidonia spain",
    "medina-sidonia spain",
    "alcala de los gazules spain",
    "paterna de rivera spain",
    "cadiz spanien",
    "cádiz spanien",
    "san fernando spanien",
    "puerto real spanien",
    "chiclana de la frontera spanien",
    "el puerto de santa maria spanien",
    "el puerto de santa maría spanien",
    "rota spanien",
    "chipiona spanien",
    "sanlucar de barrameda spanien",
    "sanlúcar de barrameda spanien",
    "jerez de la frontera spanien",
    "sevilla spanien",
    "arcos de la frontera spanien",
    "medina sidonia spanien",
    "medina-sidonia spanien",
    "alcala de los gazules spanien",
    "paterna de rivera spanien",
    "cadix espagne",
    "cádiz espagne",
    "san fernando espagne",
    "puerto real espagne",
    "chiclana de la frontera espagne",
    "el puerto de santa maria espagne",
    "el puerto de santa maría espagne",
    "rota espagne",
    "chipiona espagne",
    "sanlucar de barrameda espagne",
    "sanlúcar de barrameda espagne",
    "jerez de la frontera espagne",
    "séville espagne",
    "arcos de la frontera espagne",
    "medina sidonia espagne",
    "medina-sidonia espagne",
    "alcala de los gazules espagne",
    "paterna de rivera espagne",
  ],
  TC_FORCE_COLORADO_EXCLUDED_DEST_CITIES = [
    "vejer",
    "vejer de la frontera",
    "barbate",
    "zahora",
    "zahara",
    "zahara de los atunes",
    "caños",
    "canos",
    "caños de meca",
    "canos de meca",
    "tarifa",
    "bolonia",
    "facinas",
    "tahivilla",
    "zahara de la sierra",
    "algeciras",
    "la linea",
    "la línea",
    "gibraltar",
    "vejer de la frontera spain",
    "barbate spain",
    "zahara de los atunes spain",
    "canos de meca spain",
    "tarifa spain",
    "bolonia spain",
    "facinas spain",
    "tahivilla spain",
    "zahara de la sierra spain",
    "algeciras spain",
    "la linea de la concepcion spain",
    "la línea de la concepción spain",
    "gibraltar",
    "vejer de la frontera spanien",
    "barbate spanien",
    "zahara de los atunes spanien",
    "caños de meca spanien",
    "canos de meca spanien",
    "tarifa spanien",
    "bolonia spanien",
    "facinas spanien",
    "tahivilla spanien",
    "zahara de la sierra spanien",
    "algeciras spanien",
    "la linea de la concepcion spanien",
    "gibraltar",
    "vejer de la frontera espagne",
    "barbate espagne",
    "zahara de los atunes espagne",
    "caños de meca espagne",
    "canos de meca espagne",
    "tarifa espagne",
    "bolonia espagne",
    "facinas espagne",
    "tahivilla espagne",
    "zahara de la sierra espagne",
    "algeciras espagne",
    "la ligne de la conception espagne",
    "gibraltar",
  ],
  CONIL_RETURN_CORRIDOR_BOUNDS = {
    north: 36.309418,
    south: 36.280506,
    east: -6.044506,
    west: -6.101244,
  };
function isInReturnCorridorBounds(location) {
  if (!location) return !1;
  const lat = "function" == typeof location.lat ? location.lat() : location.lat,
    lng = "function" == typeof location.lng ? location.lng() : location.lng;
  return (
    !(!isFinite(lat) || !isFinite(lng)) &&
    lat >= CONIL_RETURN_CORRIDOR_BOUNDS.south &&
    lat <= CONIL_RETURN_CORRIDOR_BOUNDS.north &&
    lng >= CONIL_RETURN_CORRIDOR_BOUNDS.west &&
    lng <= CONIL_RETURN_CORRIDOR_BOUNDS.east
  );
}
const CONIL_RETURN_CORRIDOR_POINTS = [
  { lat: 36.2988, lng: -6.1155 },
  { lat: 36.2846, lng: -6.1377 },
  { lat: 36.2746, lng: -6.156 },
  { lat: 36.2632, lng: -6.1698 },
  { lat: 36.2509, lng: -6.1848 },
  { lat: 36.310725, lng: -6.082609 },
  { lat: 36.28977, lng: -6.063696 },
  { lat: 36.304729, lng: -6.055989 },
  { lat: 36.304374, lng: -6.055823 },
];
function tcNormalizeCityName(value) {
  try {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  } catch (_) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }
}
function tcShouldForceColorado(
  originPlace,
  originText,
  destinationPlace,
  destinationText,
) {
  try {
    const getLocation = (place) => {
        try {
          if (!place) return null;
          try {
          } catch (_) {}
          let lat, lng;
          if (place.geometry && place.geometry.location) {
            const loc = place.geometry.location;
            ((lat = "function" == typeof loc.lat ? loc.lat() : loc.lat),
              (lng = "function" == typeof loc.lng ? loc.lng() : loc.lng));
          } else
            ((lat = "function" == typeof place.lat ? place.lat() : place.lat),
              (lng = "function" == typeof place.lng ? place.lng() : place.lng));
          return isFinite(lat) && isFinite(lng) ? { lat: lat, lng: lng } : null;
        } catch (_) {
          return null;
        }
      },
      originLocation = getLocation(originPlace),
      destinationLocation = getLocation(destinationPlace);
    const isInCadizBounds = (location) => {
        if (!location) return !1;
        const lat = location.lat,
          lng = location.lng;
        return (
          lat >= CADIZ_MUNICIPALITY_BOUNDS.south &&
          lat <= CADIZ_MUNICIPALITY_BOUNDS.north &&
          lng >= CADIZ_MUNICIPALITY_BOUNDS.west &&
          lng <= CADIZ_MUNICIPALITY_BOUNDS.east
        );
      },
      originInCadizBounds = isInCadizBounds(originLocation),
      destInCadizBounds = isInCadizBounds(destinationLocation);
    const getCity = (place, text) => {
        try {
          return tcNormalizeCityName(
            ("function" == typeof tcGetLocalityFromPlace
              ? tcGetLocalityFromPlace(place)
              : "") ||
              text ||
              "",
          );
        } catch (_) {
          return tcNormalizeCityName(text || "");
        }
      },
      originCity = getCity(originPlace, originText),
      destinationCity = getCity(destinationPlace, destinationText),
      matchesForceList = (city) =>
        !!city &&
        TC_FORCE_COLORADO_DEST_CITIES.some((c) => {
          const normalizedListItem = tcNormalizeCityName(c);
          return (
            city.includes(normalizedListItem) ||
            normalizedListItem.includes(city)
          );
        }),
      matchesExcludeList = (city) =>
        !!city &&
        TC_FORCE_COLORADO_EXCLUDED_DEST_CITIES.some((c) => {
          const normalizedListItem = tcNormalizeCityName(c);
          return (
            city.includes(normalizedListItem) ||
            normalizedListItem.includes(city)
          );
        }),
      matchesConil = (city) =>
        (() => {
          if (!city) return !1;
          const normalizedCity = tcNormalizeCityName(city);
          return (
            TC_FORCE_COLORADO_CORRIDOR_CITIES.some((c) => {
              const normalizedListItem = tcNormalizeCityName(c);
              return (
                normalizedCity.includes(normalizedListItem) ||
                normalizedListItem.includes(normalizedCity)
              );
            }) ||
            CONIL_MUNICIPALITY_ZONES.some((zone) => {
              const normalizedZone = tcNormalizeCityName(zone);
              return (
                normalizedCity.includes(normalizedZone) ||
                normalizedZone.includes(normalizedCity)
              );
            })
          );
        })(),
      originLooksConil =
        matchesConil(originCity) ||
        matchesConil(tcNormalizeCityName(originText)),
      destLooksConil =
        matchesConil(destinationCity) ||
        matchesConil(tcNormalizeCityName(destinationText));
    if (!originLooksConil && !destLooksConil) return !1;
    if (matchesExcludeList(destinationCity)) return !1;
    if (matchesExcludeList(tcNormalizeCityName(destinationText))) return !1;
    if (!(originLooksConil || destLooksConil)) return !1;
    const candidateCity = destLooksConil ? originCity : destinationCity,
      candidateLocation = destLooksConil ? originLocation : destinationLocation;
    if (matchesForceList(candidateCity)) {
      return (
        !["cadiz", "cádiz"].some((c) => {
          const normalized = tcNormalizeCityName(c);
          return (
            candidateCity.includes(normalized) ||
            normalized.includes(candidateCity)
          );
        }) || isInCadizBounds(candidateLocation)
      );
    }
    return !1;
  } catch (_) {
    return !1;
  }
}
function tcShouldForceCadizWaypoint(
  originPlace,
  originText,
  destinationPlace,
  destinationText,
) {
  try {
    const getLocation = (place) => {
        try {
          if (!place) return null;
          try {
          } catch (_) {}
          let lat, lng;
          if (place.geometry && place.geometry.location) {
            const loc = place.geometry.location;
            ((lat = "function" == typeof loc.lat ? loc.lat() : loc.lat),
              (lng = "function" == typeof loc.lng ? loc.lng() : loc.lng));
          } else
            ((lat = "function" == typeof place.lat ? place.lat() : place.lat),
              (lng = "function" == typeof place.lng ? place.lng() : place.lng));
          return isFinite(lat) && isFinite(lng) ? { lat: lat, lng: lng } : null;
        } catch (_) {
          return null;
        }
      },
      originLocation = getLocation(originPlace),
      destinationLocation = getLocation(destinationPlace);
    const isInCadizBounds = (location) => {
        if (!location) return !1;
        const lat = location.lat,
          lng = location.lng;
        return (
          lat >= CADIZ_MUNICIPALITY_BOUNDS.south &&
          lat <= CADIZ_MUNICIPALITY_BOUNDS.north &&
          lng >= CADIZ_MUNICIPALITY_BOUNDS.west &&
          lng <= CADIZ_MUNICIPALITY_BOUNDS.east
        );
      },
      originInCadizBounds = isInCadizBounds(originLocation),
      destInCadizBounds = isInCadizBounds(destinationLocation);
    const getCity = (place, text) => {
        try {
          if (text && tcNormalizeCityName(text).includes("conil"))
            return tcNormalizeCityName(text);
          return tcNormalizeCityName(
            ("function" == typeof tcGetLocalityFromPlace
              ? tcGetLocalityFromPlace(place)
              : "") ||
              text ||
              "",
          );
        } catch (_) {
          return tcNormalizeCityName(text || "");
        }
      },
      originCity = getCity(originPlace, originText),
      destinationCity = getCity(destinationPlace, destinationText),
      matchesBahiaSur = (text) => {
        if (!text) return !1;
        const normalizedText = tcNormalizeCityName(text);
        return [
          "bahia sur",
          "bahía sur",
          "bahiasur",
          "bahíasur",
          "bahia station",
          "bahía station",
          "bahia train",
          "bahía train",
          "bahnhof bahia",
          "bahnhof bahía",
          "gare bahia",
          "gare bahía",
        ].some((c) => normalizedText.includes(c));
      },
      matchesChiclana = (text) => {
        if (!text) return !1;
        const normalizedText = tcNormalizeCityName(text);
        return ["chiclana", "chiclana de la frontera"].some((c) =>
          normalizedText.includes(c),
        );
      },
      matchesSanFernando = (text) => {
        if (!text) return !1;
        const normalizedText = tcNormalizeCityName(text);
        return [
          "san fernando",
          "santi petri",
          "santipetri",
          "sancti petri",
          "sanctipetri",
        ].some((c) => normalizedText.includes(c));
      },
      matchesConil = (city) => {
        if (!city) return !1;
        const normalizedCity = tcNormalizeCityName(city);
        return [
          "conil",
          "roche",
          "colorado",
          "barrio nuevo",
          "la vigia",
          "la vigía",
          "fontanilla",
          "los canos",
          "punta alegre",
          "castilnovo",
        ].some((zone) => normalizedCity.includes(zone));
      },
      originLooksCadiz = originInCadizBounds,
      destLooksCadiz = destInCadizBounds,
      originLooksConil =
        matchesConil(originCity) ||
        matchesConil(tcNormalizeCityName(originText)),
      destLooksConil =
        matchesConil(destinationCity) ||
        matchesConil(tcNormalizeCityName(destinationText)),
      destLooksBahiaSur =
        (matchesBahiaSur(originText), matchesBahiaSur(destinationText)),
      originLooksChiclana = matchesChiclana(originText),
      destLooksChiclana = matchesChiclana(destinationText),
      originLooksSanFernando = matchesSanFernando(originText),
      destLooksSanFernando = matchesSanFernando(destinationText);
    return (
      !destLooksBahiaSur &&
      !originLooksChiclana &&
      !destLooksChiclana &&
      !originLooksSanFernando &&
      !destLooksSanFernando &&
      ((originLooksConil && destLooksCadiz) ||
        (originLooksCadiz && destLooksConil))
    );
  } catch (_) {
    return !1;
  }
}
function tcToLatLngLiteral(latLngLike) {
  try {
    return latLngLike
      ? "function" == typeof latLngLike.lat &&
        "function" == typeof latLngLike.lng
        ? { lat: Number(latLngLike.lat()), lng: Number(latLngLike.lng()) }
        : "number" == typeof latLngLike.lat && "number" == typeof latLngLike.lng
          ? { lat: Number(latLngLike.lat), lng: Number(latLngLike.lng) }
          : null
      : null;
  } catch (_) {
    return null;
  }
}
function tcHaversineMeters(a, b) {
  try {
    const p1 = tcToLatLngLiteral(a),
      p2 = tcToLatLngLiteral(b);
    if (!p1 || !p2) return Number.POSITIVE_INFINITY;
    const R = 6371e3,
      toRad = (deg) => (deg * Math.PI) / 180,
      dLat = toRad(p2.lat - p1.lat),
      dLng = toRad(p2.lng - p1.lng),
      lat1 = toRad(p1.lat),
      lat2 = toRad(p2.lat),
      sinLat = Math.sin(dLat / 2),
      sinLng = Math.sin(dLng / 2),
      h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  } catch (_) {
    return Number.POSITIVE_INFINITY;
  }
}
function tcMinDistanceMetersToPoints(path, points) {
  try {
    if (!(path && path.length && points && points.length))
      return Number.POSITIVE_INFINITY;
    let min = Number.POSITIVE_INFINITY;
    for (let i = 0; i < path.length; i += 1) {
      const p = path[i];
      for (let j = 0; j < points.length; j += 1) {
        const d = tcHaversineMeters(p, points[j]);
        if ((d < min && (min = d), min <= 5)) return min;
      }
    }
    return min;
  } catch (_) {
    return Number.POSITIVE_INFINITY;
  }
}
function tcFormatDurationFromSeconds(seconds) {
  try {
    const s = Math.max(0, Math.round(Number(seconds || 0))),
      totalMinutes = Math.round(s / 60),
      hours = Math.floor(totalMinutes / 60),
      minutes = totalMinutes % 60;
    return hours > 0 && minutes > 0
      ? hours + " h " + minutes + " min"
      : hours > 0
        ? hours + " h"
        : minutes + " min";
  } catch (_) {
    return "--";
  }
}
function loadGoogleMapsIfNeeded() {
  if ("object" == typeof google && "object" == typeof google.maps) {
    googleApiLoaded = !0;
    try {
      initMap();
    } catch (_) {}
    return Promise.resolve();
  }
  try {
    "undefined" != typeof window &&
      "function" != typeof window.gm_authFailure &&
      (window.gm_authFailure = function () {
        googleApiLoaded = !1;
        try {
          const alerts = getMessagesSection("alerts");
          (console.error(
            "Google Maps authentication failure. Check API key restrictions and billing.",
          ),
            googleMapsAllowNotLoadedAlert &&
              !googleMapsNotLoadedAlertShown &&
              ((googleMapsNotLoadedAlertShown = !0),
              alert(alerts.googleMapsNotLoaded)));
        } catch (_) {}
      });
  } catch (_) {}
  return (
    googleMapsLoadingPromise ||
    ((googleMapsLoadingPromise = new Promise((resolve, reject) => {
      try {
        const existingScript = document.querySelector(
          'script[data-google-maps-loader="true"]',
        );
        if (existingScript) {
          if ("object" == typeof google && "object" == typeof google.maps) {
            googleApiLoaded = !0;
            try {
              initMap();
            } catch (_) {}
            return void resolve();
          }
          return (
            existingScript.addEventListener("load", () => {
              try {
                (initMap(), resolve());
              } catch (err) {
                reject(err);
              }
            }),
            void existingScript.addEventListener("error", reject)
          );
        }
        const script = document.createElement("script");
        let languageParam = "es";
        "en" === CURRENT_LANG
          ? (languageParam = "en")
          : "de" === CURRENT_LANG
            ? (languageParam = "de")
            : "fr" === CURRENT_LANG && (languageParam = "fr");
        const regionParam = "ES";
        ((script.src =
          "https://maps.googleapis.com/maps/api/js?key=AIzaSyB4xeZLZKnHw7BBKl_qVyPzi9bFzrXvyqE&v=weekly&libraries=places,marker&loading=async&language=" +
          encodeURIComponent(languageParam) +
          "&region=" +
          regionParam +
          "&map_ids=150019df79666595709f2472"),
          (script.async = !0),
          (script.defer = !0),
          script.setAttribute("data-google-maps-loader", "true"),
          (script.onload = () => {
            try {
              (initMap(), resolve());
            } catch (err) {
              reject(err);
            }
          }),
          (script.onerror = (err) => {
            (console.error("Google Maps API failed to load.", err),
              (googleApiLoaded = !1));
            try {
              const alerts = getMessagesSection("alerts");
              alert(alerts.googleMapsCritical);
            } catch (_) {}
            reject(err);
          }),
          document.head.appendChild(script));
      } catch (err) {
        reject(err);
      }
    })),
    googleMapsLoadingPromise)
  );
}
(document.addEventListener("DOMContentLoaded", () => {
  const alerts = getMessagesSection("alerts") || {},
    calcMsgs = getMessagesSection("calc"),
    validationMsgs = getMessagesSection("validation");
  try {
    const urlParams = new URLSearchParams(window.location.search),
      origenParam = urlParams.get("origen");
    if (origenParam) {
      if (document.getElementById("origen-calc")) {
        const decodedOrigen = decodeURIComponent(origenParam),
          applyPrefill = () => {
            const input = document.getElementById("origen-calc"),
              internalInput = document.getElementById("origen-calc-pac");
            if (!input && !internalInput) return !1;
            try {
              autocompleteSuppressNextInputInvalidation.origenCalc = !0;
            } catch (_) {}
            try {
              autocompleteLastConfirmedText.origenCalc = String(
                decodedOrigen || "",
              ).trim();
            } catch (_) {}
            try {
              autocompleteSelectedPlaces.origenCalc = null;
            } catch (_) {}
            (input &&
              ((input.value = decodedOrigen),
              input.dispatchEvent(new Event("input", { bubbles: !0 })),
              input.dispatchEvent(new Event("change", { bubbles: !0 }))),
              internalInput &&
                ((internalInput.value = decodedOrigen),
                internalInput.dispatchEvent(
                  new Event("input", { bubbles: !0 }),
                ),
                internalInput.dispatchEvent(
                  new Event("change", { bubbles: !0 }),
                )));
            try {
              setTimeout(() => {
                try {
                  autocompleteSuppressNextInputInvalidation.origenCalc = !1;
                } catch (_) {}
              }, 0);
            } catch (_) {}
            return !0;
          };
        applyPrefill() ||
          (setTimeout(applyPrefill, 120),
          setTimeout(applyPrefill, 500),
          setTimeout(applyPrefill, 1200),
          setTimeout(applyPrefill, 2200));
        
        // Buscar el lugar en Google Places para obtener el place_id
        const searchPlaceForWaypoint = async () => {
          if (!googleApiLoaded || !google.maps.places) {
            setTimeout(searchPlaceForWaypoint, 500);
            return;
          }
          try {
            const service = new google.maps.places.PlacesService(document.createElement('div'));
            service.textSearch({
              query: decodedOrigen,
              fields: ['place_id', 'name', 'geometry', 'formatted_address']
            }, (results, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                try {
                  autocompleteSelectedPlaces.origenCalc = {
                    place_id: results[0].place_id,
                    name: results[0].name,
                    formatted_address: results[0].formatted_address,
                    geometry: results[0].geometry
                  };
                  console.log('[Landing Prefill] Place found for origin:', decodedOrigen, autocompleteSelectedPlaces.origenCalc);
                } catch (_) {}
              }
            });
          } catch (_) {}
        };
        setTimeout(searchPlaceForWaypoint, 1000);
      }
    }
    const destinoParam = urlParams.get("destino");
    if (destinoParam) {
      if (document.getElementById("destino-calc")) {
        const decodedDestino = decodeURIComponent(destinoParam),
          applyDestinoPrefill = () => {
            const input = document.getElementById("destino-calc"),
              internalInput = document.getElementById("destino-calc-pac");
            if (!input && !internalInput) return !1;
            try {
              autocompleteSuppressNextInputInvalidation.destinoCalc = !0;
            } catch (_) {}
            try {
              autocompleteLastConfirmedText.destinoCalc = String(
                decodedDestino || "",
              ).trim();
            } catch (_) {}
            try {
              autocompleteSelectedPlaces.destinoCalc = null;
            } catch (_) {}
            (input &&
              ((input.value = decodedDestino),
              input.dispatchEvent(new Event("input", { bubbles: !0 })),
              input.dispatchEvent(new Event("change", { bubbles: !0 }))),
              internalInput &&
                ((internalInput.value = decodedDestino),
                internalInput.dispatchEvent(
                  new Event("input", { bubbles: !0 }),
                ),
                internalInput.dispatchEvent(
                  new Event("change", { bubbles: !0 }),
                )));
            try {
              setTimeout(() => {
                try {
                  autocompleteSuppressNextInputInvalidation.destinoCalc = !1;
                } catch (_) {}
              }, 0);
            } catch (_) {}
            return !0;
          };
        applyDestinoPrefill() ||
          (setTimeout(applyDestinoPrefill, 120),
          setTimeout(applyDestinoPrefill, 500),
          setTimeout(applyDestinoPrefill, 1200),
          setTimeout(applyDestinoPrefill, 2200));
        
        // Buscar el lugar en Google Places para obtener el place_id
        const searchDestinoPlaceForWaypoint = async () => {
          if (!googleApiLoaded || !google.maps.places) {
            setTimeout(searchDestinoPlaceForWaypoint, 500);
            return;
          }
          try {
            const service = new google.maps.places.PlacesService(document.createElement('div'));
            service.textSearch({
              query: decodedDestino,
              fields: ['place_id', 'name', 'geometry', 'formatted_address']
            }, (results, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                try {
                  autocompleteSelectedPlaces.destinoCalc = {
                    place_id: results[0].place_id,
                    name: results[0].name,
                    formatted_address: results[0].formatted_address,
                    geometry: results[0].geometry
                  };
                  console.log('[Landing Prefill] Place found for destination:', decodedDestino, autocompleteSelectedPlaces.destinoCalc);
                } catch (_) {}
              }
            });
          } catch (_) {}
        };
        setTimeout(searchDestinoPlaceForWaypoint, 1000);
      }
    }
  } catch (_) {}
  try {
    const airportLandingSection = document.getElementById(
        "traslados-aeropuertos",
      ),
      airportTransferEls = Array.from(
        document.querySelectorAll(
          "[data-airport-transfer][data-origin][data-destination]",
        ),
      ),
      computeSurcharge = (distanceKm) => {
        let surcharge = 0;
        return (distanceKm > 400 && (surcharge = 5), surcharge);
      },
      computeApproxPriceForRate = (distanceKm, ratePerKm) => {
        const raw =
          distanceKm * ratePerKm + FLAG_FALL + computeSurcharge(distanceKm);
        return raw < 45 ? 45 : raw;
      },
      safeFormatPrice = (amount) => {
        try {
          const locale = LOCALES[CURRENT_LANG] || LOCALES.es || "es-ES";
          return Number(amount || 0).toLocaleString(locale, {
            style: "currency",
            currency: "EUR",
          });
        } catch (_) {
          return String(amount);
        }
      },
      safeFormatDurationFromSeconds = (seconds) => {
        try {
          const s = Math.max(0, Number(seconds || 0)),
            totalMinutes = Math.round(s / 60),
            hours = Math.floor(totalMinutes / 60),
            minutes = totalMinutes % 60;
          return hours <= 0
            ? minutes + " min"
            : minutes <= 0
              ? hours + " h"
              : hours + " h " + minutes + " min";
        } catch (_) {
          return "--";
        }
      },
      renderAirportTransfer = (cardEl, distanceKm, durationText) => {
        const distanceEls = Array.from(
            cardEl.querySelectorAll("[data-airport-distance]"),
          ),
          durationEls = Array.from(
            cardEl.querySelectorAll("[data-airport-duration]"),
          ),
          weekdayEls = Array.from(
            cardEl.querySelectorAll("[data-airport-price-weekday]"),
          ),
          weekendNightEls = Array.from(
            cardEl.querySelectorAll("[data-airport-price-weekend-night]"),
          );
        if (!isFinite(distanceKm) || distanceKm <= 0)
          return (
            distanceEls.forEach((el) => {
              el.textContent = "--";
            }),
            durationEls.forEach((el) => {
              el.textContent = "--";
            }),
            weekdayEls.forEach((el) => {
              el.textContent = "--";
            }),
            void weekendNightEls.forEach((el) => {
              el.textContent = "--";
            })
          );
        const distanceText = distanceKm.toFixed(0) + " km",
          durationSafe = durationText || "--";
        (distanceEls.forEach((el) => {
          el.textContent = distanceText;
        }),
          durationEls.forEach((el) => {
            el.textContent = durationSafe;
          }));
        const pWeekday = computeApproxPriceForRate(distanceKm, RATE_WEEKDAY),
          pWeekendNight = computeApproxPriceForRate(distanceKm, RATE_WEEKEND_NIGHT),
          weekdayText = safeFormatPrice(pWeekday),
          weekendNightText = safeFormatPrice(pWeekendNight);
        (weekdayEls.forEach((el) => {
          el.textContent = weekdayText;
        }),
          weekendNightEls.forEach((el) => {
            el.textContent = weekendNightText;
          }));
      },
      renderFallbackForAll = () => {
        airportTransferEls.forEach((cardEl) => {
          const fallbackKmRaw = cardEl.getAttribute("data-fallback-km"),
            fallbackKm = parseFloat(fallbackKmRaw);
          if (!isFinite(fallbackKm) || fallbackKm <= 0)
            return void renderAirportTransfer(cardEl, 0, "--");
          renderAirportTransfer(
            cardEl,
            fallbackKm,
            safeFormatDurationFromSeconds((fallbackKm / 90) * 3600),
          );
        });
      },
      calculateAirportLandingRoutes = async () => {
        if (!airportTransferEls.length) return;
        try {
          await loadGoogleMapsIfNeeded();
        } catch (_) {
          return void renderFallbackForAll();
        }
        if (
          !googleApiLoaded ||
          !window.google ||
          !google.maps ||
          void 0 === google.maps.DirectionsService
        )
          return void renderFallbackForAll();
        const directionsService = new google.maps.DirectionsService();
        await Promise.all(
          airportTransferEls.map(async (cardEl) => {
            const origin = cardEl.getAttribute("data-origin") || "",
              destination = cardEl.getAttribute("data-destination") || "",
              fallbackKmRaw = cardEl.getAttribute("data-fallback-km"),
              fallbackKm = parseFloat(fallbackKmRaw);
            if (!origin || !destination) {
              if (isFinite(fallbackKm) && fallbackKm > 0) {
                renderAirportTransfer(
                  cardEl,
                  fallbackKm,
                  safeFormatDurationFromSeconds((fallbackKm / 90) * 3600),
                );
              } else renderAirportTransfer(cardEl, 0, "--");
              return Promise.resolve();
            }
            const cacheKey = buildDirectionsRouteCacheKey(origin, destination),
              cached = cacheKey ? getDirectionsRouteCache(cacheKey) : null;
            if (
              cached &&
              cached.routes &&
              cached.routes[0] &&
              cached.routes[0].legs &&
              cached.routes[0].legs[0]
            ) {
              const leg0 = cached.routes[0].legs[0];
              let distanceKm =
                leg0.distance && leg0.distance.value
                  ? leg0.distance.value / 1e3
                  : fallbackKm;
              const durationText =
                  leg0.duration && leg0.duration.text
                    ? leg0.duration.text
                    : "--",
                startLoc = leg0.start_location,
                endLoc = leg0.end_location,
                overviewPath = cached.routes[0].overview_path || [];
              try {
                const pickupDistanceFromCenterM = tcHaversineMeters(
                    CONIL_CENTER_POINT,
                    startLoc,
                  ),
                  pickupOutside =
                    isFinite(pickupDistanceFromCenterM) &&
                    pickupDistanceFromCenterM > 2500,
                  looksConilByTextOrPlace = (text, location) => {
                    try {
                      if (text) {
                        const normalizedText = tcNormalizeCityName(text);
                        if (
                          normalizedText.includes("santi petri") ||
                          normalizedText.includes("santipetri") ||
                          normalizedText.includes("sancti petri") ||
                          normalizedText.includes("sanctipetri")
                        )
                          return !1;
                      }
                      if (location && "function" == typeof tcHaversineMeters) {
                        const lat =
                            "function" == typeof location.lat
                              ? location.lat()
                              : location.lat,
                          lng =
                            "function" == typeof location.lng
                              ? location.lng()
                              : location.lng;
                        if (isFinite(lat) && isFinite(lng)) {
                          if (
                            lat >= CONIL_MUNICIPALITY_BOUNDS.south &&
                            lat <= CONIL_MUNICIPALITY_BOUNDS.north &&
                            lng >= CONIL_MUNICIPALITY_BOUNDS.west &&
                            lng <= CONIL_MUNICIPALITY_BOUNDS.east
                          )
                            return !0;
                        }
                      }
                      const norm = tcNormalizeCityName(text || "");
                      if (norm.includes("conil")) return !0;
                      if (text && text.includes("11140")) return !0;
                      if (
                        text &&
                        text.toLowerCase().includes("conil de la frontera")
                      )
                        return !0;
                      const textLower = (text || "").toLowerCase();
                      for (const zone of CONIL_MUNICIPALITY_ZONES)
                        if (textLower.includes(zone)) return !0;
                      if (location && "function" == typeof tcHaversineMeters) {
                        const distanceFromCenterM = tcHaversineMeters(
                          CONIL_CENTER_POINT,
                          location,
                        );
                        if (
                          isFinite(distanceFromCenterM) &&
                          distanceFromCenterM <= 2500
                        )
                          return !0;
                      }
                      return !1;
                    } catch (_) {
                      return !1;
                    }
                  },
                  originIsConilMunicipality = looksConilByTextOrPlace(
                    leg0.start_address || origin,
                    startLoc,
                  ),
                  destinationIsConilMunicipality = looksConilByTextOrPlace(
                    leg0.end_address || destination,
                    endLoc,
                  );
                if (overviewPath && overviewPath.length) {
                  const distToCenterM = tcMinDistanceMetersToPoints(
                      overviewPath,
                      [CONIL_CENTER_POINT],
                    ),
                    passesNearCenter =
                      isFinite(distToCenterM) && distToCenterM <= 2500,
                    passesReturnCorridor = overviewPath.some((point) =>
                      isInReturnCorridorBounds(point),
                    ),
                    destinationDistanceFromCenterM = tcHaversineMeters(
                      CONIL_CENTER_POINT,
                      endLoc,
                    ),
                    destinationIsNearConil =
                      isFinite(destinationDistanceFromCenterM) &&
                      destinationDistanceFromCenterM <= 2500,
                    originLat =
                      "function" == typeof startLoc.lat
                        ? startLoc.lat()
                        : startLoc.lat,
                    originLng =
                      "function" == typeof startLoc.lng
                        ? startLoc.lng()
                        : startLoc.lng;
                  if (
                    !originIsConilMunicipality &&
                    destinationIsConilMunicipality &&
                    !destinationIsNearConil &&
                    !passesNearCenter &&
                    !passesReturnCorridor &&
                    (originLat > CONIL_CENTER_POINT.lat ||
                      originLng > CONIL_CENTER_POINT.lng)
                  ) {
                    const extraResp = await requestDirections({
                        origin: CONIL_CENTER_ADDRESS,
                        destination: destination,
                        travelMode: google.maps.TravelMode.DRIVING,
                      }),
                      extraRoute =
                        extraResp &&
                        extraResp.resp &&
                        extraResp.resp.routes &&
                        extraResp.resp.routes[0]
                          ? extraResp.resp.routes[0]
                          : null,
                      extraLeg0 =
                        extraRoute && extraRoute.legs && extraRoute.legs[0]
                          ? extraRoute.legs[0]
                          : null,
                      extraDistanceKm =
                        extraLeg0 &&
                        extraLeg0.distance &&
                        extraLeg0.distance.value
                          ? Number(extraLeg0.distance.value) / 1e3
                          : 0;
                    isFinite(extraDistanceKm) &&
                      extraDistanceKm > 0 &&
                      (distanceKm += extraDistanceKm);
                  }
                  if (
                    originIsConilMunicipality &&
                    pickupOutside &&
                    !destinationIsConilMunicipality &&
                    (pickupDistanceFromCenterM > 3500 ||
                      (!passesNearCenter && !passesReturnCorridor))
                  ) {
                    const extraResp = await requestDirections({
                        origin: CONIL_CENTER_ADDRESS,
                        destination: origin,
                        travelMode: google.maps.TravelMode.DRIVING,
                      }),
                      extraRoute =
                        extraResp &&
                        extraResp.resp &&
                        extraResp.resp.routes &&
                        extraResp.resp.routes[0]
                          ? extraResp.resp.routes[0]
                          : null,
                      extraLeg0 =
                        extraRoute && extraRoute.legs && extraRoute.legs[0]
                          ? extraRoute.legs[0]
                          : null,
                      extraDistanceKm =
                        extraLeg0 &&
                        extraLeg0.distance &&
                        extraLeg0.distance.value
                          ? Number(extraLeg0.distance.value) / 1e3
                          : 0;
                    isFinite(extraDistanceKm) &&
                      extraDistanceKm > 0 &&
                      (distanceKm += extraDistanceKm);
                  }
                }
              } catch (_) {}
              if (isFinite(distanceKm) && distanceKm > 0)
                renderAirportTransfer(cardEl, distanceKm, durationText);
              else if (isFinite(fallbackKm) && fallbackKm > 0) {
                renderAirportTransfer(
                  cardEl,
                  fallbackKm,
                  safeFormatDurationFromSeconds((fallbackKm / 90) * 3600),
                );
              } else renderAirportTransfer(cardEl, 0, "--");
              return Promise.resolve();
            }
            return new Promise((resolve) => {
              directionsService.route(
                {
                  origin: origin,
                  destination: destination,
                  travelMode: google.maps.TravelMode.DRIVING,
                  provideRouteAlternatives: !1,
                },
                async (response, status) => {
                  try {
                    if (
                      status === google.maps.DirectionsStatus.OK &&
                      response &&
                      response.routes &&
                      response.routes.length > 0
                    ) {
                      const selectedRoute = selectBestRoute(response.routes);
                      if (
                        selectedRoute &&
                        selectedRoute.legs &&
                        selectedRoute.legs[0]
                      ) {
                        const r0 = selectedRoute,
                          leg0 = r0.legs[0];
                        try {
                          if (cacheKey) {
                            const minimalResponse = {
                              routes: [
                                {
                                  overview_path: r0.overview_path || null,
                                  legs: [
                                    {
                                      distance: leg0.distance,
                                      duration: leg0.duration,
                                      start_address: leg0.start_address,
                                      end_address: leg0.end_address,
                                      start_location: leg0.start_location,
                                      end_location: leg0.end_location,
                                    },
                                  ],
                                },
                              ],
                            };
                            setDirectionsRouteCache(cacheKey, minimalResponse);
                          }
                        } catch (_) {}
                        let distanceKm = leg0.distance.value / 1e3;
                        const durationText = leg0.duration.text,
                          startLoc = leg0.start_location,
                          endLoc = leg0.end_location,
                          overviewPath = r0.overview_path || [];
                        try {
                          const pickupDistanceFromCenterM = tcHaversineMeters(
                              CONIL_CENTER_POINT,
                              startLoc,
                            ),
                            pickupOutside =
                              isFinite(pickupDistanceFromCenterM) &&
                              pickupDistanceFromCenterM > 2500,
                            looksConilByTextOrPlace = (text, location) => {
                              try {
                                if (text) {
                                  const normalizedText =
                                    tcNormalizeCityName(text);
                                  if (
                                    normalizedText.includes("santi petri") ||
                                    normalizedText.includes("santipetri") ||
                                    normalizedText.includes("sancti petri") ||
                                    normalizedText.includes("sanctipetri")
                                  )
                                    return !1;
                                }
                                if (
                                  location &&
                                  "function" == typeof tcHaversineMeters
                                ) {
                                  const lat =
                                      "function" == typeof location.lat
                                        ? location.lat()
                                        : location.lat,
                                    lng =
                                      "function" == typeof location.lng
                                        ? location.lng()
                                        : location.lng;
                                  if (isFinite(lat) && isFinite(lng)) {
                                    if (
                                      lat >= CONIL_MUNICIPALITY_BOUNDS.south &&
                                      lat <= CONIL_MUNICIPALITY_BOUNDS.north &&
                                      lng >= CONIL_MUNICIPALITY_BOUNDS.west &&
                                      lng <= CONIL_MUNICIPALITY_BOUNDS.east
                                    )
                                      return !0;
                                  }
                                }
                                const norm = tcNormalizeCityName(text || "");
                                if (norm.includes("conil")) return !0;
                                if (text && text.includes("11140")) return !0;
                                if (
                                  text &&
                                  text
                                    .toLowerCase()
                                    .includes("conil de la frontera")
                                )
                                  return !0;
                                const textLower = (text || "").toLowerCase();
                                for (const zone of CONIL_MUNICIPALITY_ZONES)
                                  if (textLower.includes(zone)) return !0;
                                if (
                                  location &&
                                  "function" == typeof tcHaversineMeters
                                ) {
                                  const distanceFromCenterM = tcHaversineMeters(
                                    CONIL_CENTER_POINT,
                                    location,
                                  );
                                  if (
                                    isFinite(distanceFromCenterM) &&
                                    distanceFromCenterM <= 2500
                                  )
                                    return !0;
                                }
                                return !1;
                              } catch (_) {
                                return !1;
                              }
                            },
                            originIsConilMunicipality = looksConilByTextOrPlace(
                              leg0.start_address || origin,
                              startLoc,
                            ),
                            destinationIsConilMunicipality =
                              looksConilByTextOrPlace(
                                leg0.end_address || destination,
                                endLoc,
                              );
                          if (overviewPath && overviewPath.length) {
                            const distToCenterM = tcMinDistanceMetersToPoints(
                                overviewPath,
                                [CONIL_CENTER_POINT],
                              ),
                              passesNearCenter =
                                isFinite(distToCenterM) &&
                                distToCenterM <= 2500,
                              passesReturnCorridor = overviewPath.some(
                                (point) => isInReturnCorridorBounds(point),
                              ),
                              destinationDistanceFromCenterM =
                                tcHaversineMeters(CONIL_CENTER_POINT, endLoc),
                              destinationIsNearConil =
                                isFinite(destinationDistanceFromCenterM) &&
                                destinationDistanceFromCenterM <= 2500,
                              originLat =
                                "function" == typeof startLoc.lat
                                  ? startLoc.lat()
                                  : startLoc.lat,
                              originLng =
                                "function" == typeof startLoc.lng
                                  ? startLoc.lng()
                                  : startLoc.lng;
                            if (
                              !originIsConilMunicipality &&
                              destinationIsConilMunicipality &&
                              !destinationIsNearConil &&
                              !passesNearCenter &&
                              !passesReturnCorridor &&
                              (originLat > CONIL_CENTER_POINT.lat ||
                                originLng > CONIL_CENTER_POINT.lng)
                            ) {
                              const extraResp = await requestDirections({
                                  origin: CONIL_CENTER_ADDRESS,
                                  destination: destination,
                                  travelMode: google.maps.TravelMode.DRIVING,
                                }),
                                extraRoute =
                                  extraResp &&
                                  extraResp.resp &&
                                  extraResp.resp.routes &&
                                  extraResp.resp.routes[0]
                                    ? extraResp.resp.routes[0]
                                    : null,
                                extraLeg0 =
                                  extraRoute &&
                                  extraRoute.legs &&
                                  extraRoute.legs[0]
                                    ? extraRoute.legs[0]
                                    : null,
                                extraDistanceKm =
                                  extraLeg0 &&
                                  extraLeg0.distance &&
                                  extraLeg0.distance.value
                                    ? Number(extraLeg0.distance.value) / 1e3
                                    : 0;
                              isFinite(extraDistanceKm) &&
                                extraDistanceKm > 0 &&
                                (distanceKm += extraDistanceKm);
                            }
                            if (
                              originIsConilMunicipality &&
                              pickupOutside &&
                              !destinationIsConilMunicipality &&
                              (pickupDistanceFromCenterM > 3500 ||
                                (!passesNearCenter && !passesReturnCorridor))
                            ) {
                              const extraResp = await requestDirections({
                                  origin: CONIL_CENTER_ADDRESS,
                                  destination: origin,
                                  travelMode: google.maps.TravelMode.DRIVING,
                                }),
                                extraRoute =
                                  extraResp &&
                                  extraResp.resp &&
                                  extraResp.resp.routes &&
                                  extraResp.resp.routes[0]
                                    ? extraResp.resp.routes[0]
                                    : null,
                                extraLeg0 =
                                  extraRoute &&
                                  extraRoute.legs &&
                                  extraRoute.legs[0]
                                    ? extraRoute.legs[0]
                                    : null,
                                extraDistanceKm =
                                  extraLeg0 &&
                                  extraLeg0.distance &&
                                  extraLeg0.distance.value
                                    ? Number(extraLeg0.distance.value) / 1e3
                                    : 0;
                              isFinite(extraDistanceKm) &&
                                extraDistanceKm > 0 &&
                                (distanceKm += extraDistanceKm);
                            }
                          }
                        } catch (_) {}
                        renderAirportTransfer(cardEl, distanceKm, durationText);
                      } else if (isFinite(fallbackKm) && fallbackKm > 0) {
                        renderAirportTransfer(
                          cardEl,
                          fallbackKm,
                          safeFormatDurationFromSeconds(
                            (fallbackKm / 90) * 3600,
                          ),
                        );
                      } else renderAirportTransfer(cardEl, 0, "--");
                    } else if (isFinite(fallbackKm) && fallbackKm > 0) {
                      renderAirportTransfer(
                        cardEl,
                        fallbackKm,
                        safeFormatDurationFromSeconds((fallbackKm / 90) * 3600),
                      );
                    } else renderAirportTransfer(cardEl, 0, "--");
                    resolve();
                  } catch (_) {
                    if (isFinite(fallbackKm) && fallbackKm > 0) {
                      renderAirportTransfer(
                        cardEl,
                        fallbackKm,
                        safeFormatDurationFromSeconds((fallbackKm / 90) * 3600),
                      );
                    } else renderAirportTransfer(cardEl, 0, "--");
                    resolve();
                  }
                },
              );
            });
          }),
        );
      };
    if (airportTransferEls.length) {
      try {
        renderFallbackForAll();
      } catch (_) {}
      if (airportLandingSection && "IntersectionObserver" in window) {
        new IntersectionObserver(
          (entries, obs) => {
            entries.forEach((entry) => {
              entry.isIntersecting &&
                (obs.unobserve(entry.target),
                calculateAirportLandingRoutes().catch(() => {
                  renderFallbackForAll();
                }));
            });
          },
          { rootMargin: "200px 0px", threshold: 0.1 },
        ).observe(airportLandingSection);
      } else
        calculateAirportLandingRoutes().catch(() => {
          renderFallbackForAll();
        });
    }
  } catch (_) {}
  const confirmMsgs = getMessagesSection("confirmation") || {},
    bookingMsgs = getMessagesSection("booking") || {
      sending: "Enviando…",
      confirmButton: "Confirmar solicitud de reserva",
      bookingSentTitle: "Solicitud enviada",
      formError:
        "Ha ocurrido un error al enviar la reserva. Inténtelo de nuevo.",
      emailJsError:
        "No se ha podido enviar el correo en este momento. Inténtelo de nuevo.",
    };
  (tcRunWhenIdle(() => {
    try {
      tcTrackEvent("pagina_vista");
    } catch (_) {}
  }, 2e3),
    tcRunWhenIdle(() => {
      try {
        setupPacItemIconsObserver();
      } catch (_) {}
    }, 2500));
  try {
    const bookingSectionLazy = document.getElementById("formulario-reserva");
    if (bookingSectionLazy && "IntersectionObserver" in window) {
      new IntersectionObserver(
        (entries, observer) => {
          entries.forEach((entry) => {
            entry.isIntersecting &&
              (observer.unobserve(entry.target),
              loadEmailJsIfNeeded().catch(() => {}));
          });
        },
        { rootMargin: "200px 0px", threshold: 0.15 },
      ).observe(bookingSectionLazy);
    }
  } catch (_) {}
  const calcForm = document.getElementById("price-calculator-form"),
    origenCalcInput = document.getElementById("origen-calc"),
    destinoCalcInput = document.getElementById("destino-calc"),
    fechaCalcInput = document.getElementById("fecha-calc"),
    horaCalcInput = document.getElementById("hora-calc"),
    calcResultDiv = document.getElementById("calculation-result"),
    bookingFormSection =
      (document.getElementById("one-way-included-success"),
      document.getElementById("formulario-reserva")),
    bookingFormWrapper = document.getElementById("booking-form-wrapper"),
    bookingForm = document.getElementById("booking-form"),
    bookingSectionTitle = document.getElementById("booking-section-title"),
    origenBookInput = document.getElementById("origen-book"),
    destinoBookInput = document.getElementById("destino-book"),
    fechaBookInput = document.getElementById("fecha-book"),
    horaBookInput = document.getElementById("hora-book"),
    showConfirmationOverlayBtn = document.getElementById(
      "show-confirmation-overlay-btn",
    ),
    finalBookBtn = document.getElementById("final-book-btn"),
    cancelConfirmationBtn = document.getElementById("cancel-confirmation-btn"),
    bookingConfirmationOverlay = document.getElementById(
      "booking-confirmation-overlay",
    ),
    bookingSuccessMessage = document.getElementById("booking-success-message"),
    formErrorMessage = document.getElementById("form-error-message"),
    backToHomeBtn = document.getElementById("back-to-home-btn"),
    returnTripYes = document.getElementById("return-trip-yes"),
    returnTripNo = document.getElementById("return-trip-no"),
    returnDetailsDiv = document.getElementById("return-details"),
    origenVueltaInput = document.getElementById("origen-vuelta-calc"),
    destinoVueltaInput = document.getElementById("destino-vuelta-calc"),
    returnDateInput = document.getElementById("return-date"),
    returnTimeInput = document.getElementById("return-time"),
    calculateReturnPriceBtn = document.getElementById(
      "calculate-return-price-btn",
    ),
    returnCalcResultDiv = document.getElementById("return-calculation-result"),
    additionalTripsSection = document.getElementById(
      "additional-trips-section",
    ),
    addAdditionalTripBtnWrapper = document.getElementById(
      "add-additional-trip-btn-wrapper",
    ),
    addAdditionalTripBtn = document.getElementById("add-additional-trip-btn"),
    additionalTripForm = document.getElementById("additional-trip-form"),
    additionalTripOrigenInput = document.getElementById(
      "additional-trip-origen",
    ),
    additionalTripDestinoInput = document.getElementById(
      "additional-trip-destino",
    ),
    additionalTripFechaInput = document.getElementById("additional-trip-fecha"),
    additionalTripHoraInput = document.getElementById("additional-trip-hora"),
    calculateAdditionalTripBtn = document.getElementById(
      "calculate-additional-trip-btn",
    ),
    additionalTripCalcResultDiv = document.getElementById(
      "additional-trip-calculation-result",
    ),
    additionalTripsList = document.getElementById("additional-trips-list");
  let addAdditionalTripBtnOriginalParent = null,
    addAdditionalTripBtnOriginalNextSibling = null;
  addAdditionalTripBtn &&
    returnCalcResultDiv &&
    ((addAdditionalTripBtnOriginalParent = returnCalcResultDiv.parentElement),
    (addAdditionalTripBtnOriginalNextSibling =
      returnCalcResultDiv.nextElementSibling));
  let additionalTripFormOriginalParent = null,
    additionalTripFormOriginalNextSibling = null;
  additionalTripForm &&
    ((additionalTripFormOriginalParent = additionalTripForm.parentElement),
    (additionalTripFormOriginalNextSibling =
      additionalTripForm.nextElementSibling));
  const needsSRIYes = document.getElementById("needs-sri-yes"),
    needsSRINo = document.getElementById("needs-sri-no"),
    childSeatQuestionsDiv = document.getElementById("child-seat-questions"),
    babySeatsSelect = document.getElementById("baby-seats"),
    childSeatsSelect = document.getElementById("child-seats"),
    babySeatAgeQuestionDiv = document.getElementById("baby-seat-age-question");
  let totalAmountDisplay = document.getElementById("total-amount-display"),
    totalPriceSection = document.querySelector(".total-price-section");
  window.additionalTrips = [],
    additionalTripCounter = 0,
    currentAdditionalTripData = null;
  function displayAdditionalTripResult(
    distance,
    duration,
    price,
    route,
    isMinPrice = !1,
  ) {
    if (!additionalTripCalcResultDiv) return;
    const msgs = getMessagesSection("calc"),
      cancelLabel = msgs.cancelReturnButton || "Cancelar",
      confirmLabel = msgs.confirmReturnButton || "Incluir trayecto";
    if (isMinPrice)
      return void (function (minPrice, distance, duration, route) {
        if (!additionalTripCalcResultDiv) return;
        const formattedMinPrice = formatPrice(minPrice),
          msgs = getMessagesSection("calc");
        function onClick(e) {
          if (e.target && "additional-min-accept-btn" === e.target.id) {
            if (
              (new Date(
                `${additionalTripFechaInput.value}T${additionalTripHoraInput.value}`,
              ).getTime() -
                new Date().getTime()) /
                36e5 <
              12
            )
              return void showAdditionalMinLeadTimeNotice();
            ((currentAdditionalTripData = {
              distance: distance,
              duration: duration,
              price: minPrice,
              route: route,
              origin: additionalTripOrigenInput.value,
              destination: additionalTripDestinoInput.value,
              date: additionalTripFechaInput.value,
              time: additionalTripHoraInput.value,
              overview_path: currentAdditionalRouteOverviewPath,
              start_location: currentAdditionalRouteStartLocation,
              end_location: currentAdditionalRouteEndLocation,
            }),
              displayAdditionalTripResult(
                distance,
                duration,
                minPrice,
                route,
                !1,
              ));
          }
          e.target &&
            "additional-min-cancel-btn" === e.target.id &&
            (hideElement(additionalTripCalcResultDiv),
            showElement(additionalTripForm));
        }
        ((additionalTripCalcResultDiv.innerHTML = `\n      <div class="min-price-notice min-price-notice--return">\n        <p>${msgs.minPriceIntro}</p>\n        <p>${msgs.minPriceLine(formattedMinPrice)}</p>\n        <p class="min-price-note" style="font-size: 0.9rem; color: #ccc; font-style: italic; text-align: center; border: none;">${msgs.minPriceNote}</p>\n        <div class="min-price-buttons">\n          <button type="button" id="additional-min-accept-btn" class="btn btn-primary">${msgs.confirmReturnButton}</button>\n          <button type="button" id="additional-min-cancel-btn" class="btn btn-light">${msgs.returnCancelButton}</button>\n        </div>\n      </div>\n    `),
          showElement(additionalTripCalcResultDiv),
          additionalTripCalcResultDiv.addEventListener("click", onClick));
      })(price, distance, duration, route);
    if (
      ((currentAdditionalRouteOverviewPath =
        route && route.overview_path ? route.overview_path : null),
      (currentAdditionalRouteStartLocation =
        route && route.legs && route.legs[0] && route.legs[0].start_location
          ? route.legs[0].start_location
          : null),
      (currentAdditionalRouteEndLocation =
        route && route.legs && route.legs[0] && route.legs[0].end_location
          ? route.legs[0].end_location
          : null),
      (currentAdditionalRouteBounds = null),
      currentAdditionalRouteOverviewPath &&
        currentAdditionalRouteOverviewPath.length)
    )
      try {
        const bounds = new google.maps.LatLngBounds();
        (currentAdditionalRouteOverviewPath.forEach((p) => bounds.extend(p)),
          (currentAdditionalRouteBounds = bounds));
      } catch (_) {}
    currentAdditionalTripData = {
      distance: distance,
      duration: duration,
      price: price,
      route: route,
      origin: additionalTripOrigenInput.value,
      destination: additionalTripDestinoInput.value,
      date: additionalTripFechaInput.value,
      time: additionalTripHoraInput.value,
      overview_path: currentAdditionalRouteOverviewPath,
      start_location: currentAdditionalRouteStartLocation,
      end_location: currentAdditionalRouteEndLocation,
    };
    const additionalRouteMapInfoHtml =
      "function" == typeof isHandheldMobileDevice && isHandheldMobileDevice()
        ? ""
        : `\n        <div class="route-map-info">\n          <div class="route-map-chip">\n            <span class="route-map-chip-main">${distance.toFixed(1)} km · ${duration}</span>\n          </div>\n        </div>\n      `;
    ((additionalTripCalcResultDiv.innerHTML = `\n      <div class="result-details">\n        <div class="detail-item">${msgs.returnDistanceLabel}: <strong>${distance.toFixed(1)} km</strong></div>\n        <div class="detail-item">${msgs.returnDurationLabel}: <strong>${duration}</strong></div>\n      </div>\n      <p>${msgs.returnTotalPriceIntro}</p>\n      <p class="final-price">${formatPrice(price)}</p>\n      <div class="route-map-toggle-wrapper route-map-toggle-wrapper--return">\n        <button type="button" id="toggle-additional-route-map-btn" class="btn route-map-toggle-btn" aria-expanded="false" aria-controls="additional-route-map-container">\n          ${msgs.viewRouteButton} <span class="route-toggle-icon">&#9662;</span>\n        </button>\n      </div>\n      <div id="additional-route-map-container" class="route-map-container" aria-hidden="true">\n        ${additionalRouteMapInfoHtml}\n        <div id="additional-route-map" class="route-map" role="img" aria-label="${distance.toFixed(1)} km, ${duration}"></div>\n      </div>\n      <div class="calculation-buttons calculation-buttons--return">\n        <button type="button" id="cancel-additional-trip-btn" class="btn btn-light">${cancelLabel}</button>\n        <button type="button" id="confirm-additional-trip-btn" class="btn btn-primary">${confirmLabel}</button>\n        <div id="additional-included-success" class="return-included-success" aria-live="polite" style="display:none;"></div>\n      </div>\n    `),
      showElement(additionalTripCalcResultDiv));
    try {
      if (
        googleApiLoaded &&
        "undefined" != typeof google &&
        google.maps &&
        void 0 !== google.maps.Map
      ) {
        const routeMapElement = document.getElementById("additional-route-map");
        if (
          routeMapElement &&
          currentAdditionalRouteOverviewPath &&
          currentAdditionalRouteOverviewPath.length
        ) {
          const initialCenter =
            currentAdditionalRouteOverviewPath[0] ||
            currentAdditionalRouteStartLocation;
          initialCenter &&
            (additionalRouteMapInstance
              ? (additionalRouteMapInstance.setCenter(initialCenter),
                additionalRouteMapInstance.setZoom(11))
              : (additionalRouteMapInstance = new google.maps.Map(
                  routeMapElement,
                  {
                    center: initialCenter,
                    zoom: 11,
                    disableDefaultUI: !0,
                    clickableIcons: !1,
                    keyboardShortcuts: !1,
                    gestureHandling: "greedy",
                    mapId: TC_GOOGLE_MAP_ID,
                  },
                )));
        }
      }
    } catch (_) {}
    try {
      additionalTripCalcResultDiv &&
        "function" == typeof additionalTripCalcResultDiv.scrollIntoView &&
        additionalTripCalcResultDiv.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    } catch (_) {}
    const toggleBtn = document.getElementById(
        "toggle-additional-route-map-btn",
      ),
      mapContainer = document.getElementById("additional-route-map-container"),
      confirmBtn = document.getElementById("confirm-additional-trip-btn"),
      cancelBtn = document.getElementById("cancel-additional-trip-btn");
    document.getElementById("additional-included-success");
    let originLabelOverlay = null,
      destinationLabelOverlay = null;
    (toggleBtn &&
      toggleBtn.addEventListener("click", async function () {
        if (
          (toggleBtn &&
            (toggleBtn.classList.add("route-toggle-animating"),
            setTimeout(() => {
              toggleBtn.classList.remove("route-toggle-animating");
            }, 800)),
          !mapContainer)
        )
          return;
        const isExpanded = "true" === toggleBtn.getAttribute("aria-expanded");
        if (
          (toggleBtn.setAttribute("aria-expanded", !isExpanded),
          mapContainer.setAttribute("aria-hidden", isExpanded),
          isExpanded)
        ) {
          const currentMsgs = getMessagesSection("calc");
          (mapContainer.classList.remove("visible"),
            mapContainer.setAttribute("aria-hidden", "true"),
            toggleBtn.setAttribute("aria-expanded", "false"),
            (toggleBtn.innerHTML = `${currentMsgs.viewRouteButton} <span class="route-toggle-icon">&#9662;</span>`));
          const mapEl = document.getElementById("additional-route-map");
          if (
            (mapEl &&
              (mapEl.classList.remove("route-map--ready"),
              mapEl.classList.remove("route-map--labels-ready")),
            additionalRoutePolyline &&
              "function" == typeof additionalRoutePolyline.setMap &&
              additionalRoutePolyline.setMap(null),
            (additionalRoutePolyline = null),
            additionalRouteMarkers.forEach((m) => {
              m && m.setMap && m.setMap(null);
            }),
            (additionalRouteMarkers = []),
            originLabelOverlay &&
              "function" == typeof originLabelOverlay.setMap)
          )
            try {
              originLabelOverlay.setMap(null);
            } catch (_) {}
          if (
            destinationLabelOverlay &&
            "function" == typeof destinationLabelOverlay.setMap
          )
            try {
              destinationLabelOverlay.setMap(null);
            } catch (_) {}
          ((originLabelOverlay = null), (destinationLabelOverlay = null));
        } else {
          if (!googleApiLoaded || void 0 === google.maps.Map)
            return void (mapContainer.innerHTML =
              '<p style="padding: 1rem; text-align: center; color: #666;">Google Maps no está disponible</p>');
          const routeMapElement = document.getElementById(
            "additional-route-map",
          );
          if (!routeMapElement) return;
          (mapContainer.classList.add("visible"),
            mapContainer.setAttribute("aria-hidden", "false"),
            toggleBtn.setAttribute("aria-expanded", "true"));
          const currentMsgs = getMessagesSection("calc");
          toggleBtn.innerHTML = `${currentMsgs.hideRouteButton} <span class="route-toggle-icon">&#9652;</span>`;
          try {
            await loadGoogleMapsIfNeeded();
          } catch (_) {
            return (
              mapContainer.classList.remove("visible"),
              mapContainer.setAttribute("aria-hidden", "true"),
              toggleBtn.setAttribute("aria-expanded", "false"),
              void (toggleBtn.innerHTML = `${currentMsgs.viewRouteButton} <span class="route-toggle-icon">&#9662;</span>`)
            );
          }
          if (!googleApiLoaded || void 0 === google.maps.Map)
            return (
              (routeMapElement.style.display = "flex"),
              (routeMapElement.style.alignItems = "center"),
              (routeMapElement.style.justifyContent = "center"),
              (routeMapElement.style.color = "#666"),
              (routeMapElement.style.fontSize = "0.95rem"),
              (routeMapElement.style.padding = "1.5rem"),
              (routeMapElement.style.textAlign = "center"),
              (routeMapElement.style.background = "#f8f9fa"),
              (routeMapElement.style.border = "1px solid #e0e0e0"),
              (routeMapElement.style.borderRadius = "8px"),
              void (routeMapElement.innerHTML =
                getMessagesSection("alerts") &&
                getMessagesSection("alerts").googleMapsNotLoadedShort
                  ? getMessagesSection("alerts").googleMapsNotLoadedShort
                  : "No se pudo cargar el mapa.")
            );
          try {
            if (additionalRouteMapInstance) {
              const initialCenter =
                currentAdditionalRouteOverviewPath &&
                currentAdditionalRouteOverviewPath.length > 0
                  ? currentAdditionalRouteOverviewPath[0]
                  : currentAdditionalRouteStartLocation;
              initialCenter &&
                (additionalRouteMapInstance.setCenter(initialCenter),
                additionalRouteMapInstance.setZoom(11));
            } else {
              const initialCenter =
                currentAdditionalRouteOverviewPath &&
                currentAdditionalRouteOverviewPath.length > 0
                  ? currentAdditionalRouteOverviewPath[0]
                  : currentAdditionalRouteStartLocation;
              if (!initialCenter)
                return (
                  (routeMapElement.style.textAlign = "center"),
                  (routeMapElement.style.background = "#f8f9fa"),
                  (routeMapElement.style.border = "1px solid #e0e0e0"),
                  (routeMapElement.style.borderRadius = "8px"),
                  void (routeMapElement.innerHTML =
                    "No se pudo cargar el mapa.")
                );
              additionalRouteMapInstance = new google.maps.Map(
                routeMapElement,
                {
                  center: initialCenter,
                  zoom: 11,
                  disableDefaultUI: !0,
                  clickableIcons: !1,
                  keyboardShortcuts: !1,
                  gestureHandling: "greedy",
                  mapId: TC_GOOGLE_MAP_ID,
                },
              );
            }
            try {
              routeMapElement.style.opacity = "1";
            } catch (_) {}
            if (
              (additionalRoutePolyline && additionalRoutePolyline.setMap(null),
              additionalRouteMarkers.forEach((m) => {
                m && m.setMap && m.setMap(null);
              }),
              (additionalRouteMarkers = []),
              !currentAdditionalRouteBounds &&
                currentAdditionalRouteOverviewPath &&
                currentAdditionalRouteOverviewPath.length)
            ) {
              const bounds = new google.maps.LatLngBounds();
              (currentAdditionalRouteOverviewPath.forEach((p) =>
                bounds.extend(p),
              ),
                (currentAdditionalRouteBounds = bounds));
            }
            let widePadding = 45,
              finalPadding = 30;
            const routeDistanceForBounds =
              currentAdditionalTripData && currentAdditionalTripData.distance
                ? currentAdditionalTripData.distance
                : 0;
            routeDistanceForBounds > 0 && routeDistanceForBounds <= 5
              ? ((widePadding = 55), (finalPadding = 30))
              : routeDistanceForBounds > 5 && routeDistanceForBounds <= 40
                ? ((widePadding = 60), (finalPadding = 10))
                : routeDistanceForBounds > 40 &&
                  ((widePadding = 95), (finalPadding = 8));
            try {
              google.maps &&
                google.maps.event &&
                "function" == typeof google.maps.event.trigger &&
                additionalRouteMapInstance &&
                google.maps.event.trigger(additionalRouteMapInstance, "resize");
            } catch (_) {}
            try {
              currentAdditionalRouteBounds &&
                additionalRouteMapInstance &&
                additionalRouteMapInstance.fitBounds(
                  currentAdditionalRouteBounds,
                  widePadding,
                );
            } catch (_) {}
            setTimeout(() => {
              try {
                currentAdditionalRouteBounds &&
                  additionalRouteMapInstance &&
                  additionalRouteMapInstance.fitBounds(
                    currentAdditionalRouteBounds,
                    widePadding,
                  );
              } catch (_) {}
            }, 120);
            try {
              mapContainer.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
            } catch (_) {}
            (routeMapElement.classList.remove("route-map--ready"),
              routeMapElement.classList.remove("route-map--labels-ready"));
            const startLocation = currentAdditionalRouteStartLocation,
              endLocation = currentAdditionalRouteEndLocation,
              scheduleFrame =
                "function" == typeof requestAnimationFrame
                  ? requestAnimationFrame
                  : (fn) => setTimeout(fn, 16);
            function createRouteLabelOverlay(map, position, text, extraClass) {
              function RouteLabelOverlay(pos, txt, cls) {
                ((this.position = pos),
                  (this.text = txt),
                  (this.extraClass = cls || ""),
                  (this.div = null),
                  (this._typingTimer = null),
                  (this._typingDonePromise = null),
                  (this._typingDoneResolve = null));
              }
              ((RouteLabelOverlay.prototype = Object.create(
                google.maps.OverlayView.prototype,
              )),
                (RouteLabelOverlay.prototype.constructor = RouteLabelOverlay),
                (RouteLabelOverlay.prototype.setMap = function (map) {
                  google.maps.OverlayView.prototype.setMap.call(this, map);
                }),
                (RouteLabelOverlay.prototype.startTyping = function () {
                  if (
                    (this._typingDonePromise ||
                      (this._typingDonePromise = new Promise((resolve) => {
                        this._typingDoneResolve = resolve;
                      })),
                    !this.div)
                  )
                    return this._typingDonePromise;
                  const fullText = null != this.text ? String(this.text) : "";
                  if (!fullText)
                    return (
                      (this.div.textContent = ""),
                      this._typingDoneResolve &&
                        (this._typingDoneResolve(),
                        (this._typingDoneResolve = null)),
                      this._typingDonePromise
                    );
                  const mapDiv =
                      map && "function" == typeof map.getDiv
                        ? map.getDiv()
                        : null,
                    startTypingInner = () => {
                      if (!this.div) return;
                      try {
                        this.div.style.opacity = "1";
                      } catch (_) {}
                      this.div.textContent = "";
                      let index = 0;
                      const maxLength = fullText.length,
                        step = () => {
                          this.div &&
                            ((this.div.textContent = fullText.slice(
                              0,
                              index + 1,
                            )),
                            (index += 1),
                            index < maxLength
                              ? (this._typingTimer = setTimeout(step, 32))
                              : ((this._typingTimer = null),
                                this._typingDoneResolve &&
                                  (this._typingDoneResolve(),
                                  (this._typingDoneResolve = null))));
                        };
                      step();
                    };
                  if (
                    mapDiv &&
                    !mapDiv.classList.contains("route-map--labels-ready")
                  ) {
                    let attempts = 0;
                    const maxAttempts = 60,
                      waitUntilReady = () => {
                        this.div &&
                          (!mapDiv ||
                          mapDiv.classList.contains(
                            "route-map--labels-ready",
                          ) ||
                          attempts >= maxAttempts
                            ? startTypingInner()
                            : ((attempts += 1),
                              setTimeout(waitUntilReady, 32)));
                      };
                    waitUntilReady();
                  } else startTypingInner();
                  return this._typingDonePromise;
                }),
                (RouteLabelOverlay.prototype.onAdd = function () {
                  const div = document.createElement("div");
                  ((div.className =
                    "route-map-label" +
                    (this.extraClass ? " " + this.extraClass : "")),
                    (this.div = div));
                  const panes = this.getPanes();
                  (panes &&
                    panes.overlayMouseTarget &&
                    panes.overlayMouseTarget.appendChild(div),
                    this.startTyping());
                }),
                (RouteLabelOverlay.prototype.draw = function () {
                  if (!this.div) return;
                  const overlayProjection = this.getProjection();
                  if (!overlayProjection) return;
                  const position = this.position;
                  if (!position) return;
                  const point =
                    overlayProjection.fromLatLngToDivPixel(position);
                  point &&
                    ((this.div.style.left = point.x + "px"),
                    (this.div.style.top = point.y + "px"));
                }),
                (RouteLabelOverlay.prototype.onRemove = function () {
                  (this.div &&
                    this.div.parentNode &&
                    this.div.parentNode.removeChild(this.div),
                    this._typingTimer &&
                      (clearTimeout(this._typingTimer),
                      (this._typingTimer = null)),
                    (this.div = null));
                }));
              const overlay = new RouteLabelOverlay(position, text, extraClass);
              return (overlay.setMap(map), overlay);
            }
            const originPlace = autocompleteSelectedPlaces.additionalTripOrigen,
              destinationPlace =
                autocompleteSelectedPlaces.additionalTripDestino;
            let originLabelText = buildMapLabelFromPlaceOrAddress(
                originPlace,
                currentAdditionalTripData && currentAdditionalTripData.origin
                  ? escapeHtml(currentAdditionalTripData.origin)
                  : "",
              ),
              destinationLabelText = buildMapLabelFromPlaceOrAddress(
                destinationPlace,
                currentAdditionalTripData &&
                  currentAdditionalTripData.destination
                  ? escapeHtml(currentAdditionalTripData.destination)
                  : "",
              );
            const labelDistance =
              currentAdditionalTripData && currentAdditionalTripData.distance
                ? currentAdditionalTripData.distance
                : 0;
            let originLabelClass = "route-map-label--origin",
              destinationLabelClass = "route-map-label--destination";
            labelDistance > 0 &&
              labelDistance < 3 &&
              ((originLabelClass += " route-map-label--short"),
              (destinationLabelClass += " route-map-label--short"));
            let isMobile = !0;
            (isMobile ||
              (startLocation &&
                originLabelText &&
                (originLabelOverlay = createRouteLabelOverlay(
                  additionalRouteMapInstance,
                  startLocation,
                  originLabelText,
                  originLabelClass,
                )),
              endLocation &&
                destinationLabelText &&
                (destinationLabelOverlay = createRouteLabelOverlay(
                  additionalRouteMapInstance,
                  endLocation,
                  destinationLabelText,
                  destinationLabelClass,
                ))),
              setTimeout(() => {
                (routeMapElement.classList.add("route-map--ready"),
                  routeMapElement.classList.add("route-map--labels-ready"),
                  setTimeout(() => {
                    try {
                      currentAdditionalRouteBounds &&
                        additionalRouteMapInstance &&
                        additionalRouteMapInstance.fitBounds(
                          currentAdditionalRouteBounds,
                          finalPadding,
                        );
                    } catch (_) {}
                  }, 260));
              }, 200));
            let taxiMarker = null,
              destinationMarker = null,
              taxiBaseSize = 22,
              destinationBaseSize = 22;
            const routeDistanceForMarkers =
              currentAdditionalTripData && currentAdditionalTripData.distance
                ? currentAdditionalTripData.distance
                : 0;
            routeDistanceForMarkers > 0 &&
              (routeDistanceForMarkers < 5
                ? ((taxiBaseSize = 26), (destinationBaseSize = 26))
                : routeDistanceForMarkers < 20 &&
                  ((taxiBaseSize = 24), (destinationBaseSize = 24)));
            const hasAdvancedMarker = false,
              createMarkers = (showDestinationImmediately) => {
                if (startLocation) {
                  if (hasAdvancedMarker) {
                    const taxiContent = document.createElement("div");
                    ((taxiContent.textContent = "🚕"),
                      (taxiContent.style.fontSize = taxiBaseSize + "px"),
                      (taxiContent.style.lineHeight = "1"));
                    try {
                      taxiMarker = new google.maps.marker.AdvancedMarkerElement(
                        {
                          map: additionalRouteMapInstance,
                          position: startLocation,
                          content: taxiContent,
                        },
                      );
                    } catch (_) {
                      taxiMarker = new google.maps.Marker({
                        position: startLocation,
                        map: additionalRouteMapInstance,
                        icon: {
                          path: google.maps.SymbolPath.CIRCLE,
                          scale: 9,
                          fillColor: "#0a3d62",
                          fillOpacity: 1,
                          strokeColor: "#ffffff",
                          strokeWeight: 3,
                        },
                      });
                    }
                  } else
                    taxiMarker = new google.maps.Marker({
                      position: startLocation,
                      map: additionalRouteMapInstance,
                      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
                      label: { text: "🚕", fontSize: taxiBaseSize + "px" },
                    });
                  additionalRouteMarkers.push(taxiMarker);
                }
                if (endLocation) {
                  const destinationMap = showDestinationImmediately
                    ? additionalRouteMapInstance
                    : null;
                  if (hasAdvancedMarker) {
                    const destinationContent = document.createElement("div");
                    ((destinationContent.textContent = "🏁"),
                      (destinationContent.style.fontSize =
                        destinationBaseSize + "px"),
                      (destinationContent.style.lineHeight = "1"));
                    try {
                      destinationMarker =
                        new google.maps.marker.AdvancedMarkerElement({
                          map: destinationMap,
                          position: endLocation,
                          content: destinationContent,
                        });
                    } catch (_) {
                      destinationMarker = new google.maps.Marker({
                        position: endLocation,
                        map: destinationMap,
                        icon: {
                          path: google.maps.SymbolPath.CIRCLE,
                          scale: 9,
                          fillColor: "#fbc531",
                          fillOpacity: 1,
                          strokeColor: "#ffffff",
                          strokeWeight: 3,
                        },
                      });
                    }
                  } else
                    destinationMarker = new google.maps.Marker({
                      position: endLocation,
                      map: destinationMap,
                      icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
                      label: {
                        text: "🏁",
                        fontSize: destinationBaseSize + "px",
                      },
                    });
                  additionalRouteMarkers.push(destinationMarker);
                }
              },
              bounceMarker = (marker, baseSize) => {
                if (marker)
                  try {
                    if (
                      "function" == typeof marker.getLabel &&
                      "function" == typeof marker.setLabel
                    ) {
                      const currentLabel = marker.getLabel();
                      if (!currentLabel || !currentLabel.text) return;
                      const normalSize =
                          baseSize ||
                          parseInt(currentLabel.fontSize || "22", 10),
                        bigSize = normalSize + 8;
                      return (
                        marker.setLabel(
                          Object.assign({}, currentLabel, {
                            fontSize: bigSize + "px",
                          }),
                        ),
                        void setTimeout(() => {
                          marker.setLabel(
                            Object.assign({}, currentLabel, {
                              fontSize: normalSize + "px",
                            }),
                          );
                        }, 600)
                      );
                    }
                    const contentEl = marker.content;
                    if (contentEl && contentEl.style) {
                      const normalSize =
                          baseSize ||
                          parseInt(contentEl.style.fontSize || "22", 10),
                        bigSize = normalSize + 8;
                      ((contentEl.style.fontSize = bigSize + "px"),
                        setTimeout(() => {
                          contentEl.style.fontSize = normalSize + "px";
                        }, 600));
                    }
                  } catch (_) {}
              },
              flashPolylineOnce = (polyline) => {
                if (polyline)
                  try {
                    const originalOpacity =
                        "function" == typeof polyline.get
                          ? polyline.get("strokeOpacity")
                          : 1,
                      originalColor =
                        "function" == typeof polyline.get
                          ? polyline.get("strokeColor")
                          : "#e2bf55",
                      originalWeight =
                        "function" == typeof polyline.get
                          ? polyline.get("strokeWeight")
                          : 4,
                      brightColor = "#f6e27a",
                      boostedWeight = originalWeight + 2;
                    (polyline.setOptions({
                      strokeOpacity: 1,
                      strokeColor: brightColor,
                      strokeWeight: boostedWeight,
                    }),
                      setTimeout(() => {
                        try {
                          polyline.setOptions({
                            strokeOpacity:
                              null == originalOpacity ? 1 : originalOpacity,
                            strokeColor: originalColor || "#e2bf55",
                            strokeWeight: originalWeight,
                          });
                        } catch (_) {}
                      }, 600));
                  } catch (_) {}
              };
            let fullPath = currentAdditionalRouteOverviewPath.slice();
            fullPath = fullPath
              .map((p) => {
                if (!p) return null;
                const lat = "function" == typeof p.lat ? p.lat() : p.lat,
                  lng = "function" == typeof p.lng ? p.lng() : p.lng;
                return new google.maps.LatLng(lat, lng);
              })
              .filter((p) => null !== p);
            const distForAnimation =
                currentAdditionalTripData && currentAdditionalTripData.distance
                  ? currentAdditionalTripData.distance
                  : 0,
              animatedPath = new google.maps.MVCArray();
            additionalRoutePolyline = new google.maps.Polyline({
              path: animatedPath,
              map: additionalRouteMapInstance,
              strokeColor: "#e2bf55",
              strokeOpacity: 1,
              strokeWeight: 4,
            });
            let currentIndex = 0;
            const totalPoints = fullPath.length,
              baseDelay =
                distForAnimation > 100 ? 8 : distForAnimation > 50 ? 12 : 16,
              finalEffectDelay = 200,
              drawNext = () => {
                if (currentIndex >= totalPoints)
                  return void setTimeout(() => {
                    (destinationMarker &&
                      ("function" == typeof destinationMarker.setMap
                        ? destinationMarker.setMap(additionalRouteMapInstance)
                        : destinationMarker.map ||
                          (destinationMarker.map = additionalRouteMapInstance)),
                      flashPolylineOnce(additionalRoutePolyline),
                      bounceMarker(taxiMarker, taxiBaseSize),
                      bounceMarker(destinationMarker, destinationBaseSize),
                      isMobile &&
                        (startLocation &&
                          originLabelText &&
                          !originLabelOverlay &&
                          (originLabelOverlay = createRouteLabelOverlay(
                            additionalRouteMapInstance,
                            startLocation,
                            originLabelText,
                            originLabelClass,
                          )),
                        endLocation &&
                          destinationLabelText &&
                          !destinationLabelOverlay &&
                          (destinationLabelOverlay = createRouteLabelOverlay(
                            additionalRouteMapInstance,
                            endLocation,
                            destinationLabelText,
                            destinationLabelClass,
                          ))));
                  }, finalEffectDelay);
                const batchSize =
                    distForAnimation > 100 ? 5 : distForAnimation > 50 ? 3 : 2,
                  endIndex = Math.min(currentIndex + batchSize, totalPoints);
                for (let i = currentIndex; i < endIndex; i++)
                  animatedPath.push(fullPath[i]);
                ((currentIndex = endIndex),
                  scheduleFrame(() => setTimeout(drawNext, baseDelay)));
              },
              startRouteAnimation = () => {
                (bounceMarker(taxiMarker, taxiBaseSize), drawNext());
              };
            (createMarkers(!1),
              (function waitForMapReadyAndDelay() {
                !routeMapElement ||
                routeMapElement.classList.contains("route-map--ready")
                  ? setTimeout(startRouteAnimation, 1180)
                  : setTimeout(waitForMapReadyAndDelay, 50);
              })());
          } catch (e) {
            (console.error("Error showing additional route map:", e),
              routeMapElement &&
                (routeMapElement.innerHTML = "Error al cargar el mapa."));
          }
        }
      }),
      cancelBtn &&
        cancelBtn.addEventListener("click", () => {
          (hideElement(additionalTripCalcResultDiv),
            showElement(additionalTripForm),
            addAdditionalTripBtnWrapper &&
              additionalTripCalcResultDiv &&
              additionalTripCalcResultDiv.parentElement.insertBefore(
                addAdditionalTripBtnWrapper,
                additionalTripCalcResultDiv.nextElementSibling,
              ),
            additionalRouteMapInstance && (additionalRouteMapInstance = null),
            additionalRoutePolyline &&
              (additionalRoutePolyline.setMap(null),
              (additionalRoutePolyline = null)),
            (additionalRouteMarkers = []),
            (currentAdditionalTripData = null));
        }),
      confirmBtn &&
        confirmBtn.addEventListener("click", () => {
          if (
            currentAdditionalTripData &&
            currentAdditionalTripData.date &&
            currentAdditionalTripData.time
          ) {
            if (
              (new Date(
                `${currentAdditionalTripData.date}T${currentAdditionalTripData.time}`,
              ).getTime() -
                new Date().getTime()) /
                36e5 <
              12
            )
              return void showAdditionalMinLeadTimeNotice();
          }
          !(function () {
            if (!currentAdditionalTripData) return;
            additionalTripCounter++;
            const tripId = `additional-trip-${additionalTripCounter}`;
            const tripNumber = additionalTripCounter;
            window.additionalTrips.push({ id: tripId, ...currentAdditionalTripData });
            const tripDiv = document.createElement("div");
            ((tripDiv.id = tripId),
              (tripDiv.className = "additional-trip-summary"),
              (tripDiv.style.marginBottom = "1.5rem"));
            const detailsId = `${tripId}-details`,
              toggleBtnId = `${tripId}-toggle-btn`,
              originCity = extractCityName(currentAdditionalTripData.origin),
              destinationCity = extractCityName(
                currentAdditionalTripData.destination,
              ),
              msgs = getMessagesSection("calc");
            ((tripDiv.innerHTML = `\n      <div style="display: flex; flex-direction: column; gap: 0.5rem;">\n        <div style="display: flex; justify-content: space-between; align-items: center;">\n          <div style="color: var(--white); font-weight: 700; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem;">\n            <span style="background: rgba(255, 255, 255, 0.2); padding: 0.3rem 0.6rem; border-radius: 6px; font-size: 0.8rem;">${msgs.tripLabel || "Trayecto"} ${tripNumber}</span>\n          </div>\n          <div style="color: var(--secondary-color); font-weight: 700; font-size: 1.3rem; text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);">\n            ${formatPrice(currentAdditionalTripData.price)}\n          </div>\n        </div>\n        <div style="color: var(--white); font-weight: 600; font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">\n          <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 45%;">${originCity}</span>\n          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--secondary-color)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;">\n            <line x1="5" y1="12" x2="19" y2="12"></line>\n            <polyline points="12 5 19 12 12 19"></polyline>\n          </svg>\n          <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 45%;">${destinationCity}</span>\n        </div>\n      </div>\n      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; gap: 0.75rem;">\n        <button type="button" id="${toggleBtnId}" class="btn btn-light btn-sm" data-details-id="${detailsId}" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; font-weight: 600; border-radius: 6px; display: flex; align-items: center; gap: 0.4rem; transition: all 0.3s ease;">\n          <svg id="${toggleBtnId}-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.3s ease;">\n            <polyline points="6 9 12 15 18 9"></polyline>\n          </svg>\n          <span id="${toggleBtnId}-text">${msgs.showDetailsButton || "Mostrar detalles"}</span>\n        </button>\n        <button type="button" class="btn btn-danger btn-sm" data-trip-id="${tripId}" style="padding: 0.4rem 0.8rem; font-size: 0.8rem; font-weight: 600; border-radius: 6px; display: flex; align-items: center; gap: 0.4rem;">\n          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">\n            <polyline points="3 6 5 6 21 6"></polyline>\n            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>\n          </svg>\n          ${msgs.removeButton || "Eliminar"}\n        </button>\n      </div>\n      <div id="${detailsId}" class="additional-trip-details" style="display: none;">\n      </div>\n    `),
              additionalTripsList.appendChild(tripDiv));
            const toggleBtn = document.getElementById(toggleBtnId),
              deleteBtn = tripDiv.querySelector("[data-trip-id]");
            toggleBtn &&
              toggleBtn.addEventListener("click", () => {
                toggleAdditionalTripDetails(detailsId, toggleBtnId);
              });
            deleteBtn &&
              deleteBtn.addEventListener("click", () => {
                removeAdditionalTrip(tripId);
              });
            additionalTripsSection &&
              (additionalTripsSection.style.display = "block");
            const additionalTripsTitle = document.getElementById(
              "additional-trips-title",
            );
            additionalTripsTitle &&
              (additionalTripsTitle.style.display = "block");
            addAdditionalTripBtnWrapper &&
              ((addAdditionalTripBtnWrapper.style.display = "block"),
              additionalTripForm &&
                additionalTripForm.parentElement &&
                addAdditionalTripBtnWrapper.parentElement !==
                  additionalTripForm.parentElement &&
                additionalTripForm.parentElement.insertBefore(
                  addAdditionalTripBtnWrapper,
                  additionalTripForm.nextElementSibling,
                ));
            (hideElementSmooth(additionalTripForm),
              hideElementSmooth(additionalTripCalcResultDiv),
              setTimeout(() => {
                try {
                  tripDiv &&
                    "function" == typeof tripDiv.scrollIntoView &&
                    tripDiv.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                } catch (_) {}
              }, 300),
              (currentAdditionalTripData = null),
              updateTotalPriceAmount());
          })();
        }));
  }
  function showAdditionalMinLeadTimeNotice() {
    if (!additionalTripCalcResultDiv) return;
    const msgs = getMessagesSection("calc");
    const origin = additionalTripOrigenInput?.value || "";
    const destination = additionalTripDestinoInput?.value || "";
    const time = additionalTripHoraInput?.value || "";
    const price = formatPrice(currentCalculation?.totalPriceOneWay || 0);
    
    // Limpiar las direcciones para el mensaje de WhatsApp y convertir a minúsculas
    const cleanOrigin = origin.replace(/,\s*Conil de la Frontera/g, '').replace(/·/g, '').toLowerCase();
    const cleanDestination = destination.replace(/,\s*Conil de la Frontera/g, '').replace(/·/g, '').toLowerCase();
    
    const whatsappMessage = encodeURIComponent(
      msgs.whatsappMessageTemplate
        .replace('{origin}', cleanOrigin)
        .replace('{destination}', cleanDestination)
        .replace('{time}', time)
        .replace('{price}', price)
    );
    
    ((additionalTripCalcResultDiv.innerHTML = `
      <div class="min-lead-time-notice">
        <p><i class="fas fa-exclamation-triangle"></i> ${msgs.minLeadTimeLine(12)}</p>
        <p>${msgs.urgentServicesLine}</p>
        <div style="display: flex; gap: 15px; justify-content: center; align-items: center; margin-top: 15px;">
          <a href="https://wa.me/34670705774?text=${whatsappMessage}" target="_blank" style="display: inline-flex; align-items: center; justify-content: center; width: 50px; height: 50px; border-radius: 50%; background-color: #25d366; color: white; text-decoration: none; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 2px 8px rgba(37, 211, 102, 0.3);">
            <i class="fab fa-whatsapp" style="font-size: 24px;"></i>
          </a>
          <a href="tel:+34670705774" style="display: inline-flex; align-items: center; justify-content: center; width: 50px; height: 50px; border-radius: 50%; background-color: #333; color: white; text-decoration: none; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 2px 8px rgba(51, 51, 51, 0.3);">
            <i class="fas fa-phone-alt" style="font-size: 24px;"></i>
          </a>
          <button type="button" id="additional-lead-time-back-btn" style="display: inline-flex; align-items: center; justify-content: center; width: 50px; height: 50px; border-radius: 50%; background-color: #6c757d; color: white; border: none; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 2px 8px rgba(108, 117, 125, 0.3);">
            <i class="fas fa-times" style="font-size: 24px;"></i>
          </button>
        </div>
      </div>
    `),
      showElement(additionalTripCalcResultDiv),
      additionalTripCalcResultDiv.addEventListener("click", function (e) {
        e.target &&
          "additional-lead-time-back-btn" === e.target.id &&
          (hideElement(additionalTripCalcResultDiv),
          showElement(additionalTripForm),
          addAdditionalTripBtnWrapper &&
            additionalTripCalcResultDiv &&
            additionalTripCalcResultDiv.parentElement.insertBefore(
              addAdditionalTripBtnWrapper,
              additionalTripCalcResultDiv.nextElementSibling,
            ));
      }));
  }
  function invalidateOneWayCalculationUi() {
    try {
      hideElementSmooth(calcResultDiv, 140);
    } catch (_) {}
    try {
      (bookingFormWrapper &&
        (bookingFormWrapper.classList.remove("visible"),
        hideElement(bookingFormWrapper)),
        bookingFormSection && hideElement(bookingFormSection),
        totalPriceSection && hideElement(totalPriceSection));
    } catch (_) {}
    try {
      currentCalculation &&
        ((currentCalculation.origin = ""),
        (currentCalculation.destination = ""),
        (currentCalculation.distanceKm = 0),
        (currentCalculation.durationSeconds = 0),
        (currentCalculation.durationText = ""),
        (currentCalculation.billedDistanceKm = 0),
        (currentCalculation.billedDurationSeconds = 0),
        (currentCalculation.billedDurationText = ""),
        (currentCalculation.rawPrice = 0),
        (currentCalculation.totalPriceOneWay = 0),
        (currentCalculation.pickupDateTime = null),
        (currentCalculation.isBelowMinPrice = !1),
        (currentCalculation.isMinPriceApplied = !1),
        (currentCalculation.lastRequestKey = ""));
    } catch (_) {}
    try {
      ((currentRouteOverviewPath = null),
        (currentRouteStartLocation = null),
        (currentRouteEndLocation = null),
        (currentRouteBounds = null),
        (routeMapInstance = null),
        (routeMapPolyline = null),
        (routeMapMarkers = []));
    } catch (_) {}
    try {
      currentBookingDetails &&
        ((currentBookingDetails.returnTrip = !1),
        (currentBookingDetails.returnPrice = 0),
        (currentBookingDetails.finalTotalPrice = 0),
        (currentBookingDetails.returnDistanceKm = 0),
        (currentBookingDetails.returnDurationText = ""),
        (currentBookingDetails.returnBilledDistanceKm = 0),
        (currentBookingDetails.returnBilledDurationText = ""),
        (currentBookingDetails.returnBilledDurationSeconds = 0),
        (currentBookingDetails.returnOrigin = ""),
        (currentBookingDetails.returnDestination = ""),
        (currentBookingDetails.returnRawPrice = 0),
        (currentBookingDetails.returnPickupDateTime = null));
    } catch (_) {}
    try {
      (hideElement(returnDetailsDiv), hideElement(returnCalcResultDiv));
    } catch (_) {}
    try {
      updateTotalPriceAmount();
    } catch (_) {}
  }
  function attachGoogleMapsLazyLoadForInput(input) {
    if (!input) return;
    const trigger = () => {
      try {
        input &&
          input.id &&
          ("origen-calc" === input.id &&
            googleMapsAutocompleteRequestedKeys.add("origenCalc"),
          "destino-calc" === input.id &&
            googleMapsAutocompleteRequestedKeys.add("destinoCalc"),
          "origen-vuelta-calc" === input.id &&
            googleMapsAutocompleteRequestedKeys.add("origenVuelta"),
          "destino-vuelta-calc" === input.id &&
            googleMapsAutocompleteRequestedKeys.add("destinoVuelta"),
          "additional-trip-origen" === input.id &&
            googleMapsAutocompleteRequestedKeys.add("additionalTripOrigen"),
          "additional-trip-destino" === input.id &&
            googleMapsAutocompleteRequestedKeys.add("additionalTripDestino"));
      } catch (_) {}
      loadGoogleMapsIfNeeded().catch(() => {});
    };
    (input.addEventListener("focus", trigger, { once: !0 }),
      input.addEventListener("click", trigger, { once: !0 }),
      input.addEventListener("input", trigger, { once: !0 }));
  }
  function attachTimePickerAutoOpen(input) {
    input &&
      input.addEventListener("focus", function () {
        try {
          "function" == typeof this.showPicker && this.showPicker();
        } catch (e) {}
      });
  }
  ((window.toggleAdditionalTripDetails = async function (
    detailsId,
    toggleBtnId,
  ) {
    const detailsDiv = document.getElementById(detailsId);
    if (!detailsDiv) return;
    toggleBtnId && document.getElementById(toggleBtnId);
    const toggleBtnText = toggleBtnId
        ? document.getElementById(`${toggleBtnId}-text`)
        : null,
      toggleBtnIcon = toggleBtnId
        ? document.getElementById(`${toggleBtnId}-icon`)
        : null,
      tripId = detailsId.replace("-details", ""),
      trip = window.additionalTrips.find((t) => t.id === tripId);
    if (!trip) return;
    if ("none" === detailsDiv.style.display) {
      const msgs = getMessagesSection("calc"),
        routeMapInfoHtml =
          "function" == typeof isHandheldMobileDevice &&
          isHandheldMobileDevice()
            ? ""
            : `\n        <div class="route-map-info">\n          <div class="route-map-chip">\n            <span class="route-map-chip-main">${trip.distance.toFixed(1)} km · ${trip.duration}</span>\n          </div>\n        </div>\n      `;
      let formattedDate = trip.date || "";
      if (formattedDate && formattedDate.includes("-")) {
        const parts = formattedDate.split("-");
        if (3 === parts.length) {
          const [yyyy, mm, dd] = parts;
          formattedDate = `${dd}/${mm}/${yyyy}`;
        }
      }
      (buildShortAddressLabel(trip.origin),
        buildShortAddressLabel(trip.destination));
      ((detailsDiv.innerHTML = `\n        <div style="margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.2);">\n          <div style="font-size: 0.85rem; color: rgba(255, 255, 255, 0.6); margin-bottom: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px;">${msgs.fullAddressLabel || "Dirección completa"}</div>\n          <div style="display: flex; flex-direction: column; gap: 0.75rem;">\n            <div style="display: flex; align-items: flex-start; gap: 0.75rem;">\n              <div style="flex-shrink: 0; width: 8px; height: 8px; background: var(--secondary-color); border-radius: 50%; margin-top: 6px;"></div>\n              <div style="font-size: 1rem; color: var(--white); font-weight: 500; line-height: 1.4;">${trip.origin}</div>\n            </div>\n            <div style="display: flex; align-items: center; justify-content: center; padding: 0.25rem 0;">\n              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--secondary-color)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.8;">\n                <line x1="12" y1="5" x2="12" y2="19"></line>\n                <polyline points="5 12 12 19 19 12"></polyline>\n              </svg>\n            </div>\n            <div style="display: flex; align-items: flex-start; gap: 0.75rem;">\n              <div style="flex-shrink: 0; width: 8px; height: 8px; background: var(--secondary-color); border-radius: 50%; margin-top: 6px;"></div>\n              <div style="font-size: 1rem; color: var(--white); font-weight: 500; line-height: 1.4;">${trip.destination}</div>\n            </div>\n          </div>\n        </div>\n        <div class="trip-details-grid">\n          <div class="trip-grid-item trip-grid-top-left">\n            <div class="trip-grid-label">${msgs.dateTimeLabel || "Fecha y hora"}</div>\n            <div class="trip-grid-value">${formattedDate} ${trip.time}</div>\n          </div>\n          <div class="trip-grid-item trip-grid-top-right">\n            <div class="trip-grid-label">${msgs.returnDurationLabel}</div>\n            <div class="trip-grid-value">${trip.duration}</div>\n          </div>\n          <div class="trip-grid-item trip-grid-bottom-left">\n            <div class="trip-grid-label">${msgs.distanceLabel}</div>\n            <div class="trip-grid-value">${trip.distance.toFixed(1)} km</div>\n          </div>\n          <div class="trip-grid-item trip-grid-bottom-right">\n            <div class="trip-grid-label">${msgs.priceLabel || "Precio"}</div>\n            <div class="trip-grid-value trip-price">${formatPrice(trip.price)}</div>\n          </div>\n        </div>\n        <div class="route-map-toggle-wrapper">\n          <button type="button" id="toggle-${tripId}-route-map-btn" class="btn route-map-toggle-btn" aria-expanded="false" aria-controls="${tripId}-route-map-container">\n            ${msgs.viewRouteButton} <span class="route-toggle-icon">&#9662;</span>\n          </button>\n        </div>\n        <div id="${tripId}-route-map-container" class="route-map-container" aria-hidden="true">\n          ${routeMapInfoHtml}\n          <div id="${tripId}-route-map" class="route-map" role="img" aria-label="${trip.distance.toFixed(1)} km, ${trip.duration}"></div>\n        </div>\n      `),
        (detailsDiv.style.display = "block"),
        (detailsDiv.style.marginTop = "2.5rem"),
        (detailsDiv.style.padding = "2.5rem"),
        (detailsDiv.style.backgroundColor = "var(--primary-color)"),
        (detailsDiv.style.borderRadius = "14px"),
        (detailsDiv.style.color = "var(--light-gray)"),
        detailsDiv.classList.add("additional-trip-details"),
        toggleBtnText && (toggleBtnText.textContent = msgs.hideDetailsButton || "Ocultar detalles"),
        toggleBtnIcon && (toggleBtnIcon.style.transform = "rotate(180deg)"));
      try {
        detailsDiv &&
          "function" == typeof detailsDiv.scrollIntoView &&
          detailsDiv.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch (_) {}
      const mapContainer = document.getElementById(
          `${tripId}-route-map-container`,
        ),
        toggleBtn = document.getElementById(`toggle-${tripId}-route-map-btn`);
      if (toggleBtn && mapContainer) {
        let mapInitialized = !1,
          mapInstance = null,
          polyline = null,
          taxiMarker = null,
          destinationMarker = null,
          bounds = null,
          finalPadding = 30,
          startLocation = null,
          endLocation = null,
          originLabelOverlay = null,
          destinationLabelOverlay = null;
        const initializeMap = async () => {
          const mapElement = document.getElementById(`${tripId}-route-map`);
          if (!mapElement || !trip.route || !trip.route.overview_path) return;
          try {
            await loadGoogleMapsIfNeeded();
          } catch (_) {
            return;
          }
          if (!googleApiLoaded || void 0 === google.maps.Map)
            return (
              (mapElement.style.display = "flex"),
              (mapElement.style.alignItems = "center"),
              (mapElement.style.justifyContent = "center"),
              (mapElement.style.color = "#666"),
              (mapElement.style.fontSize = "0.95rem"),
              (mapElement.style.padding = "1.5rem"),
              (mapElement.style.textAlign = "center"),
              (mapElement.style.background = "#f8f9fa"),
              (mapElement.style.border = "1px solid #e0e0e0"),
              (mapElement.style.borderRadius = "8px"),
              void (mapElement.innerHTML =
                getMessagesSection("alerts") &&
                getMessagesSection("alerts").googleMapsNotLoadedShort
                  ? getMessagesSection("alerts").googleMapsNotLoadedShort
                  : "No se pudo cargar el mapa.")
            );
          const initialCenter = trip.route.overview_path[0];
          ((startLocation =
            trip.route.legs && trip.route.legs[0]
              ? trip.route.legs[0].start_location
              : null),
            (endLocation =
              trip.route.legs && trip.route.legs[0]
                ? trip.route.legs[0].end_location
                : null),
            (mapInstance = new google.maps.Map(mapElement, {
              center: initialCenter,
              zoom: 11,
              disableDefaultUI: !0,
              clickableIcons: !1,
              keyboardShortcuts: !1,
              gestureHandling: "greedy",
              mapId: TC_GOOGLE_MAP_ID,
            })));
          try {
            mapElement.style.opacity = "1";
          } catch (_) {}
          ((bounds = new google.maps.LatLngBounds()),
            trip.route.overview_path.forEach((p) => bounds.extend(p)));
          let widePadding = 45;
          const routeDistanceForBounds = trip.distance || 0;
          routeDistanceForBounds > 0 && routeDistanceForBounds <= 5
            ? ((widePadding = 55), (finalPadding = 30))
            : routeDistanceForBounds > 5 && routeDistanceForBounds <= 40
              ? ((widePadding = 60), (finalPadding = 10))
              : routeDistanceForBounds > 40 &&
                ((widePadding = 95), (finalPadding = 8));
          try {
            google.maps &&
              google.maps.event &&
              "function" == typeof google.maps.event.trigger &&
              mapInstance &&
              google.maps.event.trigger(mapInstance, "resize");
          } catch (_) {}
          try {
            bounds && mapInstance && mapInstance.fitBounds(bounds, widePadding);
          } catch (_) {}
          (setTimeout(() => {
            try {
              bounds &&
                mapInstance &&
                mapInstance.fitBounds(bounds, widePadding);
            } catch (_) {}
          }, 120),
            mapElement.classList.remove("route-map--ready"),
            mapElement.classList.remove("route-map--labels-ready"));
          const scheduleFrame =
            "function" == typeof requestAnimationFrame
              ? requestAnimationFrame
              : (fn) => setTimeout(fn, 16);
          setTimeout(() => {
            (mapElement.classList.add("route-map--ready"),
              mapElement.classList.add("route-map--labels-ready"),
              setTimeout(() => {
                try {
                  bounds &&
                    mapInstance &&
                    mapInstance.fitBounds(bounds, finalPadding);
                } catch (_) {}
              }, 260));
          }, 200);
          let taxiBaseSize = 22,
            destinationBaseSize = 22;
          const routeDistanceForMarkers = trip.distance || 0;
          routeDistanceForMarkers > 0 &&
            (routeDistanceForMarkers < 5
              ? ((taxiBaseSize = 26), (destinationBaseSize = 26))
              : routeDistanceForMarkers < 20 &&
                ((taxiBaseSize = 24), (destinationBaseSize = 24)));
          const hasAdvancedMarker = false,
            bounceMarker = (marker, baseSize) => {
              if (marker)
                try {
                  if (
                    "function" == typeof marker.getLabel &&
                    "function" == typeof marker.setLabel
                  ) {
                    const currentLabel = marker.getLabel();
                    if (!currentLabel || !currentLabel.text) return;
                    const normalSize =
                        baseSize || parseInt(currentLabel.fontSize || "22", 10),
                      bigSize = normalSize + 8;
                    return (
                      marker.setLabel(
                        Object.assign({}, currentLabel, {
                          fontSize: bigSize + "px",
                        }),
                      ),
                      void setTimeout(() => {
                        marker.setLabel(
                          Object.assign({}, currentLabel, {
                            fontSize: normalSize + "px",
                          }),
                        );
                      }, 600)
                    );
                  }
                  const contentEl = marker.content;
                  if (contentEl && contentEl.style) {
                    const normalSize =
                        baseSize ||
                        parseInt(contentEl.style.fontSize || "22", 10),
                      bigSize = normalSize + 8;
                    ((contentEl.style.fontSize = bigSize + "px"),
                      setTimeout(() => {
                        contentEl.style.fontSize = normalSize + "px";
                      }, 600));
                  }
                } catch (_) {}
            };
          function createRouteLabelOverlay(map, position, text, extraClass) {
            function RouteLabelOverlay(pos, txt, cls) {
              ((this.position = pos),
                (this.text = txt),
                (this.extraClass = cls || ""),
                (this.div = null),
                (this._typingTimer = null),
                (this._typingDonePromise = null),
                (this._typingDoneResolve = null));
            }
            ((RouteLabelOverlay.prototype = Object.create(
              google.maps.OverlayView.prototype,
            )),
              (RouteLabelOverlay.prototype.constructor = RouteLabelOverlay),
              (RouteLabelOverlay.prototype.setMap = function (map) {
                google.maps.OverlayView.prototype.setMap.call(this, map);
              }),
              (RouteLabelOverlay.prototype.startTyping = function () {
                if (
                  (this._typingDonePromise ||
                    (this._typingDonePromise = new Promise((resolve) => {
                      this._typingDoneResolve = resolve;
                    })),
                  !this.div)
                )
                  return this._typingDonePromise;
                const fullText = null != this.text ? String(this.text) : "";
                if (!fullText)
                  return (
                    (this.div.textContent = ""),
                    this._typingDoneResolve &&
                      (this._typingDoneResolve(),
                      (this._typingDoneResolve = null)),
                    this._typingDonePromise
                  );
                const mapDiv =
                    map && "function" == typeof map.getDiv
                      ? map.getDiv()
                      : null,
                  startTypingInner = () => {
                    if (!this.div) return;
                    try {
                      this.div.style.opacity = "1";
                    } catch (_) {}
                    this.div.textContent = "";
                    let index = 0;
                    const maxLength = fullText.length,
                      step = () => {
                        this.div &&
                          ((this.div.textContent = fullText.slice(
                            0,
                            index + 1,
                          )),
                          (index += 1),
                          index < maxLength
                            ? (this._typingTimer = setTimeout(step, 32))
                            : ((this._typingTimer = null),
                              this._typingDoneResolve &&
                                (this._typingDoneResolve(),
                                (this._typingDoneResolve = null))));
                      };
                    step();
                  };
                if (
                  mapDiv &&
                  !mapDiv.classList.contains("route-map--labels-ready")
                ) {
                  let attempts = 0;
                  const maxAttempts = 60,
                    waitUntilReady = () => {
                      this.div &&
                        (!mapDiv ||
                        mapDiv.classList.contains("route-map--labels-ready") ||
                        attempts >= maxAttempts
                          ? startTypingInner()
                          : ((attempts += 1), setTimeout(waitUntilReady, 32)));
                    };
                  waitUntilReady();
                } else startTypingInner();
                return this._typingDonePromise;
              }),
              (RouteLabelOverlay.prototype.onAdd = function () {
                const div = document.createElement("div");
                ((div.className =
                  "route-map-label" +
                  (this.extraClass ? " " + this.extraClass : "")),
                  (this.div = div));
                const panes = this.getPanes();
                (panes &&
                  panes.overlayMouseTarget &&
                  panes.overlayMouseTarget.appendChild(div),
                  this.startTyping());
              }),
              (RouteLabelOverlay.prototype.draw = function () {
                if (!this.div) return;
                const overlayProjection = this.getProjection();
                if (!overlayProjection) return;
                const position = this.position;
                if (!position) return;
                const point = overlayProjection.fromLatLngToDivPixel(position);
                point &&
                  ((this.div.style.left = point.x + "px"),
                  (this.div.style.top = point.y + "px"));
              }),
              (RouteLabelOverlay.prototype.onRemove = function () {
                (this.div &&
                  this.div.parentNode &&
                  this.div.parentNode.removeChild(this.div),
                  this._typingTimer &&
                    (clearTimeout(this._typingTimer),
                    (this._typingTimer = null)),
                  (this.div = null));
              }));
            const overlay = new RouteLabelOverlay(position, text, extraClass);
            return (overlay.setMap(map), overlay);
          }
          let fullPath = trip.route.overview_path.slice();
          fullPath = fullPath
            .map((p) => {
              if (!p) return null;
              const lat = "function" == typeof p.lat ? p.lat() : p.lat,
                lng = "function" == typeof p.lng ? p.lng() : p.lng;
              return new google.maps.LatLng(lat, lng);
            })
            .filter((p) => null !== p);
          const distForAnimation = trip.distance || 0,
            animatedPath = new google.maps.MVCArray();
          polyline = new google.maps.Polyline({
            path: animatedPath,
            map: mapInstance,
            strokeColor: "#e2bf55",
            strokeOpacity: 1,
            strokeWeight: 4,
          });
          let currentIndex = 0;
          const totalPoints = fullPath.length,
            baseDelay =
              distForAnimation > 100 ? 8 : distForAnimation > 50 ? 12 : 16,
            drawNext = () => {
              if (currentIndex >= totalPoints)
                return void setTimeout(() => {
                  (destinationMarker &&
                    ("function" == typeof destinationMarker.setMap
                      ? destinationMarker.setMap(mapInstance)
                      : destinationMarker.map ||
                        (destinationMarker.map = mapInstance)),
                    ((polyline) => {
                      if (polyline)
                        try {
                          const originalOpacity =
                              "function" == typeof polyline.get
                                ? polyline.get("strokeOpacity")
                                : 1,
                            originalColor =
                              "function" == typeof polyline.get
                                ? polyline.get("strokeColor")
                                : "#e2bf55",
                            originalWeight =
                              "function" == typeof polyline.get
                                ? polyline.get("strokeWeight")
                                : 4,
                            brightColor = "#f6e27a",
                            boostedWeight = originalWeight + 2;
                          (polyline.setOptions({
                            strokeOpacity: 1,
                            strokeColor: brightColor,
                            strokeWeight: boostedWeight,
                          }),
                            setTimeout(() => {
                              try {
                                polyline.setOptions({
                                  strokeOpacity:
                                    null == originalOpacity
                                      ? 1
                                      : originalOpacity,
                                  strokeColor: originalColor || "#e2bf55",
                                  strokeWeight: originalWeight,
                                });
                              } catch (_) {}
                            }, 600));
                        } catch (_) {}
                    })(polyline),
                    bounceMarker(taxiMarker, taxiBaseSize),
                    bounceMarker(destinationMarker, destinationBaseSize));
                }, 200);
              const batchSize =
                  distForAnimation > 100 ? 5 : distForAnimation > 50 ? 3 : 2,
                endIndex = Math.min(currentIndex + batchSize, totalPoints);
              for (let i = currentIndex; i < endIndex; i++)
                animatedPath.push(fullPath[i]);
              ((currentIndex = endIndex),
                scheduleFrame(() => setTimeout(drawNext, baseDelay)));
            },
            startRouteAnimation = () => {
              (bounceMarker(taxiMarker, taxiBaseSize), drawNext());
            };
          ((showDestinationImmediately) => {
            if (startLocation)
              if (hasAdvancedMarker) {
                const taxiContent = document.createElement("div");
                ((taxiContent.textContent = "🚕"),
                  (taxiContent.style.fontSize = taxiBaseSize + "px"),
                  (taxiContent.style.lineHeight = "1"));
                try {
                  taxiMarker = new google.maps.marker.AdvancedMarkerElement({
                    map: mapInstance,
                    position: startLocation,
                    content: taxiContent,
                  });
                } catch (_) {
                  taxiMarker = new google.maps.Marker({
                    position: startLocation,
                    map: mapInstance,
                    icon: {
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 9,
                      fillColor: "#0a3d62",
                      fillOpacity: 1,
                      strokeColor: "#ffffff",
                      strokeWeight: 3,
                    },
                  });
                }
              } else
                taxiMarker = new google.maps.Marker({
                  position: startLocation,
                  map: mapInstance,
                  icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
                  label: { text: "🚕", fontSize: taxiBaseSize + "px" },
                });
            if (endLocation) {
              const destinationMap = showDestinationImmediately
                ? mapInstance
                : null;
              if (hasAdvancedMarker) {
                const destinationContent = document.createElement("div");
                ((destinationContent.textContent = "🏁"),
                  (destinationContent.style.fontSize =
                    destinationBaseSize + "px"),
                  (destinationContent.style.lineHeight = "1"));
                try {
                  destinationMarker =
                    new google.maps.marker.AdvancedMarkerElement({
                      map: destinationMap,
                      position: endLocation,
                      content: destinationContent,
                    });
                } catch (_) {
                  destinationMarker = new google.maps.Marker({
                    position: endLocation,
                    map: destinationMap,
                    icon: {
                      path: google.maps.SymbolPath.CIRCLE,
                      scale: 9,
                      fillColor: "#fbc531",
                      fillOpacity: 1,
                      strokeColor: "#ffffff",
                      strokeWeight: 3,
                    },
                  });
                }
              } else
                destinationMarker = new google.maps.Marker({
                  position: endLocation,
                  map: destinationMap,
                  icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
                  label: { text: "🏁", fontSize: destinationBaseSize + "px" },
                });
            }
          })(!1);
          const originLabelText = buildShortAddressLabel(trip.origin),
            destinationLabelText = buildShortAddressLabel(trip.destination),
            labelDistance = trip.distance || 0;
          let originLabelClass = "route-map-label--origin",
            destinationLabelClass = "route-map-label--destination";
          (labelDistance > 0 &&
            labelDistance < 3 &&
            ((originLabelClass += " route-map-label--short"),
            (destinationLabelClass += " route-map-label--short")),
            startLocation &&
              originLabelText &&
              (originLabelOverlay = createRouteLabelOverlay(
                mapInstance,
                startLocation,
                originLabelText,
                originLabelClass,
              )),
            endLocation &&
              destinationLabelText &&
              (destinationLabelOverlay = createRouteLabelOverlay(
                mapInstance,
                endLocation,
                destinationLabelText,
                destinationLabelClass,
              )),
            (function waitForMapReadyAndDelay() {
              !mapElement || mapElement.classList.contains("route-map--ready")
                ? setTimeout(startRouteAnimation, 1180)
                : setTimeout(waitForMapReadyAndDelay, 50);
            })());
        };
        toggleBtn.addEventListener("click", async () => {
          const isExpanded = "true" === toggleBtn.getAttribute("aria-expanded");
          if (
            (toggleBtn.setAttribute("aria-expanded", !isExpanded),
            mapContainer.setAttribute("aria-hidden", isExpanded),
            isExpanded)
          ) {
            (mapContainer.classList.remove("visible"),
              mapContainer.setAttribute("aria-hidden", "true"));
            const currentMsgs = getMessagesSection("calc");
            toggleBtn.innerHTML = `${currentMsgs.viewRouteButton} <span class="route-toggle-icon">&#9662;</span>`;
            const mapEl = document.getElementById(`${tripId}-route-map`);
            if (
              (mapEl &&
                (mapEl.classList.remove("route-map--ready"),
                mapEl.classList.remove("route-map--labels-ready")),
              polyline &&
                "function" == typeof polyline.setMap &&
                polyline.setMap(null),
              taxiMarker &&
                "function" == typeof taxiMarker.setMap &&
                taxiMarker.setMap(null),
              destinationMarker &&
                "function" == typeof destinationMarker.setMap &&
                destinationMarker.setMap(null),
              originLabelOverlay &&
                "function" == typeof originLabelOverlay.setMap)
            )
              try {
                originLabelOverlay.setMap(null);
              } catch (_) {}
            if (
              destinationLabelOverlay &&
              "function" == typeof destinationLabelOverlay.setMap
            )
              try {
                destinationLabelOverlay.setMap(null);
              } catch (_) {}
            ((originLabelOverlay = null), (destinationLabelOverlay = null));
          } else {
            (mapContainer.classList.add("visible"),
              mapContainer.setAttribute("aria-hidden", "false"));
            const currentMsgs = getMessagesSection("calc");
            ((toggleBtn.innerHTML = `${currentMsgs.hideRouteButton} <span class="route-toggle-icon">&#9652;</span>`),
              mapInitialized || (await initializeMap(), (mapInitialized = !0)));
            try {
              mapContainer &&
                mapContainer.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                });
            } catch (_) {}
          }
        });
      }
    } else {
      const msgs = getMessagesSection("calc");
      ((detailsDiv.style.display = "none"),
        detailsDiv.classList.remove("additional-trip-details"),
        (detailsDiv.style.marginTop = ""),
        (detailsDiv.style.padding = ""),
        (detailsDiv.style.backgroundColor = ""),
        (detailsDiv.style.borderRadius = ""),
        (detailsDiv.style.color = ""),
        toggleBtnText && (toggleBtnText.textContent = msgs.showDetailsButton || "Mostrar detalles"),
        toggleBtnIcon && (toggleBtnIcon.style.transform = "rotate(0deg)"),
        setTimeout(() => {
          try {
            const tripDiv = document.getElementById(tripId);
            tripDiv &&
              "function" == typeof tripDiv.scrollIntoView &&
              tripDiv.scrollIntoView({ behavior: "smooth", block: "center" });
          } catch (_) {}
        }, 100));
    }
  }),
    (window.removeAdditionalTrip = function (tripId) {
      const tripDiv = document.getElementById(tripId);
      if (
        tripDiv &&
        (tripDiv.remove(),
        (window.additionalTrips = window.additionalTrips.filter(
          (trip) => trip.id !== tripId,
        )),
        updateTotalPriceAmount(),
        0 === window.additionalTrips.length)
      ) {
        const additionalTripsTitle = document.getElementById(
          "additional-trips-title",
        );
        (additionalTripsTitle && (additionalTripsTitle.style.display = "none"),
          additionalTripForm &&
            additionalTripFormOriginalParent &&
            additionalTripFormOriginalParent.insertBefore(
              additionalTripForm,
              additionalTripFormOriginalNextSibling,
            ),
          addAdditionalTripBtnWrapper &&
            addAdditionalTripBtnOriginalParent &&
            addAdditionalTripBtnOriginalParent.insertBefore(
              addAdditionalTripBtnWrapper,
              addAdditionalTripBtnOriginalNextSibling,
            ));
      }
    }),
    attachGoogleMapsLazyLoadForInput(origenCalcInput),
    attachGoogleMapsLazyLoadForInput(destinoCalcInput),
    attachGoogleMapsLazyLoadForInput(origenVueltaInput),
    attachGoogleMapsLazyLoadForInput(destinoVueltaInput),
    attachTimePickerAutoOpen(horaCalcInput),
    attachTimePickerAutoOpen(returnTimeInput),
    attachTimePickerAutoOpen(fechaCalcInput),
    attachTimePickerAutoOpen(returnDateInput));
  try {
    (origenCalcInput &&
      origenCalcInput.addEventListener("input", invalidateOneWayCalculationUi),
      destinoCalcInput &&
        destinoCalcInput.addEventListener(
          "input",
          invalidateOneWayCalculationUi,
        ),
      fechaCalcInput &&
        (fechaCalcInput.addEventListener(
          "input",
          invalidateOneWayCalculationUi,
        ),
        fechaCalcInput.addEventListener(
          "change",
          invalidateOneWayCalculationUi,
        )),
      horaCalcInput &&
        (horaCalcInput.addEventListener("input", invalidateOneWayCalculationUi),
        horaCalcInput.addEventListener(
          "change",
          invalidateOneWayCalculationUi,
        )));
  } catch (_) {}
  function setMinDate() {
    const now = new Date(),
      offsetMinutes = now.getTimezoneOffset(),
      today = new Date(now.getTime() - 6e4 * offsetMinutes)
        .toISOString()
        .split("T")[0];
    (fechaCalcInput &&
      ((fechaCalcInput.min = today),
      fechaCalcInput.value || (fechaCalcInput.value = today)),
      returnDateInput &&
        ((returnDateInput.min = today), (returnDateInput.value = "")));
  }
  function getPickupDateTime(dateStr, timeStr) {
    try {
      if (!dateStr || !timeStr) throw new Error("Empty date or time");
      const pickupDateTime = new Date(`${dateStr}T${timeStr}`);
      if (isNaN(pickupDateTime.getTime())) throw new Error("Invalid date/time");
      return pickupDateTime;
    } catch (error) {
      return (
        console.error("Error parsing date/time:", error),
        alert(alerts.invalidDateTime),
        null
      );
    }
  }
  function formatPrice(amount) {
    const locale = LOCALES[CURRENT_LANG] || LOCALES.es || "es-ES";
    return amount.toLocaleString(locale, {
      style: "currency",
      currency: "EUR",
    });
  }
  function validateCalculator(dateStr, timeStr) {
    return !!getPickupDateTime(dateStr, timeStr);
  }
  function calculatePrice(
    origin,
    destination,
    dateStr,
    timeStr,
    tripType,
    tripId = null,
  ) {
    let btn;
    btn =
      "ida" === tripType
        ? calcForm.querySelector('button[type="submit"]')
        : "additional" === tripType
          ? calculateAdditionalTripBtn
          : calculateReturnPriceBtn;
    const originalBtnText = btn.innerHTML;
    ((btn.disabled = !0),
      (btn.innerHTML =
        '<i class="fas fa-spinner fa-spin"></i> ' + calcMsgs.calculating));
    let isFinished = !1;
    const restoreButton = () => {
        try {
          ((btn.disabled = !1), (btn.innerHTML = originalBtnText));
        } catch (_) {}
      },
      safetyTimer = setTimeout(() => {
        if (!isFinished) {
          ((isFinished = !0), restoreButton());
          try {
            alerts &&
              alerts.googleMapsNotLoaded &&
              alert(alerts.googleMapsNotLoaded);
          } catch (_) {}
        }
      }, 2e4);
    if (!googleApiLoaded || void 0 === google.maps.DirectionsService)
      return (
        console.error("DirectionsService is not available."),
        clearTimeout(safetyTimer),
        (isFinished = !0),
        void restoreButton()
      );
    const directionsService = new google.maps.DirectionsService();
    function buildDirectionsLocation(rawValue, selectedPlace) {
      return selectedPlace && selectedPlace.place_id
        ? { placeId: selectedPlace.place_id }
        : rawValue;
    }
    let originParam = origin,
      destinationParam = destination,
      destinationPlaceForPolicy = null,
      originPlaceForPolicy = null;
    "ida" === tripType
      ? ((originParam = buildDirectionsLocation(
          origin,
          autocompleteSelectedPlaces.origenCalc,
        )),
        (destinationParam = buildDirectionsLocation(
          destination,
          autocompleteSelectedPlaces.destinoCalc,
        )),
        (destinationPlaceForPolicy = autocompleteSelectedPlaces.destinoCalc),
        (originPlaceForPolicy = autocompleteSelectedPlaces.origenCalc))
      : "vuelta" === tripType
        ? ((originParam = buildDirectionsLocation(
            origin,
            autocompleteSelectedPlaces.origenVuelta,
          )),
          (destinationParam = buildDirectionsLocation(
            destination,
            autocompleteSelectedPlaces.destinoVuelta,
          )),
          (destinationPlaceForPolicy =
            autocompleteSelectedPlaces.destinoVuelta),
          (originPlaceForPolicy = autocompleteSelectedPlaces.origenVuelta))
        : "additional" === tripType &&
          ((originParam = buildDirectionsLocation(
            origin,
            autocompleteSelectedPlaces.additionalTripOrigen,
          )),
          (destinationParam = buildDirectionsLocation(
            destination,
            autocompleteSelectedPlaces.additionalTripDestino,
          )),
          (destinationPlaceForPolicy =
            autocompleteSelectedPlaces.additionalTripDestino),
          (originPlaceForPolicy =
            autocompleteSelectedPlaces.additionalTripOrigen));
    const forceColorado = tcShouldForceColorado(
        originPlaceForPolicy,
        origin,
        destinationPlaceForPolicy,
        destination,
      ),
      forceCadizWaypoint = tcShouldForceCadizWaypoint(
        originPlaceForPolicy,
        origin,
        destinationPlaceForPolicy,
        destination,
      ),
      routeCacheKey = buildDirectionsRouteCacheKey(
        originParam,
        destinationParam,
        forceColorado
          ? "via_colorado_corridor"
          : forceCadizWaypoint
            ? "via_cadiz_waypoint"
            : "",
      ),
      cachedRouteResponse =
        "ida" === tripType && routeCacheKey
          ? getDirectionsRouteCache(routeCacheKey)
          : null,
      ROUTE_THRESHOLDS_alphaDistance = 0.65,
      ROUTE_THRESHOLDS_betaTime = 0.35,
      ROUTE_THRESHOLDS_maxDistanceRatio = 1.35,
      ROUTE_THRESHOLDS_maxExtraMinutes = 12,
      routeMetrics = (route) => {
        try {
          if (!route || !route.legs || !route.legs.length) return null;
          let distanceM = 0,
            durationS = 0;
          return (
            route.legs.forEach((leg) => {
              ((distanceM +=
                leg.distance && leg.distance.value
                  ? Number(leg.distance.value)
                  : 0),
                (durationS +=
                  leg.duration && leg.duration.value
                    ? Number(leg.duration.value)
                    : 0));
            }),
            { distanceM: distanceM, durationS: durationS }
          );
        } catch (_) {
          return null;
        }
      },
      scoreRoute = (routes, idx) => {
        try {
          if (!routes || !routes.length) return Number.POSITIVE_INFINITY;
          const metricsList = routes.map(routeMetrics).filter(Boolean);
          if (!metricsList.length) return Number.POSITIVE_INFINITY;
          const minDistanceM = Math.min.apply(
              null,
              metricsList.map((m) => m.distanceM || Number.POSITIVE_INFINITY),
            ),
            minDurationS = Math.min.apply(
              null,
              metricsList.map((m) => m.durationS || Number.POSITIVE_INFINITY),
            ),
            m = routeMetrics(routes[idx]);
          if (!m) return Number.POSITIVE_INFINITY;
          const distanceRatio =
              minDistanceM > 0 ? m.distanceM / minDistanceM : 1,
            durationRatio = minDurationS > 0 ? m.durationS / minDurationS : 1;
          if (distanceRatio > ROUTE_THRESHOLDS_maxDistanceRatio) return 9999;
          if (
            (minDurationS > 0 ? (m.durationS - minDurationS) / 60 : 0) >
            ROUTE_THRESHOLDS_maxExtraMinutes
          )
            return 9999;
          return (
            ROUTE_THRESHOLDS_alphaDistance * distanceRatio +
            ROUTE_THRESHOLDS_betaTime * durationRatio
          );
        } catch (_) {
          return Number.POSITIVE_INFINITY;
        }
      },
      selectBestRouteIndexByScore = (routes) => {
        if (!routes || !routes.length) return 0;
        if (
          ((routes) => {
            if (!routes || routes.length < 2) return !1;
            try {
              const metricsList = routes.map(routeMetrics).filter(Boolean);
              if (!metricsList.length) return !1;
              Math.min.apply(
                null,
                metricsList.map((m) => m.distanceM || Number.POSITIVE_INFINITY),
              );
              const minDurationS = Math.min.apply(
                null,
                metricsList.map((m) => m.durationS || Number.POSITIVE_INFINITY),
              );
              return (
                Math.max.apply(
                  null,
                  metricsList.map((m) => m.durationS || 0),
                ) -
                  minDurationS <=
                240
              );
            } catch (_) {
              return !1;
            }
          })(routes)
        ) {
          let shortestIdx = 0,
            shortestDistance = Number.POSITIVE_INFINITY;
          for (let i = 0; i < routes.length; i++) {
            const metrics = routeMetrics(routes[i]);
            metrics &&
              metrics.distanceM < shortestDistance &&
              ((shortestDistance = metrics.distanceM), (shortestIdx = i));
          }
          return shortestIdx;
        }
        let bestIdx = 0,
          bestScore = scoreRoute(routes, 0);
        for (let i = 1; i < routes.length; i++) {
          const s = scoreRoute(routes, i);
          s < bestScore && ((bestScore = s), (bestIdx = i));
        }
        return bestIdx;
      },
      requestDirections = (request) =>
        new Promise((resolve) => {
          try {
            directionsService.route(request, (resp, st) =>
              resolve({ resp: resp, st: st }),
            );
          } catch (e) {
            resolve({ resp: null, st: "ERROR" });
          }
        });
    async function handleRouteResponse(response, status, attemptedFallback) {
      if (!isFinished)
        try {
          if (status === google.maps.DirectionsStatus.OK) {
            const picked = await (async (response) => {
                try {
                  const routes =
                    response && response.routes && response.routes.length
                      ? response.routes
                      : [];
                  if (!routes.length) return { route: null, usedColorado: !1 };
                  return {
                    route:
                      routes[selectBestRouteIndexByScore(routes)] || routes[0],
                    usedColorado: !1,
                  };
                } catch (_) {
                  return {
                    route:
                      response && response.routes && response.routes[0]
                        ? response.routes[0]
                        : null,
                    usedColorado: !1,
                  };
                }
              })(response),
              selectedRouteForCalc =
                picked && picked.route
                  ? picked.route
                  : response && response.routes && response.routes[0],
              effectiveResponse = selectedRouteForCalc
                ? { routes: [selectedRouteForCalc] }
                : response;
            try {
              if (
                "ida" === tripType &&
                routeCacheKey &&
                effectiveResponse &&
                effectiveResponse.routes &&
                effectiveResponse.routes.length
              ) {
                const bestRoute = effectiveResponse.routes[0],
                  leg0 = bestRoute && bestRoute.legs && bestRoute.legs[0];
                if (leg0) {
                  const minimalResponse = {
                    routes: [
                      {
                        overview_path: bestRoute.overview_path || null,
                        legs: [
                          {
                            distance: leg0.distance,
                            duration: leg0.duration,
                            start_address: leg0.start_address,
                            end_address: leg0.end_address,
                            start_location: leg0.start_location,
                            end_location: leg0.end_location,
                          },
                        ],
                      },
                    ],
                  };
                  setDirectionsRouteCache(routeCacheKey, minimalResponse);
                }
              }
            } catch (_) {}
            const fullRoute =
              effectiveResponse &&
              effectiveResponse.routes &&
              effectiveResponse.routes.length
                ? effectiveResponse.routes[0]
                : null;
            if (!fullRoute || !fullRoute.legs || !fullRoute.legs[0])
              throw new Error("Directions response missing route legs");
            const route = fullRoute,
              metrics = routeMetrics(fullRoute);
            let distanceKm = metrics ? metrics.distanceM / 1e3 : 0;
            const baseDistanceKm = distanceKm;
            let durationSeconds = metrics ? metrics.durationS : 0,
              durationText = tcFormatDurationFromSeconds(durationSeconds),
              tcNoReturnPricingApplied = !1;
            const fullPath = [];
            fullRoute.legs &&
              fullRoute.legs.forEach((leg) => {
                leg.steps
                  ? leg.steps.forEach((step) => {
                      step.path && step.path.forEach((p) => fullPath.push(p));
                    })
                  : leg.via_waypoints &&
                    Array.isArray(leg.path) &&
                    leg.path.forEach((p) => fullPath.push(p));
              });
            const finalPath =
                fullPath.length > 0 ? fullPath : fullRoute.overview_path || [],
              overviewPath = fullRoute.overview_path || [],
              perceivedDistanceKm = distanceKm,
              perceivedDurationSeconds = durationSeconds,
              perceivedDurationText = durationText,
              startLocRaw =
                route &&
                route.legs &&
                route.legs[0] &&
                route.legs[0].start_location
                  ? route.legs[0].start_location
                  : null,
              endLocRaw =
                route &&
                route.legs &&
                route.legs[0] &&
                route.legs[0].end_location
                  ? route.legs[0].end_location
                  : null,
              startLoc = startLocRaw
                ? {
                    lat:
                      "function" == typeof startLocRaw.lat
                        ? startLocRaw.lat()
                        : startLocRaw.lat,
                    lng:
                      "function" == typeof startLocRaw.lng
                        ? startLocRaw.lng()
                        : startLocRaw.lng,
                  }
                : null,
              endLoc = endLocRaw
                ? {
                    lat:
                      "function" == typeof endLocRaw.lat
                        ? endLocRaw.lat()
                        : endLocRaw.lat,
                    lng:
                      "function" == typeof endLocRaw.lng
                        ? endLocRaw.lng()
                        : endLocRaw.lng,
                  }
                : null;
            try {
              const pickupDistanceFromCenterM = tcHaversineMeters(
                  CONIL_CENTER_POINT,
                  startLoc,
                ),
                pickupOutside =
                  isFinite(pickupDistanceFromCenterM) &&
                  pickupDistanceFromCenterM > 2500,
                looksConilByTextOrPlace = (place, text, location) => {
                  try {
                    if (text) {
                      const normalizedText = tcNormalizeCityName(text);
                      if (
                        normalizedText.includes("santi petri") ||
                        normalizedText.includes("santipetri") ||
                        normalizedText.includes("sancti petri") ||
                        normalizedText.includes("sanctipetri")
                      )
                        return !1;
                    }
                    if (location && "function" == typeof tcHaversineMeters) {
                      const lat =
                          "function" == typeof location.lat
                            ? location.lat()
                            : location.lat,
                        lng =
                          "function" == typeof location.lng
                            ? location.lng()
                            : location.lng;
                      if (isFinite(lat) && isFinite(lng)) {
                        if (
                          lat >= CONIL_MUNICIPALITY_BOUNDS.south &&
                          lat <= CONIL_MUNICIPALITY_BOUNDS.north &&
                          lng >= CONIL_MUNICIPALITY_BOUNDS.west &&
                          lng <= CONIL_MUNICIPALITY_BOUNDS.east
                        )
                          return !0;
                      }
                    }
                    const norm = tcNormalizeCityName(text || "");
                    if (norm.includes("conil")) return !0;
                    if (text && text.includes("11140")) return !0;
                    if (
                      text &&
                      text.toLowerCase().includes("conil de la frontera")
                    )
                      return !0;
                    const textLower = (text || "").toLowerCase();
                    for (const zone of CONIL_MUNICIPALITY_ZONES)
                      if (textLower.includes(zone)) return !0;
                    if (
                      place &&
                      place.address_components &&
                      Array.isArray(place.address_components)
                    ) {
                      if (
                        place.address_components.some((comp) => {
                          const compTypes = comp.types || [],
                            isRelevantType = [
                              "locality",
                              "administrative_area_level_3",
                              "administrative_area_level_2",
                            ].some((t) => compTypes.includes(t)),
                            compName = tcNormalizeCityName(
                              comp.long_name || comp.short_name || "",
                            );
                          return isRelevantType && compName.includes("conil");
                        })
                      )
                        return !0;
                    }
                    if (location && "function" == typeof tcHaversineMeters) {
                      const distanceFromCenterM = tcHaversineMeters(
                        CONIL_CENTER_POINT,
                        location,
                      );
                      if (
                        isFinite(distanceFromCenterM) &&
                        distanceFromCenterM <= 2500
                      )
                        return !0;
                    }
                    return !1;
                  } catch (_) {
                    return !1;
                  }
                },
                originIsConilMunicipality = looksConilByTextOrPlace(
                  originPlaceForPolicy,
                  origin,
                  startLoc,
                ),
                destinationIsConilMunicipality = looksConilByTextOrPlace(
                  destinationPlaceForPolicy,
                  destination,
                  endLoc,
                );
              let distToCenterM = null,
                passesNearCenter = !1,
                distToCorridorM = null,
                passesReturnCorridor = !1,
                destinationDistanceFromCenterM = null,
                destinationIsNearConil = !1;
              overviewPath &&
                overviewPath.length &&
                ((distToCenterM = tcMinDistanceMetersToPoints(overviewPath, [
                  CONIL_CENTER_POINT,
                ])),
                (passesNearCenter =
                  isFinite(distToCenterM) && distToCenterM <= 2500),
                (passesReturnCorridor = overviewPath.some((point) =>
                  isInReturnCorridorBounds(point),
                )),
                (destinationDistanceFromCenterM = tcHaversineMeters(
                  CONIL_CENTER_POINT,
                  endLoc,
                )),
                (destinationIsNearConil =
                  isFinite(destinationDistanceFromCenterM) &&
                  destinationDistanceFromCenterM <= 2500));
              try {
                "undefined" != typeof window &&
                  window.TC_DEBUG_KM &&
                  console.info("[TC km-operativos]", {
                    pickupOutside: pickupOutside,
                    pickupDistanceFromCenterM: pickupDistanceFromCenterM,
                    distToCenterM: distToCenterM,
                    passesNearCenter: passesNearCenter,
                    distToCorridorM: distToCorridorM,
                    passesReturnCorridor: passesReturnCorridor,
                    baseDistanceKm: distanceKm,
                  });
              } catch (_) {}
              const originLat =
                  "function" == typeof startLoc.lat
                    ? startLoc.lat()
                    : startLoc.lat,
                originLng =
                  "function" == typeof startLoc.lng
                    ? startLoc.lng()
                    : startLoc.lng;
              if (
                !originIsConilMunicipality &&
                destinationIsConilMunicipality &&
                !destinationIsNearConil &&
                (originLat > CONIL_CENTER_POINT.lat ||
                  originLng > CONIL_CENTER_POINT.lng) &&
                !passesReturnCorridor
              ) {
                const extraResp = await requestDirections({
                    origin: CONIL_CENTER_ADDRESS,
                    destination: destinationParam,
                    travelMode: google.maps.TravelMode.DRIVING,
                  }),
                  extraRoute =
                    extraResp &&
                    extraResp.resp &&
                    extraResp.resp.routes &&
                    extraResp.resp.routes[0]
                      ? extraResp.resp.routes[0]
                      : null,
                  extraLeg0 =
                    extraRoute && extraRoute.legs && extraRoute.legs[0]
                      ? extraRoute.legs[0]
                      : null,
                  extraDistanceKm =
                    extraLeg0 && extraLeg0.distance && extraLeg0.distance.value
                      ? Number(extraLeg0.distance.value) / 1e3
                      : 0,
                  extraDurationSeconds =
                    extraLeg0 && extraLeg0.duration && extraLeg0.duration.value
                      ? Number(extraLeg0.duration.value)
                      : 0;
                (isFinite(extraDistanceKm) &&
                  extraDistanceKm > 0 &&
                  ((distanceKm += extraDistanceKm),
                  (tcNoReturnPricingApplied = !0)),
                  isFinite(extraDurationSeconds) &&
                    extraDurationSeconds > 0 &&
                    ((durationSeconds += extraDurationSeconds),
                    (durationText =
                      tcFormatDurationFromSeconds(durationSeconds))));
              }
              const isFarFromCenter = pickupDistanceFromCenterM > 3500;
              try {
                const startLocLat =
                    "function" == typeof startLoc.lat
                      ? startLoc.lat()
                      : startLoc.lat,
                  startLocLng =
                    "function" == typeof startLoc.lng
                      ? startLoc.lng()
                      : startLoc.lng,
                  endLocLat =
                    "function" == typeof endLoc.lat ? endLoc.lat() : endLoc.lat,
                  endLocLng =
                    "function" == typeof endLoc.lng ? endLoc.lng() : endLoc.lng;
              } catch (_) {}
              if (
                pickupOutside &&
                originIsConilMunicipality &&
                overviewPath &&
                overviewPath.length &&
                !destinationIsConilMunicipality &&
                (isFarFromCenter ||
                  (!passesNearCenter && !passesReturnCorridor))
              ) {
                const extraResp = await requestDirections({
                    origin: CONIL_CENTER_ADDRESS,
                    destination: originParam,
                    travelMode: google.maps.TravelMode.DRIVING,
                  }),
                  extraRoute =
                    extraResp &&
                    extraResp.resp &&
                    extraResp.resp.routes &&
                    extraResp.resp.routes[0]
                      ? extraResp.resp.routes[0]
                      : null,
                  extraLeg0 =
                    extraRoute && extraRoute.legs && extraRoute.legs[0]
                      ? extraRoute.legs[0]
                      : null,
                  extraDistanceKm =
                    extraLeg0 && extraLeg0.distance && extraLeg0.distance.value
                      ? Number(extraLeg0.distance.value) / 1e3
                      : 0,
                  extraDurationSeconds =
                    extraLeg0 && extraLeg0.duration && extraLeg0.duration.value
                      ? Number(extraLeg0.duration.value)
                      : 0;
                (isFinite(extraDistanceKm) &&
                  extraDistanceKm > 0 &&
                  ((distanceKm += extraDistanceKm),
                  (tcNoReturnPricingApplied = !0)),
                  isFinite(extraDurationSeconds) &&
                    extraDurationSeconds > 0 &&
                    ((durationSeconds += extraDurationSeconds),
                    (durationText =
                      tcFormatDurationFromSeconds(durationSeconds))));
                try {
                  "undefined" != typeof window &&
                    window.TC_DEBUG_KM &&
                    console.info("[TC km-operativos] extra", {
                      extraDistanceKm: extraDistanceKm,
                      extraDurationSeconds: extraDurationSeconds,
                      finalDistanceKm: distanceKm,
                      finalDurationSeconds: durationSeconds,
                    });
                } catch (_) {}
              }
            } catch (_) {}
            const pickupDateTime = getPickupDateTime(dateStr, timeStr),
              endDateTime = new Date(
                pickupDateTime.getTime() + 1e3 * durationSeconds,
              );
            let calculatedPrice = 0;
            const getRateForDateTime = (dt) => {
                const day = dt.getDay(),
                  hour = dt.getHours();
                const minute = dt.getMinutes();
                const totalMinutes = hour * 60 + minute;
                return isConilHoliday(dt) ||
                  0 === day ||
                  6 === day ||
                  totalMinutes >= 21 * 60 + 45 ||
                  hour < 7
                  ? RATE_WEEKEND_NIGHT
                  : RATE_WEEKDAY;
              },
              segments = [];
            let remainingSeconds = durationSeconds,
              currentTime = new Date(pickupDateTime);
            const maxSegments = 64;
            let safetyCounter = 0;
            for (
              ;
              remainingSeconds > 0 &&
              currentTime < endDateTime &&
              safetyCounter < maxSegments;
            ) {
              safetyCounter += 1;
              const currentRate = getRateForDateTime(currentTime),
                nextDayBoundary = new Date(currentTime);
              (nextDayBoundary.setHours(7, 0, 0, 0),
                nextDayBoundary <= currentTime &&
                  nextDayBoundary.setDate(nextDayBoundary.getDate() + 1));
              const nextNightBoundary = new Date(currentTime);
              (nextNightBoundary.setHours(21, 45, 0, 0),
                nextNightBoundary <= currentTime &&
                  nextNightBoundary.setDate(nextNightBoundary.getDate() + 1));
              let nextBoundary = endDateTime;
              (nextDayBoundary > currentTime &&
                nextDayBoundary < nextBoundary &&
                (nextBoundary = nextDayBoundary),
                nextNightBoundary > currentTime &&
                  nextNightBoundary < nextBoundary &&
                  (nextBoundary = nextNightBoundary));
              const deltaSeconds = Math.min(
                (nextBoundary.getTime() - currentTime.getTime()) / 1e3,
                remainingSeconds,
              );
              if (deltaSeconds <= 0) break;
              (segments.push({ seconds: deltaSeconds, rate: currentRate }),
                (remainingSeconds -= deltaSeconds),
                (currentTime = new Date(
                  currentTime.getTime() + 1e3 * deltaSeconds,
                )));
            }
            if (segments.length) {
              let totalSegSeconds = 0;
              for (const seg of segments) totalSegSeconds += seg.seconds;
              let priceBySegments = 0;
              for (const seg of segments) {
                priceBySegments +=
                  distanceKm * (seg.seconds / totalSegSeconds) * seg.rate;
              }
              calculatedPrice = priceBySegments;
            } else {
              calculatedPrice = distanceKm * getRateForDateTime(pickupDateTime);
            }
            calculatedPrice += FLAG_FALL;
            let surcharge = 0;
            (distanceKm > 400 && (surcharge = 5),
              (calculatedPrice += surcharge));
            let tcNoReturnDiscountApplied = !1;
            const discountZoneInfoOrigin = isOriginInDiscountZone(startLoc),
              discountZoneInfoDestination = isOriginInDiscountZone(endLoc),
              isCadizWaypointForced =
                "undefined" != typeof window &&
                window.tcLastDirectionsRequest &&
                window.tcLastDirectionsRequest.forceCadizWaypoint,
              discountZoneInfo = discountZoneInfoOrigin.inZone
                ? discountZoneInfoOrigin
                : discountZoneInfoDestination,
              shouldApplyDiscount =
                discountZoneInfo.inZone ||
                (isCadizWaypointForced &&
                  (discountZoneInfoOrigin.inZone ||
                    discountZoneInfoDestination.inZone));
            tcNoReturnPricingApplied &&
              isFinite(baseDistanceKm) &&
              baseDistanceKm > 27 &&
              shouldApplyDiscount &&
              ((calculatedPrice = Math.max(
                0,
                calculatedPrice - discountZoneInfo.discount,
              )),
              (tcNoReturnDiscountApplied = !0));
            const rawPrice = calculatedPrice;
            let finalPrice = rawPrice,
              isMinPrice = !1;
            rawPrice < 45 && ((finalPrice = 45), (isMinPrice = !0));
            try {
              "undefined" != typeof window &&
                window.TC_DEBUG_KM &&
                console.info("[TC km-operativos] price", {
                  distanceKm: distanceKm,
                  baseDistanceKm: baseDistanceKm,
                  tcNoReturnPricingApplied: tcNoReturnPricingApplied,
                  tcNoReturnDiscountApplied: tcNoReturnDiscountApplied,
                  discountApplied: tcNoReturnDiscountApplied
                    ? discountZoneInfo.discount
                    : 0,
                  rawPrice: rawPrice,
                  finalPrice: finalPrice,
                  isMinPrice: isMinPrice,
                  minPrice: 45,
                });
            } catch (_) {}
            if ("ida" === tripType) {
              let originDisplay = route.start_address,
                destinationDisplay = route.end_address;
              try {
                if (void 0 !== autocompleteSelectedPlaces) {
                  const originPlace = autocompleteSelectedPlaces.origenCalc,
                    destinationPlace = autocompleteSelectedPlaces.destinoCalc,
                    buildDisplayFromPlace = (place, fallback) => {
                      if (!place || !place.place_id) return fallback;
                      const name = (place.name || "").trim(),
                        formatted = (place.formatted_address || "").trim(),
                        normalizeForCompare = (s) =>
                          s
                            ? String(s)
                                .toLowerCase()
                                .replace(/\bcalle\b/g, "c/")
                                .replace(/\bavenida\b/g, "av.")
                                .replace(/\bavda\.?\b/g, "av.")
                                .replace(/\bc\/?\b/g, "c/")
                                .replace(/[\s,\.\-·]+/g, " ")
                                .trim()
                            : "";
                      if (name) {
                        let labelName = simplifyAirportName(name) || name;
                        try {
                          const cityFromPlace = tcGetLocalityFromPlace(place),
                            cityTrim = cityFromPlace
                              ? String(cityFromPlace).trim()
                              : "";
                          cityTrim &&
                            !labelName
                              .toLowerCase()
                              .includes(cityTrim.toLowerCase()) &&
                            (labelName = labelName + ", " + cityTrim);
                        } catch (_) {}
                        if (formatted) {
                          const shortAddress =
                            buildShortAddressLabel(formatted);
                          if (shortAddress) {
                            const n1 = normalizeForCompare(labelName),
                              n2 = normalizeForCompare(shortAddress);
                            if (n1 && n2 && n1 !== n2)
                              return labelName + " · " + shortAddress;
                          }
                        }
                        return labelName;
                      }
                      return formatted
                        ? buildShortAddressLabel(formatted)
                        : fallback;
                    };
                  ((originDisplay = buildDisplayFromPlace(
                    originPlace,
                    originDisplay,
                  )),
                    (destinationDisplay = buildDisplayFromPlace(
                      destinationPlace,
                      destinationDisplay,
                    )));
                }
              } catch (_) {}
              if (
                ((currentCalculation.origin = originDisplay),
                (currentCalculation.destination = destinationDisplay),
                (currentCalculation.distanceKm = perceivedDistanceKm),
                (currentCalculation.durationSeconds = perceivedDurationSeconds),
                (currentCalculation.durationText = perceivedDurationText),
                (currentCalculation.billedDistanceKm = distanceKm),
                (currentCalculation.billedDurationSeconds = durationSeconds),
                (currentCalculation.billedDurationText = durationText),
                (currentCalculation.pickupDateTime = pickupDateTime),
                (currentCalculation.rawPrice = rawPrice),
                (currentCalculation.totalPriceOneWay = isMinPrice
                  ? rawPrice
                  : finalPrice),
                // Guardar el precio del trayecto de ida en currentBookingDetails
                currentBookingDetails &&
                  (currentBookingDetails.oneWayPrice = isMinPrice
                    ? rawPrice
                    : finalPrice),
                (currentCalculation.isBelowMinPrice = isMinPrice),
                (currentCalculation.isMinPriceApplied = !1),
                (currentCalculation.lastRequestKey = [
                  origin,
                  destination,
                  dateStr,
                  timeStr,
                ].join("||")),
                (currentRouteOverviewPath =
                  finalPath && finalPath.length
                    ? finalPath
                    : fullRoute.overview_path || null),
                (currentRouteStartLocation =
                  route &&
                  route.legs &&
                  route.legs[0] &&
                  route.legs[0].start_location
                    ? route.legs[0].start_location
                    : null),
                (currentRouteEndLocation =
                  route &&
                  route.legs &&
                  route.legs[0] &&
                  route.legs[0].end_location
                    ? route.legs[0].end_location
                    : null),
                (!currentRouteStartLocation || !currentRouteEndLocation) &&
                  currentRouteOverviewPath &&
                  currentRouteOverviewPath.length)
              )
                try {
                  (currentRouteStartLocation ||
                    (currentRouteStartLocation = currentRouteOverviewPath[0]),
                    currentRouteEndLocation ||
                      (currentRouteEndLocation =
                        currentRouteOverviewPath[
                          currentRouteOverviewPath.length - 1
                        ]));
                } catch (_) {}
              if (
                ((currentRouteBounds = null),
                currentRouteOverviewPath && currentRouteOverviewPath.length)
              )
                try {
                  const bounds = new google.maps.LatLngBounds();
                  (currentRouteOverviewPath.forEach((p) => bounds.extend(p)),
                    (currentRouteBounds = bounds));
                } catch (_) {}
              try {
                "undefined" != typeof window &&
                  ((window.currentRouteOverviewPath = currentRouteOverviewPath),
                  (window.__tc_debug = window.__tc_debug || {}),
                  (window.__tc_debug.lastIdaPathLen = Array.isArray(
                    currentRouteOverviewPath,
                  )
                    ? currentRouteOverviewPath.length
                    : 0));
              } catch (_) {}
              return (
                (btn.disabled = !1),
                (btn.innerHTML = originalBtnText),
                displayCalculationResultInternal(
                  isMinPrice ? rawPrice : finalPrice,
                  perceivedDistanceKm,
                  perceivedDurationText,
                ),
                resetBookingForm(),
                populateBookingForm(),
                totalPriceSection && showElement(totalPriceSection),
                void updateTotalPriceAmount()
              );
            }
            if ("additional" === tripType)
              return (
                (btn.disabled = !1),
                (btn.innerHTML = originalBtnText),
                void displayAdditionalTripResult(
                  perceivedDistanceKm,
                  perceivedDurationText,
                  finalPrice,
                  fullRoute,
                  isMinPrice,
                )
              );
            if (
              (currentBookingDetails &&
                ((currentBookingDetails.returnDistanceKm = perceivedDistanceKm),
                (currentBookingDetails.returnDurationText =
                  perceivedDurationText),
                (currentBookingDetails.returnBilledDistanceKm = distanceKm),
                (currentBookingDetails.returnBilledDurationText = durationText),
                (currentBookingDetails.returnBilledDurationSeconds =
                  durationSeconds),
                (currentBookingDetails.returnRawPrice = rawPrice),
                (currentBookingDetails.returnPrice = finalPrice),
                (currentBookingDetails.returnOrigin = route.start_address),
                (currentBookingDetails.returnDestination = route.end_address),
                (currentBookingDetails.returnPickupDateTime = pickupDateTime)),
              (currentReturnRouteOverviewPath =
                finalPath && finalPath.length
                  ? finalPath
                  : fullRoute.overview_path || null),
              (currentReturnRouteStartLocation =
                route &&
                route.legs &&
                route.legs[0] &&
                route.legs[0].start_location
                  ? route.legs[0].start_location
                  : null),
              (currentReturnRouteEndLocation =
                route &&
                route.legs &&
                route.legs[0] &&
                route.legs[0].end_location
                  ? route.legs[0].end_location
                  : null),
              (!currentReturnRouteStartLocation ||
                !currentReturnRouteEndLocation) &&
                currentReturnRouteOverviewPath &&
                currentReturnRouteOverviewPath.length)
            )
              try {
                (currentReturnRouteStartLocation ||
                  (currentReturnRouteStartLocation =
                    currentReturnRouteOverviewPath[0]),
                  currentReturnRouteEndLocation ||
                    (currentReturnRouteEndLocation =
                      currentReturnRouteOverviewPath[
                        currentReturnRouteOverviewPath.length - 1
                      ]));
              } catch (_) {}
            if (
              ((currentReturnRouteBounds = null),
              currentReturnRouteOverviewPath &&
                currentReturnRouteOverviewPath.length)
            )
              try {
                const bounds = new google.maps.LatLngBounds();
                (currentReturnRouteOverviewPath.forEach((p) =>
                  bounds.extend(p),
                ),
                  (currentReturnRouteBounds = bounds));
              } catch (_) {}
            try {
              "undefined" != typeof window &&
                ((window.currentReturnRouteOverviewPath =
                  currentReturnRouteOverviewPath),
                (window.__tc_debug = window.__tc_debug || {}),
                (window.__tc_debug.lastVueltaPathLen = Array.isArray(
                  currentReturnRouteOverviewPath,
                )
                  ? currentReturnRouteOverviewPath.length
                  : 0));
            } catch (_) {}
            try {
              0;
            } catch (_) {}
            (displayReturnCalculationResult(
              rawPrice,
              perceivedDistanceKm,
              perceivedDurationText,
              isMinPrice,
            ),
              updateTotalPriceAmount());
          } else if (
            !attemptedFallback &&
            status === google.maps.DirectionsStatus.ZERO_RESULTS &&
            ((originParam &&
              "object" == typeof originParam &&
              originParam.placeId) ||
              (destinationParam &&
                "object" == typeof destinationParam &&
                destinationParam.placeId))
          ) {
            const fallbackOrigin = origin,
              fallbackDestination = destination;
            directionsService.route(
              {
                origin: fallbackOrigin,
                destination: fallbackDestination,
                travelMode: google.maps.TravelMode.DRIVING,
                provideRouteAlternatives: !1,
              },
              (response2, status2) => {
                if (
                  status2 === google.maps.DirectionsStatus.OK &&
                  response2 &&
                  response2.routes &&
                  response2.routes.length > 0
                ) {
                  const selectedRoute = selectBestRoute(response2.routes);
                  selectedRoute && (response2.routes = [selectedRoute]);
                }
                handleRouteResponse(response2, status2, !0);
              },
            );
          } else
            status === google.maps.DirectionsStatus.ZERO_RESULTS &&
            alerts &&
            alerts.routeRestrictedArea
              ? alert(alerts.routeRestrictedArea)
              : (console.error("Directions request failed due to " + status),
                alert(alerts.routeCalculationFailed(status)));
        } catch (e) {
          console.error("Error handling route calculation:", e);
          try {
            if (alerts && alerts.routeCalculationFailed) {
              const errorMsg =
                e && e.message
                  ? e.message
                  : e && e.toString
                    ? e.toString()
                    : "ERROR";
              alert(alerts.routeCalculationFailed(errorMsg));
            }
          } catch (_) {}
        } finally {
          (clearTimeout(safetyTimer), (isFinished = !0), restoreButton());
        }
    }
    if (cachedRouteResponse)
      return void handleRouteResponse(
        cachedRouteResponse,
        google.maps.DirectionsStatus.OK,
        !1,
      ).catch(() => {});
    try {
      window.tcLastDirectionsRequest = {
        origin: origin,
        destination: destination,
        tripType: tripType,
        forceColorado: forceColorado,
        forceCadizWaypoint: forceCadizWaypoint,
        avoidHighways: !1,
      };
    } catch (_) {}
    const baseRequest = {
        origin: originParam,
        destination: destinationParam,
        travelMode: google.maps.TravelMode.DRIVING,
        provideRouteAlternatives: !1,
      },
      corridorWaypoints = [
        { location: TC_FORCE_COLORADO_WAYPOINT, stopover: !1 },
      ],
      matchesCadiz = (city) => {
        if (!city) return !1;
        const normalizedCity = tcNormalizeCityName(city);
        return ["cadiz", "cádiz", "plaza san juan de dios", "san juan de dios", "plaza sanjuan de dios", "sanjuan de dios"].some((c) => {
          const normalizedVariant = tcNormalizeCityName(c);
          return (
            city === normalizedVariant ||
            normalizedCity.includes(normalizedVariant)
          );
        });
      },
      originIsCadiz = matchesCadiz(tcNormalizeCityName(origin)),
      cadizWaypoints = [
        {
          location: tripType === "vuelta"
            ? TC_CADIZ_WAYPOINT_FROM_CONIL
            : matchesCadiz(tcNormalizeCityName(destination))
            ? TC_CADIZ_WAYPOINT_TO_CONIL
            : originIsCadiz
              ? TC_CADIZ_WAYPOINT_FROM_CONIL
              : TC_CADIZ_WAYPOINT_TO_CONIL,
          stopover: !1,
        },
      ];
    let waypoints = [],
      forcePolicy = !1,
      policyName = "";
    forceCadizWaypoint && !forceColorado
      ? ((waypoints = cadizWaypoints),
        (forcePolicy = !0),
        (policyName = "Cadiz waypoint only"))
      : forceColorado && !forceCadizWaypoint
        ? ((waypoints = corridorWaypoints),
          (forcePolicy = !0),
          (policyName = "Colorado corridor only"))
        : forceColorado && forceCadizWaypoint
          ? ((waypoints = tripType === "vuelta"
              ? [...cadizWaypoints, ...corridorWaypoints]
              : originIsCadiz
              ? [...cadizWaypoints, ...corridorWaypoints]
              : [...corridorWaypoints, ...cadizWaypoints]),
            (forcePolicy = !0),
            (policyName = tripType === "vuelta"
              ? "Vuelta: Cadiz → Colorado waypoints"
              : originIsCadiz
              ? "Ida: Cadiz → Colorado waypoints"
              : "Ida: Colorado → Cadiz waypoints"))
          : forceColorado
            ? ((waypoints = corridorWaypoints),
              (forcePolicy = !0),
              (policyName = "Colorado corridor"))
            : forceCadizWaypoint &&
              ((waypoints = cadizWaypoints),
              (forcePolicy = !0),
              (policyName = "Cadiz waypoint"));
    const requestWithPolicy = forcePolicy
      ? Object.assign({}, baseRequest, {
          waypoints: waypoints,
          optimizeWaypoints: !0,
          provideRouteAlternatives: !1,
        })
      : baseRequest;
    directionsService.route(requestWithPolicy, (response, status) => {
      if (forcePolicy && status !== google.maps.DirectionsStatus.OK)
        return (
          console.warn("[TC]", policyName, "route failed, status:", status),
          void directionsService.route(baseRequest, (response2, status2) => {
            handleRouteResponse(response2, status2, !1);
          })
        );
      if (
        status === google.maps.DirectionsStatus.OK &&
        response &&
        response.routes &&
        response.routes.length > 0
      ) {
        const selectedRoute = selectBestRoute(response.routes);
        selectedRoute && (response.routes = [selectedRoute]);
      }
      handleRouteResponse(response, status, !1);
    });
  }
  (setMinDate(),
    calcForm &&
      calcForm.addEventListener("submit", async (e) => {
        (e.preventDefault(),
          hideElementSmooth(calcResultDiv),
          hideElement(bookingFormWrapper),
          hideElement(formErrorMessage));
        const originValue = origenCalcInput ? origenCalcInput.value.trim() : "",
          destinationValue = destinoCalcInput
            ? destinoCalcInput.value.trim()
            : "",
          addressErrors = [],
          originHasAutocomplete = !!autocompleteInstances.origenCalc,
          destinationHasAutocomplete = !!autocompleteInstances.destinoCalc,
          originHasSelection = !!(
            autocompleteSelectedPlaces &&
            autocompleteSelectedPlaces.origenCalc &&
            autocompleteSelectedPlaces.origenCalc.place_id
          ),
          destinationHasSelection = !!(
            autocompleteSelectedPlaces &&
            autocompleteSelectedPlaces.destinoCalc &&
            autocompleteSelectedPlaces.destinoCalc.place_id
          ),
          hasSelectedOriginPlace = originHasSelection,
          hasSelectedDestinationPlace = destinationHasSelection;
        if (
          ((!originValue || (originHasAutocomplete && !originHasSelection)) &&
            validationMsgs &&
            validationMsgs.errorCalcOriginRequired &&
            addressErrors.push(validationMsgs.errorCalcOriginRequired),
          (!destinationValue ||
            (destinationHasAutocomplete && !destinationHasSelection)) &&
            validationMsgs &&
            validationMsgs.errorCalcDestinationRequired &&
            addressErrors.push(validationMsgs.errorCalcDestinationRequired),
          addressErrors.length > 0)
        ) {
          const baseMsg =
              validationMsgs && validationMsgs.reviewFieldsBase
                ? validationMsgs.reviewFieldsBase
                : "",
            detail = addressErrors.map((msg) => "• " + msg).join("\n");
          return (
            alert((baseMsg ? baseMsg + "\n\n" : "") + detail),
            void (originValue && hasSelectedOriginPlace
              ? (destinationValue && hasSelectedDestinationPlace) ||
                (destinoCalcInput &&
                  "function" == typeof destinoCalcInput.focus &&
                  destinoCalcInput.focus())
              : origenCalcInput &&
                "function" == typeof origenCalcInput.focus &&
                origenCalcInput.focus())
          );
        }
        if (validateCalculator(fechaCalcInput.value, horaCalcInput.value)) {
          try {
            googleMapsAllowNotLoadedAlert = !0;
          } catch (_) {}
          try {
            tcTrackEvent("click_calcular_ida", { trip_type: "ida" });
          } catch (_) {}
          const requestKey = [
            origenCalcInput ? origenCalcInput.value.trim() : "",
            destinoCalcInput ? destinoCalcInput.value.trim() : "",
            fechaCalcInput.value,
            horaCalcInput.value,
          ].join("||");
          if (
            currentCalculation &&
            currentCalculation.totalPriceOneWay > 0 &&
            currentCalculation.lastRequestKey === requestKey
          )
            return (
              displayCalculationResultInternal(
                currentCalculation.totalPriceOneWay,
                currentCalculation.distanceKm,
                currentCalculation.durationText,
              ),
              resetBookingForm(),
              populateBookingForm(),
              totalPriceSection && showElement(totalPriceSection),
              void updateTotalPriceAmount()
            );
          try {
            await loadGoogleMapsIfNeeded();
          } catch (_) {
            try {
              alerts &&
                alerts.googleMapsNotLoaded &&
                alert(alerts.googleMapsNotLoaded);
            } catch (_) {}
            return;
          }
          if (googleApiLoaded)
            calculatePrice(
              origenCalcInput.value,
              destinoCalcInput.value,
              fechaCalcInput.value,
              horaCalcInput.value,
              "ida",
            );
          else {
            console.error(
              "Google Maps API is not marked as loaded after loadGoogleMapsIfNeeded call.",
            );
            try {
              alerts &&
                alerts.googleMapsNotLoaded &&
                alert(alerts.googleMapsNotLoaded);
            } catch (_) {}
          }
        }
      }));
  try {
    const urlParams = new URLSearchParams(window.location.search);
    if ("1" === urlParams.get("tc_autotest")) {
      const today = new Date(),
        pad2 = (n) => String(n).padStart(2, "0"),
        dateForInput = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate() + 1,
        ),
        dateStr = [
          dateForInput.getFullYear(),
          pad2(dateForInput.getMonth() + 1),
          pad2(dateForInput.getDate()),
        ].join("-"),
        timeStr = "12:00",
        tests = [
          {
            name: "Conil -> Sevilla",
            origin: "Conil de la Frontera, Cádiz, España",
            destination: "Sevilla, España",
          },
          {
            name: "Cádiz -> Sevilla",
            origin: "Cádiz, España",
            destination: "Sevilla, España",
          },
          {
            name: "Sevilla -> Cádiz",
            origin: "Sevilla, España",
            destination: "Cádiz, España",
          },
          {
            name: "Conil -> Chiclana",
            origin: "Conil de la Frontera, Cádiz, España",
            destination: "Chiclana de la Frontera, Cádiz, España",
          },
        ];
      let idx = 0;
      const runNext = async () => {
        if (idx >= tests.length) return;
        const t = tests[idx++];
        try {
        } catch (_) {}
        try {
          await loadGoogleMapsIfNeeded();
        } catch (_) {}
        try {
          calculatePrice(t.origin, t.destination, dateStr, timeStr, "ida");
        } catch (_) {}
        setTimeout(runNext, 4500);
      };
      setTimeout(runNext, 800);
    }
  } catch (_) {}
  function displayCalculationResultInternal(
    price,
    distance,
    duration,
    options,
  ) {
    (currentCalculation &&
      currentCalculation.origin &&
      escapeHtml(currentCalculation.origin),
      currentCalculation &&
        currentCalculation.destination &&
        escapeHtml(currentCalculation.destination));
    ((routeMapInstance = null),
      (routeMapPolyline = null),
      (routeMapMarkers = []));
    const routeMapInfoHtml =
      "function" == typeof isHandheldMobileDevice && isHandheldMobileDevice()
        ? ""
        : `\n        <div class="route-map-info">\n          <div class="route-map-chip">\n            <span class="route-map-chip-main">${distance.toFixed(1)} km · ${duration}</span>\n          </div>\n        </div>\n      `;
    ((calcResultDiv.innerHTML = `\n      <div class="result-details">\n        <div class="detail-item">${getMessagesSection("calc").distanceLabel}: <strong>${distance.toFixed(1)} km</strong></div>\n        <div class="detail-item">${getMessagesSection("calc").durationLabel}: <strong>${duration}</strong></div>\n      </div>\n      <p>${getMessagesSection("calc").totalPriceIntro}</p>\n      <p class="final-price">${formatPrice(price)}</p>\n      <div class="route-map-toggle-wrapper">\n        <button type="button" id="toggle-route-map-btn" class="btn route-map-toggle-btn" aria-expanded="false" aria-controls="route-map-container">\n          ${getMessagesSection("calc").viewRouteButton} <span class="route-toggle-icon">&#9662;</span>\n        </button>\n      </div>\n      <div id="route-map-container" class="route-map-container" aria-hidden="true">\n        ${routeMapInfoHtml}\n        <div id="route-map" class="route-map" role="img" aria-label="${distance.toFixed(1)} km, ${duration}"></div>\n      </div>\n      <div class="calculation-buttons">\n        <button type="button" id="cancel-calc-btn" class="btn btn-light">${getMessagesSection("calc").cancelButton}</button>\n        <button type="button" id="continue-booking-btn" class="btn btn-primary">${getMessagesSection("calc").continueBookingButton}</button>\n        <div id="one-way-included-success" class="return-included-success" aria-live="polite" style="display:none;"></div>\n      </div>\n    `),
      showElement(calcResultDiv));
    try {
      if (
        googleApiLoaded &&
        "undefined" != typeof google &&
        google.maps &&
        void 0 !== google.maps.Map
      ) {
        const routeMapElement = document.getElementById("route-map");
        if (
          routeMapElement &&
          currentRouteOverviewPath &&
          currentRouteOverviewPath.length
        ) {
          const initialCenter =
            currentRouteOverviewPath[0] || currentRouteStartLocation;
          initialCenter &&
            (routeMapInstance
              ? (routeMapInstance.setCenter(initialCenter),
                routeMapInstance.setZoom(11))
              : (routeMapInstance = new google.maps.Map(routeMapElement, {
                  center: initialCenter,
                  zoom: 11,
                  disableDefaultUI: !0,
                  clickableIcons: !1,
                  gestureHandling: "greedy",
                  mapId: TC_GOOGLE_MAP_ID,
                })));
        }
      }
    } catch (_) {}
    if (!!(!options || !options.skipScroll))
      try {
        calcResultDiv &&
          "function" == typeof calcResultDiv.scrollIntoView &&
          calcResultDiv.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch (_) {}
    const toggleBtn = document.getElementById("toggle-route-map-btn"),
      mapContainer = document.getElementById("route-map-container"),
      cancelCalcBtn = document.getElementById("cancel-calc-btn");
    (cancelCalcBtn &&
      cancelCalcBtn.addEventListener("click", function (e) {
        e.preventDefault();
        const calculatorSection = document.getElementById("calculadora"),
          mapIsVisible = !(
            !mapContainer || !mapContainer.classList.contains("visible")
          );
        try {
          (resetCalculatorForm(), resetBookingForm());
        } catch (_) {}
        try {
          (bookingFormWrapper &&
            (bookingFormWrapper.classList.remove("visible"),
            hideElement(bookingFormWrapper)),
            bookingFormSection && hideElement(bookingFormSection),
            totalPriceSection && hideElement(totalPriceSection));
        } catch (_) {}
        const performUiCloseAndScroll = () => {
          if (
            (hideElementSmooth(calcResultDiv),
            calculatorSection && "undefined" != typeof window)
          )
            try {
              const startY = window.pageYOffset || window.scrollY || 0,
                rect = calculatorSection.getBoundingClientRect(),
                distance = rect.top + startY - startY,
                duration = 1e3;
              let startTime = null;
              const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
              window.requestAnimationFrame(function step(timestamp) {
                startTime || (startTime = timestamp);
                const elapsed = timestamp - startTime,
                  progress = Math.min(elapsed / duration, 1),
                  eased = easeOutCubic(progress);
                (window.scrollTo(0, startY + distance * eased),
                  progress < 1 && window.requestAnimationFrame(step));
              });
            } catch (_) {}
        };
        if (mapIsVisible) {
          (mapContainer.classList.remove("visible"),
            mapContainer.setAttribute("aria-hidden", "true"));
          const mapEl = document.getElementById("route-map");
          (mapEl &&
            (mapEl.classList.remove("route-map--ready"),
            mapEl.classList.remove("route-map--labels-ready")),
            setTimeout(performUiCloseAndScroll, 200));
        } else performUiCloseAndScroll();
      }),
      toggleBtn &&
        toggleBtn.addEventListener("click", async function () {
          if (
            (toggleBtn &&
              (toggleBtn.classList.add("route-toggle-animating"),
              setTimeout(() => {
                toggleBtn.classList.remove("route-toggle-animating");
              }, 800)),
            !toggleBtn || !mapContainer)
          )
            return;
          if (mapContainer.classList.contains("visible")) {
            const currentMsgs = getMessagesSection("calc");
            (mapContainer.classList.remove("visible"),
              mapContainer.setAttribute("aria-hidden", "true"),
              toggleBtn.setAttribute("aria-expanded", "false"),
              (toggleBtn.innerHTML = `${currentMsgs.viewRouteButton} <span class="route-toggle-icon">&#9662;</span>`));
            const mapEl = document.getElementById("route-map");
            return (
              mapEl &&
                (mapEl.classList.remove("route-map--ready"),
                mapEl.classList.remove("route-map--labels-ready")),
              routeMapPolyline &&
                "function" == typeof routeMapPolyline.setMap &&
                routeMapPolyline.setMap(null),
              (routeMapPolyline = null),
              routeMapMarkers.forEach((m) => {
                m && m.setMap && m.setMap(null);
              }),
              void (routeMapMarkers = [])
            );
          }
          if (
            !(
              currentRouteOverviewPath &&
              currentRouteOverviewPath.length &&
              currentRouteStartLocation &&
              currentRouteEndLocation
            )
          ) {
            try {
              console.error("[TC route-map] Missing geometry for ida", {
                hasPath: !(
                  !currentRouteOverviewPath || !currentRouteOverviewPath.length
                ),
                hasStart: !!currentRouteStartLocation,
                hasEnd: !!currentRouteEndLocation,
              });
            } catch (_) {}
            return;
          }
          (mapContainer.classList.add("visible"),
            mapContainer.setAttribute("aria-hidden", "false"),
            (toggleBtn.innerHTML = `${getMessagesSection("calc").hideRouteButton} <span class="route-toggle-icon">&#9652;</span>`),
            toggleBtn.setAttribute("aria-expanded", "true"));
          try {
            await loadGoogleMapsIfNeeded();
          } catch (_) {
            return (
              mapContainer.classList.remove("visible"),
              mapContainer.setAttribute("aria-hidden", "true"),
              toggleBtn.setAttribute("aria-expanded", "false"),
              void (toggleBtn.innerHTML = `${getMessagesSection("calc").viewRouteButton} <span class="route-toggle-icon">&#9662;</span>`)
            );
          }
          if (!googleApiLoaded || void 0 === google.maps.Map) {
            try {
              const mapEl = document.getElementById("route-map");
              mapEl &&
                (mapEl.classList.add("route-map--ready"),
                (mapEl.style.opacity = "1"),
                (mapEl.style.transform = "none"),
                (mapEl.style.display = "flex"),
                (mapEl.style.alignItems = "center"),
                (mapEl.style.justifyContent = "center"),
                (mapEl.style.color = "#666"),
                (mapEl.style.fontSize = "0.95rem"),
                (mapEl.style.padding = "1.5rem"),
                (mapEl.style.textAlign = "center"),
                (mapEl.style.background = "#f8f9fa"),
                (mapEl.style.border = "1px solid #e0e0e0"),
                (mapEl.style.borderRadius = "8px"),
                (mapEl.innerHTML =
                  getMessagesSection("alerts") &&
                  getMessagesSection("alerts").googleMapsNotLoadedShort
                    ? getMessagesSection("alerts").googleMapsNotLoadedShort
                    : "No se pudo cargar el mapa."));
            } catch (_) {}
            try {
              console.error(
                "[TC route-map] Google Maps API not available after loadGoogleMapsIfNeeded",
              );
            } catch (_) {}
            return;
          }
          const routeMapElement = document.getElementById("route-map");
          if (!routeMapElement) return;
          (routeMapElement.classList.remove("route-map--ready"),
            routeMapElement.classList.remove("route-map--labels-ready"));
          const initialCenter =
            currentRouteOverviewPath[0] || currentRouteStartLocation;
          if (routeMapInstance)
            (routeMapInstance.setCenter(initialCenter),
              routeMapInstance.setZoom(11));
          else
            try {
              routeMapInstance = new google.maps.Map(routeMapElement, {
                center: initialCenter,
                zoom: 11,
                disableDefaultUI: !0,
                clickableIcons: !1,
                keyboardShortcuts: !1,
                gestureHandling: "greedy",
                mapId: TC_GOOGLE_MAP_ID,
              });
            } catch (e) {
              return (
                console.error(
                  "[createConfirmationRouteToggle] google.maps.Map failed",
                  e,
                ),
                (routeMapElement.style.display = "flex"),
                (routeMapElement.style.alignItems = "center"),
                (routeMapElement.style.justifyContent = "center"),
                (routeMapElement.style.color = "#666"),
                (routeMapElement.style.fontSize = "0.95rem"),
                (routeMapElement.style.padding = "2rem"),
                (routeMapElement.style.textAlign = "center"),
                (routeMapElement.style.background = "#f8f9fa"),
                (routeMapElement.style.border = "1px solid #e0e0e0"),
                (routeMapElement.style.borderRadius = "8px"),
                void (routeMapElement.innerHTML = "No se pudo cargar el mapa.")
              );
            }
          try {
            routeMapElement.style.opacity = "1";
          } catch (_) {}
          if (
            (routeMapPolyline && routeMapPolyline.setMap(null),
            routeMapMarkers.forEach((m) => {
              m && m.setMap && m.setMap(null);
            }),
            (routeMapMarkers = []),
            !currentRouteBounds &&
              currentRouteOverviewPath &&
              currentRouteOverviewPath.length)
          ) {
            const bounds = new google.maps.LatLngBounds();
            (currentRouteOverviewPath.forEach((p) => bounds.extend(p)),
              (currentRouteBounds = bounds));
          }
          let widePadding = 45,
            finalPadding = 30;
          const routeDistanceForBounds =
            currentCalculation && currentCalculation.distanceKm
              ? currentCalculation.distanceKm
              : 0;
          routeDistanceForBounds > 0 && routeDistanceForBounds <= 5
            ? ((widePadding = 55), (finalPadding = 30))
            : routeDistanceForBounds > 5 && routeDistanceForBounds <= 40
              ? ((widePadding = 60), (finalPadding = 10))
              : routeDistanceForBounds > 40 &&
                ((widePadding = 95), (finalPadding = 8));
          try {
            google.maps &&
              google.maps.event &&
              "function" == typeof google.maps.event.trigger &&
              routeMapInstance &&
              google.maps.event.trigger(routeMapInstance, "resize");
          } catch (_) {}
          try {
            currentRouteBounds &&
              routeMapInstance &&
              routeMapInstance.fitBounds(currentRouteBounds, widePadding);
          } catch (_) {}
          setTimeout(() => {
            try {
              currentRouteBounds &&
                routeMapInstance &&
                routeMapInstance.fitBounds(currentRouteBounds, widePadding);
            } catch (_) {}
          }, 120);
          try {
            mapContainer.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          } catch (_) {}
          let fullPath = currentRouteOverviewPath.slice();
          fullPath = fullPath
            .map((p) => {
              if (!p) return null;
              const lat = "function" == typeof p.lat ? p.lat() : p.lat,
                lng = "function" == typeof p.lng ? p.lng() : p.lng;
              return new google.maps.LatLng(lat, lng);
            })
            .filter((p) => null !== p);
          const startLocation = currentRouteStartLocation,
            endLocation = currentRouteEndLocation,
            scheduleFrame =
              "function" == typeof requestAnimationFrame
                ? requestAnimationFrame
                : (fn) => setTimeout(fn, 16);
          setTimeout(() => {
            (routeMapElement.classList.add("route-map--ready"),
              routeMapElement.classList.add("route-map--labels-ready"),
              setTimeout(() => {
                try {
                  currentRouteBounds &&
                    routeMapInstance &&
                    routeMapInstance.fitBounds(
                      currentRouteBounds,
                      finalPadding,
                    );
                } catch (_) {}
              }, 260));
          }, 200);
          let taxiMarker = null,
            destinationMarker = null,
            taxiBaseSize = 22,
            destinationBaseSize = 22;
          const routeDistanceForMarkers =
            currentCalculation && currentCalculation.distanceKm
              ? currentCalculation.distanceKm
              : 0;
          routeDistanceForMarkers > 0 &&
            (routeDistanceForMarkers < 5
              ? ((taxiBaseSize = 26), (destinationBaseSize = 26))
              : routeDistanceForMarkers < 20 &&
                ((taxiBaseSize = 24), (destinationBaseSize = 24)));
          const hasAdvancedMarker = false,
            createMarkers = (showDestinationImmediately) => {
              if (startLocation) {
                if (hasAdvancedMarker) {
                  const taxiContent = document.createElement("div");
                  ((taxiContent.textContent = "🚕"),
                    (taxiContent.style.fontSize = taxiBaseSize + "px"),
                    (taxiContent.style.lineHeight = "1"));
                  try {
                    taxiMarker = new google.maps.marker.AdvancedMarkerElement({
                      map: routeMapInstance,
                      position: startLocation,
                      content: taxiContent,
                    });
                  } catch (_) {
                    taxiMarker = new google.maps.Marker({
                      position: startLocation,
                      map: routeMapInstance,
                      icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 9,
                        fillColor: "#0a3d62",
                        fillOpacity: 1,
                        strokeColor: "#ffffff",
                        strokeWeight: 3,
                      },
                    });
                  }
                } else
                  taxiMarker = new google.maps.Marker({
                    position: startLocation,
                    map: routeMapInstance,
                    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
                    label: { text: "🚕", fontSize: taxiBaseSize + "px" },
                  });
                routeMapMarkers.push(taxiMarker);
              }
              if (endLocation) {
                const destinationMap = showDestinationImmediately
                  ? routeMapInstance
                  : null;
                if (hasAdvancedMarker) {
                  const destinationContent = document.createElement("div");
                  ((destinationContent.textContent = "🏁"),
                    (destinationContent.style.fontSize =
                      destinationBaseSize + "px"),
                    (destinationContent.style.lineHeight = "1"));
                  try {
                    destinationMarker =
                      new google.maps.marker.AdvancedMarkerElement({
                        map: destinationMap,
                        position: endLocation,
                        content: destinationContent,
                      });
                  } catch (_) {
                    destinationMarker = new google.maps.Marker({
                      position: endLocation,
                      map: destinationMap,
                      icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 9,
                        fillColor: "#fbc531",
                        fillOpacity: 1,
                        strokeColor: "#ffffff",
                        strokeWeight: 3,
                      },
                    });
                  }
                } else
                  destinationMarker = new google.maps.Marker({
                    position: endLocation,
                    map: destinationMap,
                    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
                    label: { text: "🏁", fontSize: destinationBaseSize + "px" },
                  });
                routeMapMarkers.push(destinationMarker);
              }
            };
          function createRouteLabelOverlay(map, position, text, extraClass) {
            function RouteLabelOverlay(pos, txt, cls) {
              ((this.position = pos),
                (this.text = txt),
                (this.extraClass = cls || ""),
                (this.div = null),
                (this._typingTimer = null),
                (this._typingDonePromise = null),
                (this._typingDoneResolve = null));
            }
            ((RouteLabelOverlay.prototype = Object.create(
              google.maps.OverlayView.prototype,
            )),
              (RouteLabelOverlay.prototype.constructor = RouteLabelOverlay),
              (RouteLabelOverlay.prototype.startTyping = function () {
                if (
                  (this._typingDonePromise ||
                    (this._typingDonePromise = new Promise((resolve) => {
                      this._typingDoneResolve = resolve;
                    })),
                  !this.div)
                )
                  return this._typingDonePromise;
                const fullText = null != this.text ? String(this.text) : "";
                if (!fullText)
                  return (
                    (this.div.textContent = ""),
                    this._typingDoneResolve &&
                      (this._typingDoneResolve(),
                      (this._typingDoneResolve = null)),
                    this._typingDonePromise
                  );
                const mapDiv =
                    map && "function" == typeof map.getDiv
                      ? map.getDiv()
                      : null,
                  startTypingInner = () => {
                    if (!this.div) return;
                    try {
                      this.div.style.opacity = "1";
                    } catch (_) {}
                    this.div.textContent = "";
                    let index = 0;
                    const maxLength = fullText.length,
                      step = () => {
                        this.div &&
                          ((this.div.textContent = fullText.slice(
                            0,
                            index + 1,
                          )),
                          (index += 1),
                          index < maxLength
                            ? (this._typingTimer = setTimeout(step, 32))
                            : ((this._typingTimer = null),
                              this._typingDoneResolve &&
                                (this._typingDoneResolve(),
                                (this._typingDoneResolve = null))));
                      };
                    step();
                  };
                if (
                  mapDiv &&
                  !mapDiv.classList.contains("route-map--labels-ready")
                ) {
                  let attempts = 0;
                  const maxAttempts = 60,
                    waitUntilReady = () => {
                      this.div &&
                        (!mapDiv ||
                        mapDiv.classList.contains("route-map--labels-ready") ||
                        attempts >= maxAttempts
                          ? startTypingInner()
                          : ((attempts += 1), setTimeout(waitUntilReady, 32)));
                    };
                  waitUntilReady();
                } else startTypingInner();
                return this._typingDonePromise;
              }),
              (RouteLabelOverlay.prototype.onAdd = function () {
                const div = document.createElement("div");
                ((div.className =
                  "route-map-label" +
                  (this.extraClass ? " " + this.extraClass : "")),
                  (this.div = div));
                const panes = this.getPanes();
                (panes &&
                  panes.overlayMouseTarget &&
                  panes.overlayMouseTarget.appendChild(div),
                  this.startTyping());
              }),
              (RouteLabelOverlay.prototype.draw = function () {
                if (!this.div) return;
                const projection = this.getProjection();
                if (!projection) return;
                const point = projection.fromLatLngToDivPixel(this.position);
                point &&
                  ((this.div.style.left = point.x + 10 + "px"),
                  (this.div.style.top = point.y + 6 + "px"));
              }),
              (RouteLabelOverlay.prototype.onRemove = function () {
                (this._typingTimer &&
                  (clearTimeout(this._typingTimer), (this._typingTimer = null)),
                  this._typingDoneResolve &&
                    (this._typingDoneResolve(),
                    (this._typingDoneResolve = null)),
                  this.div &&
                    this.div.parentNode &&
                    this.div.parentNode.removeChild(this.div),
                  (this.div = null));
              }));
            const overlay = new RouteLabelOverlay(position, text, extraClass);
            return (overlay.setMap(map), overlay);
          }
          const originPlace =
              void 0 !== autocompleteSelectedPlaces &&
              autocompleteSelectedPlaces.origenCalc
                ? autocompleteSelectedPlaces.origenCalc
                : null,
            destinationPlace =
              void 0 !== autocompleteSelectedPlaces &&
              autocompleteSelectedPlaces.destinoCalc
                ? autocompleteSelectedPlaces.destinoCalc
                : null;
          let originLabelText = buildMapLabelFromPlaceOrAddress(
              originPlace,
              currentCalculation && currentCalculation.origin
                ? escapeHtml(currentCalculation.origin)
                : "",
            ),
            destinationLabelText = buildMapLabelFromPlaceOrAddress(
              destinationPlace,
              currentCalculation && currentCalculation.destination
                ? escapeHtml(currentCalculation.destination)
                : "",
            );
          const labelDistance =
            currentCalculation && currentCalculation.distanceKm
              ? currentCalculation.distanceKm
              : 0;
          let originLabelClass = "route-map-label--origin",
            destinationLabelClass = "route-map-label--destination";
          labelDistance > 0 &&
            labelDistance < 3 &&
            ((originLabelClass += " route-map-label--short"),
            (destinationLabelClass += " route-map-label--short"));
          let originLabelOverlay = null,
            destinationLabelOverlay = null;
          if (!fullPath.length) return;
          const distForAnimation =
              currentCalculation && currentCalculation.distanceKm
                ? currentCalculation.distanceKm
                : 0,
            bounceMarker = (marker, baseSize) => {
              if (marker)
                try {
                  if (
                    "function" == typeof marker.getLabel &&
                    "function" == typeof marker.setLabel
                  ) {
                    const currentLabel = marker.getLabel();
                    if (!currentLabel || !currentLabel.text) return;
                    const normalSize =
                        baseSize || parseInt(currentLabel.fontSize || "22", 10),
                      bigSize = normalSize + 8;
                    return (
                      marker.setLabel(
                        Object.assign({}, currentLabel, {
                          fontSize: bigSize + "px",
                        }),
                      ),
                      void setTimeout(() => {
                        marker.setLabel(
                          Object.assign({}, currentLabel, {
                            fontSize: normalSize + "px",
                          }),
                        );
                      }, 600)
                    );
                  }
                  const contentEl = marker.content;
                  if (contentEl && contentEl.style) {
                    const normalSize =
                        baseSize ||
                        parseInt(contentEl.style.fontSize || "22", 10),
                      bigSize = normalSize + 8;
                    ((contentEl.style.fontSize = bigSize + "px"),
                      setTimeout(() => {
                        contentEl.style.fontSize = normalSize + "px";
                      }, 600));
                  }
                } catch (_) {}
            },
            animatedPath = new google.maps.MVCArray();
          routeMapPolyline = new google.maps.Polyline({
            path: animatedPath,
            map: routeMapInstance,
            strokeColor: "#e2bf55",
            strokeOpacity: 1,
            strokeWeight: 4,
          });
          const getLatLngLiteral = (p) => {
              if (!p) return { lat: 0, lng: 0 };
              const lat = "function" == typeof p.lat ? p.lat() : p.lat,
                lng = "function" == typeof p.lng ? p.lng() : p.lng;
              return { lat: Number(lat), lng: Number(lng) };
            },
            haversineMeters = (a, b) => {
              const A = getLatLngLiteral(a),
                B = getLatLngLiteral(b),
                toRad = (deg) => deg * (Math.PI / 180),
                dLat = toRad(B.lat - A.lat),
                dLng = toRad(B.lng - A.lng),
                lat1 = toRad(A.lat),
                lat2 = toRad(B.lat),
                sinDLat = Math.sin(dLat / 2),
                sinDLng = Math.sin(dLng / 2),
                h =
                  sinDLat * sinDLat +
                  Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
              return 12742e3 * Math.asin(Math.min(1, Math.sqrt(h)));
            },
            pathForAnimation = ((path) => {
              const maxSegmentMeters =
                distForAnimation > 0 && distForAnimation <= 1
                  ? 45
                  : distForAnimation > 1 && distForAnimation <= 5
                    ? 85
                    : 0;
              if (!maxSegmentMeters || !Array.isArray(path) || path.length < 2)
                return path;
              const dense = [];
              for (let i = 0; i < path.length; i++) {
                const p = path[i],
                  lat = "function" == typeof p.lat ? p.lat() : p.lat,
                  lng = "function" == typeof p.lng ? p.lng() : p.lng;
                dense.push(new google.maps.LatLng(lat, lng));
              }
              for (let i = 0; i < path.length - 1; i++) {
                const a = dense[i],
                  b = dense[i + 1],
                  d = haversineMeters(a, b),
                  inserts = Math.min(
                    12,
                    Math.max(0, Math.ceil(d / maxSegmentMeters) - 1),
                  );
                if (inserts > 0) {
                  const A = getLatLngLiteral(a),
                    B = getLatLngLiteral(b);
                  for (let k = 1; k <= inserts; k++) {
                    const t = k / (inserts + 1),
                      lat = A.lat + (B.lat - A.lat) * t,
                      lng = A.lng + (B.lng - A.lng) * t;
                    dense.push(new google.maps.LatLng(lat, lng));
                  }
                }
              }
              return dense;
            })(fullPath),
            totalPoints = pathForAnimation.length;
          let index = 0,
            segmentCount = 190;
          distForAnimation > 5 && distForAnimation <= 40
            ? (segmentCount = 150)
            : distForAnimation > 40 && (segmentCount = 130);
          let step = Math.max(1, Math.floor(totalPoints / segmentCount));
          distForAnimation > 0 && distForAnimation <= 5 && (step = 1);
          const frameCountForAnimation = Math.max(
            1,
            Math.ceil(totalPoints / step),
          );
          let targetDurationMs = 0;
          distForAnimation > 0 && distForAnimation <= 1
            ? (targetDurationMs = 1500)
            : distForAnimation > 1 && distForAnimation <= 5
              ? (targetDurationMs = 2e3)
              : distForAnimation > 5 && distForAnimation <= 40
                ? (targetDurationMs = 3200)
                : distForAnimation > 40 && (targetDurationMs = 3800);
          const perFrameDelayMs =
              targetDurationMs > 0
                ? Math.min(
                    180,
                    Math.max(
                      0,
                      Math.round(
                        targetDurationMs / frameCountForAnimation - 16,
                      ),
                    ),
                  )
                : 0,
            drawNext = () => {
              const nextIndex = Math.min(totalPoints, index + step);
              for (let i = index; i < nextIndex; i++)
                animatedPath.push(pathForAnimation[i]);
              ((index = nextIndex),
                index < totalPoints
                  ? perFrameDelayMs > 0
                    ? setTimeout(() => scheduleFrame(drawNext), perFrameDelayMs)
                    : scheduleFrame(drawNext)
                  : setTimeout(() => {
                      try {
                        destinationMarker &&
                          ("function" == typeof destinationMarker.setMap
                            ? destinationMarker.setMap(routeMapInstance)
                            : destinationMarker.map ||
                              (destinationMarker.map = routeMapInstance));
                      } catch (_) {}
                      (((polyline) => {
                        if (polyline)
                          try {
                            const originalOpacity =
                                "function" == typeof polyline.get
                                  ? polyline.get("strokeOpacity")
                                  : 1,
                              originalColor =
                                "function" == typeof polyline.get
                                  ? polyline.get("strokeColor")
                                  : "#e2bf55",
                              originalWeight =
                                "function" == typeof polyline.get
                                  ? polyline.get("strokeWeight")
                                  : 4,
                              brightColor = "#f6e27a",
                              boostedWeight = originalWeight + 2;
                            (polyline.setOptions({
                              strokeOpacity: 1,
                              strokeColor: brightColor,
                              strokeWeight: boostedWeight,
                            }),
                              setTimeout(() => {
                                try {
                                  polyline.setOptions({
                                    strokeOpacity:
                                      null == originalOpacity
                                        ? 1
                                        : originalOpacity,
                                    strokeColor: originalColor || "#e2bf55",
                                    strokeWeight: originalWeight,
                                  });
                                } catch (_) {}
                              }, 600));
                          } catch (_) {}
                      })(routeMapPolyline),
                        bounceMarker(taxiMarker, taxiBaseSize),
                        bounceMarker(destinationMarker, destinationBaseSize),
                        startLocation &&
                          originLabelText &&
                          !originLabelOverlay &&
                          (originLabelOverlay = createRouteLabelOverlay(
                            routeMapInstance,
                            startLocation,
                            originLabelText,
                            originLabelClass,
                          )),
                        endLocation &&
                          destinationLabelText &&
                          !destinationLabelOverlay &&
                          (destinationLabelOverlay = createRouteLabelOverlay(
                            routeMapInstance,
                            endLocation,
                            destinationLabelText,
                            destinationLabelClass,
                          )));
                    }, 220));
            },
            startRouteAnimation = () => {
              (bounceMarker(taxiMarker, taxiBaseSize), drawNext());
            };
          (createMarkers(!1),
            (function waitForMapReadyAndDelay() {
              !routeMapElement ||
              routeMapElement.classList.contains("route-map--ready")
                ? setTimeout(startRouteAnimation, 1180)
                : setTimeout(waitForMapReadyAndDelay, 50);
            })());
        }));
    const prevCalcClickHandler = calcResultDiv.__calcClickHandler;
    if (prevCalcClickHandler)
      try {
        calcResultDiv.removeEventListener("click", prevCalcClickHandler);
      } catch (_) {}
    const calcClickHandler = function (e) {
      if (e.target && "continue-booking-btn" === e.target.id) {
        if (!currentCalculation || !currentCalculation.pickupDateTime)
          return void showMinLeadTimeNotice();
        currentCalculation && currentCalculation.isBelowMinPrice
          ? (function (minPrice, onContinue) {
              const msgs = getMessagesSection("calc");
              ((calcResultDiv.innerHTML = `\n      <div class="min-price-notice">\n        <p>${msgs.minPriceIntro}</p>\n        <p>${msgs.minPriceLine(formatPrice(minPrice))}</p>\n        <p class="min-price-note" style="font-size: 0.9rem; color: #ccc; font-style: italic; text-align: center; border: none;">${msgs.minPriceNote}</p>\n        <div class="min-price-buttons">\n          <button type="button" id="continue-min-price-btn" class="btn btn-primary">${msgs.minPriceContinueButton(formatPrice(minPrice))}</button>\n          <button type="button" id="cancel-min-price-btn" class="btn btn-light">${msgs.cancelButton}</button>\n        </div>\n      </div>\n    `),
                showElement(calcResultDiv));
              const prevMinClickHandler = calcResultDiv.__minPriceClickHandler;
              if (prevMinClickHandler)
                try {
                  calcResultDiv.removeEventListener(
                    "click",
                    prevMinClickHandler,
                  );
                } catch (_) {}
              const minPriceClickHandler = function (e) {
                if (e.target && "continue-min-price-btn" === e.target.id) {
                  ((currentCalculation.totalPriceOneWay = minPrice),
                    (currentCalculation.isMinPriceApplied = !0),
                    (currentCalculation.isBelowMinPrice = !1),
                    // Guardar el precio del trayecto de ida en currentBookingDetails
                    currentBookingDetails && (currentBookingDetails.oneWayPrice = minPrice),
                    updateTotalPriceAmount());
                  const distance =
                      currentCalculation &&
                      "number" == typeof currentCalculation.distanceKm
                        ? currentCalculation.distanceKm
                        : 0,
                    duration =
                      currentCalculation &&
                      "string" == typeof currentCalculation.durationText
                        ? currentCalculation.durationText
                        : "";
                  // Verificar las 12 horas después de aceptar el precio mínimo
                  const now = new Date();
                  if (
                    (currentCalculation.pickupDateTime.getTime() - now.getTime()) / 36e5 <
                    12
                  ) {
                    (displayCalculationResultInternal(
                      minPrice,
                      distance,
                      duration,
                      { skipScroll: !0 },
                    ),
                      showMinLeadTimeNotice());
                  } else {
                    (displayCalculationResultInternal(
                      minPrice,
                      distance,
                      duration,
                      { skipScroll: !0 },
                    ),
                      "function" == typeof onContinue && onContinue());
                  }
                }
                if (e.target && "cancel-min-price-btn" === e.target.id) {
                  hideElementSmooth(calcResultDiv);
                  try {
                    (resetCalculatorForm(), resetBookingForm());
                  } catch (_) {}
                  try {
                    (bookingFormWrapper &&
                      (bookingFormWrapper.classList.remove("visible"),
                      hideElement(bookingFormWrapper)),
                      bookingFormSection && hideElement(bookingFormSection),
                      totalPriceSection && hideElement(totalPriceSection));
                  } catch (_) {}
                  try {
                    const calculatorSection =
                      document.getElementById("calculadora");
                    calculatorSection &&
                      "function" == typeof calculatorSection.scrollIntoView &&
                      calculatorSection.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                  } catch (_) {}
                }
              };
              ((calcResultDiv.__minPriceClickHandler = minPriceClickHandler),
                calcResultDiv.addEventListener("click", minPriceClickHandler));
            })(45, function () {
              (showBookingForm(), markOneWayIncluded());
            })
          : (function () {
              const now = new Date();
              if (
                (currentCalculation.pickupDateTime.getTime() - now.getTime()) / 36e5 <
                12
              )
                return void showMinLeadTimeNotice();
              (showBookingForm(), markOneWayIncluded());
            })();
      }
    };
    ((calcResultDiv.__calcClickHandler = calcClickHandler),
      calcResultDiv.addEventListener("click", calcClickHandler));
  }
  function markOneWayIncluded() {
    const btnEl = document.getElementById("continue-booking-btn"),
      successEl = document.getElementById("one-way-included-success");
    if (
      (btnEl && ((btnEl.disabled = !0), (btnEl.style.display = "none")),
      successEl)
    ) {
      const msgs = getMessagesSection("calc"),
        msg =
          msgs && msgs.oneWayIncludedSuccess ? msgs.oneWayIncludedSuccess : "";
      (msg && (successEl.textContent = msg),
        (successEl.style.display = "inline-block"));
    }
  }
  function showMinLeadTimeNotice() {
    const msgs = getMessagesSection("calc");
    const origin = currentCalculation?.origin || "";
    const destination = currentCalculation?.destination || "";
    const time = currentCalculation?.pickupDateTime ? 
      currentCalculation.pickupDateTime.toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'}) : "";
    const price = formatPrice(currentCalculation?.totalPriceOneWay || 0);
    
    // Limpiar las direcciones para el mensaje de WhatsApp y convertir a minúsculas
    const cleanOrigin = origin.replace(/,\s*Conil de la Frontera/g, '').replace(/·/g, '').toLowerCase();
    const cleanDestination = destination.replace(/,\s*Conil de la Frontera/g, '').replace(/·/g, '').toLowerCase();
    
    const whatsappMessage = encodeURIComponent(
      msgs.whatsappMessageTemplate
        .replace('{origin}', cleanOrigin)
        .replace('{destination}', cleanDestination)
        .replace('{time}', time)
        .replace('{price}', price)
    );
    
    ((calcResultDiv.innerHTML = `
      <div class="min-lead-time-notice">
        <p><i class="fas fa-exclamation-triangle"></i> ${msgs.minLeadTimeLine(12)}</p>
        <p>${msgs.urgentServicesLine}</p>
        <div style="display: flex; gap: 15px; justify-content: center; align-items: center; margin-top: 15px;">
          <a href="https://wa.me/34670705774?text=${whatsappMessage}" target="_blank" style="display: inline-flex; align-items: center; justify-content: center; width: 50px; height: 50px; border-radius: 50%; background-color: #25d366; color: white; text-decoration: none; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 2px 8px rgba(37, 211, 102, 0.3);">
            <i class="fab fa-whatsapp" style="font-size: 24px;"></i>
          </a>
          <a href="tel:+34670705774" style="display: inline-flex; align-items: center; justify-content: center; width: 50px; height: 50px; border-radius: 50%; background-color: #333; color: white; text-decoration: none; transition: transform 0.2s, box-shadow 0.2s; box-shadow: 0 2px 8px rgba(51, 51, 51, 0.3);">
            <i class="fas fa-phone-alt" style="font-size: 24px;"></i>
          </a>
        </div>
      </div>
    `),
      showElement(calcResultDiv));
  }
  function displayReturnCalculationResult(
    price,
    distance,
    duration,
    isMinPrice,
  ) {
    const originText =
        currentBookingDetails && currentBookingDetails.returnOrigin
          ? escapeHtml(currentBookingDetails.returnOrigin)
          : "",
      destinationText =
        currentBookingDetails && currentBookingDetails.returnDestination
          ? escapeHtml(currentBookingDetails.returnDestination)
          : "";
    ((returnRouteMapInstance = null),
      (returnRoutePolyline = null),
      (returnRouteMarkers = []));
    const isReturnAlreadyIncluded = !(
        !currentBookingDetails || !0 !== currentBookingDetails.returnTrip
      ),
      effectivePrice =
        isReturnAlreadyIncluded &&
        currentBookingDetails &&
        "number" == typeof currentBookingDetails.returnPrice
          ? currentBookingDetails.returnPrice
          : price,
      msgs = getMessagesSection("calc"),
      isShortBelowMinNotIncluded = !(!isMinPrice || isReturnAlreadyIncluded),
      confirmLabel =
        isShortBelowMinNotIncluded && msgs && msgs.continueBookingButton
          ? msgs.continueBookingButton
          : msgs.confirmReturnButton,
      cancelLabel =
        isShortBelowMinNotIncluded && msgs && msgs.cancelButton
          ? msgs.cancelButton
          : msgs.cancelReturnButton,
      returnRouteMapInfoHtml =
        "function" == typeof isHandheldMobileDevice && isHandheldMobileDevice()
          ? ""
          : `\n        <div class="route-map-info">\n          <div class="route-map-chip">\n            <span class="route-map-chip-main">${distance.toFixed(1)} km · ${duration}</span>\n          </div>\n        </div>\n      `;
    ((returnCalcResultDiv.innerHTML = `\n      <div class="result-details">\n        <div class="detail-item">${msgs.returnDistanceLabel}: <strong>${distance.toFixed(1)} km</strong></div>\n        <div class="detail-item">${msgs.returnDurationLabel}: <strong>${duration}</strong></div>\n      </div>\n      <p>${msgs.returnTotalPriceIntro}</p>\n      <p class="final-price">${formatPrice(effectivePrice)}</p>\n      <div class="route-map-toggle-wrapper route-map-toggle-wrapper--return">\n        <button type="button" id="toggle-return-route-map-btn" class="btn route-map-toggle-btn" aria-expanded="false" aria-controls="return-route-map-container">\n          ${msgs.viewRouteButton} <span class="route-toggle-icon">&#9662;</span>\n        </button>\n      </div>\n      <div id="return-route-map-container" class="route-map-container" aria-hidden="true">\n        ${returnRouteMapInfoHtml}\n        <div id="return-route-map" class="route-map" role="img" aria-label="${distance.toFixed(1)} km, ${duration}"></div>\n      </div>\n      <div class="calculation-buttons calculation-buttons--return">\n        <button type="button" id="cancel-return-btn" class="btn btn-light">${cancelLabel}</button>\n        <button type="button" id="confirm-return-btn" class="btn btn-primary">${confirmLabel}</button>\n        <div id="return-included-success" class="return-included-success" aria-live="polite" style="display:none;"></div>\n      </div>\n    `),
      showElement(returnCalcResultDiv));
    try {
      returnCalcResultDiv &&
        "function" == typeof returnCalcResultDiv.scrollIntoView &&
        returnCalcResultDiv.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
    } catch (_) {}
    const toggleBtn = document.getElementById("toggle-return-route-map-btn"),
      mapContainer = document.getElementById("return-route-map-container"),
      confirmReturnBtn = document.getElementById("confirm-return-btn"),
      returnIncludedSuccessEl = document.getElementById(
        "return-included-success",
      );
    if (
      (toggleBtn &&
        toggleBtn.addEventListener("click", async function () {
          if (
            (toggleBtn &&
              (toggleBtn.classList.add("route-toggle-animating"),
              setTimeout(() => {
                toggleBtn.classList.remove("route-toggle-animating");
              }, 800)),
            !toggleBtn || !mapContainer)
          )
            return;
          if (mapContainer.classList.contains("visible")) {
            const currentMsgs = getMessagesSection("calc");
            (mapContainer.classList.remove("visible"),
              mapContainer.setAttribute("aria-hidden", "true"),
              toggleBtn.setAttribute("aria-expanded", "false"),
              (toggleBtn.innerHTML = `${currentMsgs.viewRouteButton} <span class="route-toggle-icon">&#9662;</span>`));
            const mapEl = document.getElementById("return-route-map");
            return (
              mapEl &&
                (mapEl.classList.remove("route-map--ready"),
                mapEl.classList.remove("route-map--labels-ready")),
              returnRoutePolyline &&
                "function" == typeof returnRoutePolyline.setMap &&
                returnRoutePolyline.setMap(null),
              (returnRoutePolyline = null),
              returnRouteMarkers.forEach((m) => {
                m && m.setMap && m.setMap(null);
              }),
              (returnRouteMarkers = []),
              (returnRouteMapInstance = null),
              void (currentReturnRouteBounds = null)
            );
          }
          if (
            !(
              currentReturnRouteOverviewPath &&
              currentReturnRouteOverviewPath.length &&
              currentReturnRouteStartLocation &&
              currentReturnRouteEndLocation
            )
          ) {
            try {
              console.error(
                "[TC return-route-map] Missing geometry for vuelta",
                {
                  hasPath: !(
                    !currentReturnRouteOverviewPath ||
                    !currentReturnRouteOverviewPath.length
                  ),
                  hasStart: !!currentReturnRouteStartLocation,
                  hasEnd: !!currentReturnRouteEndLocation,
                },
              );
            } catch (_) {}
            return;
          }
          (mapContainer.classList.add("visible"),
            mapContainer.setAttribute("aria-hidden", "false"),
            (toggleBtn.innerHTML = `${getMessagesSection("calc").hideRouteButton} <span class="route-toggle-icon">&#9652;</span>`),
            toggleBtn.setAttribute("aria-expanded", "true"));
          try {
            await loadGoogleMapsIfNeeded();
          } catch (_) {
            return (
              mapContainer.classList.remove("visible"),
              mapContainer.setAttribute("aria-hidden", "true"),
              toggleBtn.setAttribute("aria-expanded", "false"),
              void (toggleBtn.innerHTML = `${getMessagesSection("calc").viewRouteButton} <span class="route-toggle-icon">&#9662;</span>`)
            );
          }
          if (!googleApiLoaded || void 0 === google.maps.Map) {
            try {
              const mapEl = document.getElementById("return-route-map");
              mapEl &&
                (mapEl.classList.add("route-map--ready"),
                (mapEl.style.opacity = "1"),
                (mapEl.style.transform = "none"),
                (mapEl.style.display = "flex"),
                (mapEl.style.alignItems = "center"),
                (mapEl.style.justifyContent = "center"),
                (mapEl.style.color = "#666"),
                (mapEl.style.fontSize = "0.95rem"),
                (mapEl.style.padding = "1.5rem"),
                (mapEl.style.textAlign = "center"),
                (mapEl.style.background = "#f8f9fa"),
                (mapEl.style.border = "1px solid #e0e0e0"),
                (mapEl.style.borderRadius = "8px"),
                (mapEl.innerHTML =
                  getMessagesSection("alerts") &&
                  getMessagesSection("alerts").googleMapsNotLoadedShort
                    ? getMessagesSection("alerts").googleMapsNotLoadedShort
                    : "No se pudo cargar el mapa."));
            } catch (_) {}
            try {
              console.error(
                "[TC return-route-map] Google Maps API not available after loadGoogleMapsIfNeeded",
              );
            } catch (_) {}
            return;
          }
          const routeMapElement = document.getElementById("return-route-map");
          if (!routeMapElement) return;
          (routeMapElement.classList.remove("route-map--ready"),
            routeMapElement.classList.remove("route-map--labels-ready"));
          const initialCenterReturn =
            currentReturnRouteOverviewPath[0] ||
            currentReturnRouteStartLocation;
          returnRouteMapInstance
            ? (returnRouteMapInstance.setCenter(initialCenterReturn),
              returnRouteMapInstance.setZoom(11))
            : (returnRouteMapInstance = new google.maps.Map(routeMapElement, {
                center: initialCenterReturn,
                zoom: 11,
                disableDefaultUI: !0,
                clickableIcons: !1,
                keyboardShortcuts: !1,
                gestureHandling: "greedy",
                mapId: TC_GOOGLE_MAP_ID,
              }));
          try {
            routeMapElement.style.opacity = "1";
          } catch (_) {}
          if (
            (returnRoutePolyline && returnRoutePolyline.setMap(null),
            returnRouteMarkers.forEach((m) => {
              m && m.setMap && m.setMap(null);
            }),
            (returnRouteMarkers = []),
            !currentReturnRouteBounds &&
              currentReturnRouteOverviewPath &&
              currentReturnRouteOverviewPath.length)
          ) {
            const bounds = new google.maps.LatLngBounds();
            (currentReturnRouteOverviewPath.forEach((p) => bounds.extend(p)),
              (currentReturnRouteBounds = bounds));
          }
          let widePaddingReturn = 45,
            finalPaddingReturn = 30;
          const routeDistanceForBoundsReturn =
            currentBookingDetails && currentBookingDetails.returnDistanceKm
              ? currentBookingDetails.returnDistanceKm
              : 0;
          routeDistanceForBoundsReturn > 0 && routeDistanceForBoundsReturn <= 5
            ? ((widePaddingReturn = 55), (finalPaddingReturn = 30))
            : routeDistanceForBoundsReturn > 5 &&
                routeDistanceForBoundsReturn <= 40
              ? ((widePaddingReturn = 60), (finalPaddingReturn = 10))
              : routeDistanceForBoundsReturn > 40 &&
                ((widePaddingReturn = 95), (finalPaddingReturn = 8));
          try {
            google.maps &&
              google.maps.event &&
              "function" == typeof google.maps.event.trigger &&
              returnRouteMapInstance &&
              google.maps.event.trigger(returnRouteMapInstance, "resize");
          } catch (_) {}
          try {
            currentReturnRouteBounds &&
              returnRouteMapInstance &&
              returnRouteMapInstance.fitBounds(
                currentReturnRouteBounds,
                widePaddingReturn,
              );
          } catch (_) {}
          (setTimeout(() => {
            try {
              currentReturnRouteBounds &&
                returnRouteMapInstance &&
                returnRouteMapInstance.fitBounds(
                  currentReturnRouteBounds,
                  widePaddingReturn,
                );
            } catch (_) {}
          }, 120),
            mapContainer.classList.add("visible"),
            mapContainer.setAttribute("aria-hidden", "false"),
            (toggleBtn.innerHTML = `${getMessagesSection("calc").hideRouteButton} <span class="route-toggle-icon">&#9652;</span>`),
            toggleBtn.setAttribute("aria-expanded", "true"));
          try {
            mapContainer.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          } catch (_) {}
          let fullPath = currentReturnRouteOverviewPath.slice();
          fullPath = fullPath
            .map((p) => {
              if (!p) return null;
              const lat = "function" == typeof p.lat ? p.lat() : p.lat,
                lng = "function" == typeof p.lng ? p.lng() : p.lng;
              return new google.maps.LatLng(lat, lng);
            })
            .filter((p) => null !== p);
          const startLocation = currentReturnRouteStartLocation,
            endLocation = currentReturnRouteEndLocation,
            scheduleFrame =
              "function" == typeof requestAnimationFrame
                ? requestAnimationFrame
                : (fn) => setTimeout(fn, 16);
          setTimeout(() => {
            (routeMapElement.classList.add("route-map--ready"),
              routeMapElement.classList.add("route-map--labels-ready"),
              setTimeout(() => {
                try {
                  currentReturnRouteBounds &&
                    returnRouteMapInstance &&
                    returnRouteMapInstance.fitBounds(
                      currentReturnRouteBounds,
                      finalPaddingReturn,
                    );
                } catch (_) {}
              }, 260));
          }, 200);
          let taxiMarker = null,
            destinationMarker = null,
            taxiBaseSize = 22,
            destinationBaseSize = 22;
          const routeDistanceForMarkers =
            currentBookingDetails && currentBookingDetails.returnDistanceKm
              ? currentBookingDetails.returnDistanceKm
              : 0;
          routeDistanceForMarkers > 0 &&
            (routeDistanceForMarkers < 5
              ? ((taxiBaseSize = 26), (destinationBaseSize = 26))
              : routeDistanceForMarkers < 20 &&
                ((taxiBaseSize = 24), (destinationBaseSize = 24)));
          const hasAdvancedMarkerReturn = false,
            createMarkers = (showDestinationImmediately) => {
              if (startLocation) {
                if (hasAdvancedMarkerReturn) {
                  const taxiContent = document.createElement("div");
                  ((taxiContent.textContent = "🚕"),
                    (taxiContent.style.fontSize = taxiBaseSize + "px"),
                    (taxiContent.style.lineHeight = "1"));
                  try {
                    taxiMarker = new google.maps.marker.AdvancedMarkerElement({
                      map: returnRouteMapInstance,
                      position: startLocation,
                      content: taxiContent,
                    });
                  } catch (_) {
                    taxiMarker = new google.maps.Marker({
                      position: startLocation,
                      map: returnRouteMapInstance,
                      icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 9,
                        fillColor: "#0a3d62",
                        fillOpacity: 1,
                        strokeColor: "#ffffff",
                        strokeWeight: 3,
                      },
                    });
                  }
                } else
                  taxiMarker = new google.maps.Marker({
                    position: startLocation,
                    map: returnRouteMapInstance,
                    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
                    label: { text: "🚕", fontSize: taxiBaseSize + "px" },
                  });
                returnRouteMarkers.push(taxiMarker);
              }
              if (endLocation) {
                const destinationMap = showDestinationImmediately
                  ? returnRouteMapInstance
                  : null;
                if (hasAdvancedMarkerReturn) {
                  const destinationContent = document.createElement("div");
                  ((destinationContent.textContent = "🏁"),
                    (destinationContent.style.fontSize =
                      destinationBaseSize + "px"),
                    (destinationContent.style.lineHeight = "1"));
                  try {
                    destinationMarker =
                      new google.maps.marker.AdvancedMarkerElement({
                        map: destinationMap,
                        position: endLocation,
                        content: destinationContent,
                      });
                  } catch (_) {
                    destinationMarker = new google.maps.Marker({
                      position: endLocation,
                      map: destinationMap,
                      icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 9,
                        fillColor: "#fbc531",
                        fillOpacity: 1,
                        strokeColor: "#ffffff",
                        strokeWeight: 3,
                      },
                    });
                  }
                } else
                  destinationMarker = new google.maps.Marker({
                    position: endLocation,
                    map: destinationMap,
                    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
                    label: { text: "🏁", fontSize: destinationBaseSize + "px" },
                  });
                returnRouteMarkers.push(destinationMarker);
              }
            };
          function createReturnRouteLabelOverlay(
            map,
            position,
            text,
            extraClass,
          ) {
            function RouteLabelOverlay(pos, txt, cls) {
              ((this.position = pos),
                (this.text = txt),
                (this.extraClass = cls || ""),
                (this.div = null),
                (this._typingTimer = null),
                (this._typingDonePromise = null),
                (this._typingDoneResolve = null));
            }
            ((RouteLabelOverlay.prototype = Object.create(
              google.maps.OverlayView.prototype,
            )),
              (RouteLabelOverlay.prototype.constructor = RouteLabelOverlay),
              (RouteLabelOverlay.prototype.startTyping = function () {
                if (
                  (this._typingDonePromise ||
                    (this._typingDonePromise = new Promise((resolve) => {
                      this._typingDoneResolve = resolve;
                    })),
                  !this.div)
                )
                  return this._typingDonePromise;
                const fullText = null != this.text ? String(this.text) : "";
                if (!fullText)
                  return (
                    (this.div.textContent = ""),
                    this._typingDoneResolve &&
                      (this._typingDoneResolve(),
                      (this._typingDoneResolve = null)),
                    this._typingDonePromise
                  );
                const mapDiv =
                    map && "function" == typeof map.getDiv
                      ? map.getDiv()
                      : null,
                  startTypingInner = () => {
                    if (!this.div) return;
                    try {
                      this.div.style.opacity = "1";
                    } catch (_) {}
                    this.div.textContent = "";
                    let index = 0;
                    const maxLength = fullText.length,
                      step = () => {
                        this.div &&
                          ((this.div.textContent = fullText.slice(
                            0,
                            index + 1,
                          )),
                          (index += 1),
                          index < maxLength
                            ? (this._typingTimer = setTimeout(step, 32))
                            : ((this._typingTimer = null),
                              this._typingDoneResolve &&
                                (this._typingDoneResolve(),
                                (this._typingDoneResolve = null))));
                      };
                    step();
                  };
                if (
                  mapDiv &&
                  !mapDiv.classList.contains("route-map--labels-ready")
                ) {
                  let attempts = 0;
                  const maxAttempts = 60,
                    waitUntilReady = () => {
                      this.div &&
                        (!mapDiv ||
                        mapDiv.classList.contains("route-map--labels-ready") ||
                        attempts >= maxAttempts
                          ? startTypingInner()
                          : ((attempts += 1), setTimeout(waitUntilReady, 32)));
                    };
                  waitUntilReady();
                } else startTypingInner();
                return this._typingDonePromise;
              }),
              (RouteLabelOverlay.prototype.onAdd = function () {
                const div = document.createElement("div");
                ((div.className =
                  "route-map-label" +
                  (this.extraClass ? " " + this.extraClass : "")),
                  (this.div = div));
                const panes = this.getPanes();
                (panes &&
                  panes.overlayMouseTarget &&
                  panes.overlayMouseTarget.appendChild(div),
                  this.startTyping());
              }),
              (RouteLabelOverlay.prototype.draw = function () {
                if (!this.div) return;
                const projection = this.getProjection();
                if (!projection) return;
                const point = projection.fromLatLngToDivPixel(this.position);
                point &&
                  ((this.div.style.left = point.x + 10 + "px"),
                  (this.div.style.top = point.y + 6 + "px"));
              }),
              (RouteLabelOverlay.prototype.onRemove = function () {
                (this._typingTimer &&
                  (clearTimeout(this._typingTimer), (this._typingTimer = null)),
                  this._typingDoneResolve &&
                    (this._typingDoneResolve(),
                    (this._typingDoneResolve = null)),
                  this.div &&
                    this.div.parentNode &&
                    this.div.parentNode.removeChild(this.div),
                  (this.div = null));
              }));
            const overlay = new RouteLabelOverlay(position, text, extraClass);
            return (overlay.setMap(map), overlay);
          }
          const originPlace =
              void 0 !== autocompleteSelectedPlaces &&
              autocompleteSelectedPlaces.origenVuelta
                ? autocompleteSelectedPlaces.origenVuelta
                : null,
            destinationPlace =
              void 0 !== autocompleteSelectedPlaces &&
              autocompleteSelectedPlaces.destinoVuelta
                ? autocompleteSelectedPlaces.destinoVuelta
                : null,
            origenVueltaInput = document.getElementById("origen-vuelta-calc"),
            destinoVueltaInput = document.getElementById("destino-vuelta-calc"),
            originLabelText = buildMapLabelFromPlaceOrAddress(
              originPlace,
              originText || (origenVueltaInput ? origenVueltaInput.value : "") || "",
            ),
            destinationLabelText = buildMapLabelFromPlaceOrAddress(
              destinationPlace,
              destinationText || (destinoVueltaInput ? destinoVueltaInput.value : "") || "",
            ),
            labelDistanceReturn =
              currentBookingDetails && currentBookingDetails.returnDistanceKm
                ? currentBookingDetails.returnDistanceKm
                : 0;
          let originLabelClassReturn = "route-map-label--origin",
            destinationLabelClassReturn = "route-map-label--destination";
          labelDistanceReturn > 0 &&
            labelDistanceReturn < 3 &&
            ((originLabelClassReturn += " route-map-label--short"),
            (destinationLabelClassReturn += " route-map-label--short"));
          let originLabelOverlayReturn = null,
            destinationLabelOverlayReturn = null;
          if (!fullPath.length) return;
          const distForAnimation =
              currentBookingDetails && currentBookingDetails.returnDistanceKm
                ? currentBookingDetails.returnDistanceKm
                : 0,
            bounceMarker = (marker, baseSize) => {
              if (marker)
                try {
                  if (
                    "function" == typeof marker.getLabel &&
                    "function" == typeof marker.setLabel
                  ) {
                    const currentLabel = marker.getLabel();
                    if (!currentLabel || !currentLabel.text) return;
                    const normalSize =
                        baseSize || parseInt(currentLabel.fontSize || "22", 10),
                      bigSize = normalSize + 8;
                    return (
                      marker.setLabel(
                        Object.assign({}, currentLabel, {
                          fontSize: bigSize + "px",
                        }),
                      ),
                      void setTimeout(() => {
                        marker.setLabel(
                          Object.assign({}, currentLabel, {
                            fontSize: normalSize + "px",
                          }),
                        );
                      }, 600)
                    );
                  }
                  const contentEl = marker.content;
                  if (contentEl && contentEl.style) {
                    const normalSize =
                        baseSize ||
                        parseInt(contentEl.style.fontSize || "22", 10),
                      bigSize = normalSize + 8;
                    ((contentEl.style.fontSize = bigSize + "px"),
                      setTimeout(() => {
                        contentEl.style.fontSize = normalSize + "px";
                      }, 600));
                  }
                } catch (_) {}
            },
            animatedPath = new google.maps.MVCArray();
          returnRoutePolyline = new google.maps.Polyline({
            path: animatedPath,
            map: returnRouteMapInstance,
            strokeColor: "#e2bf55",
            strokeOpacity: 1,
            strokeWeight: 4,
          });
          const getLatLngLiteral = (p) => {
              if (!p) return { lat: 0, lng: 0 };
              const lat = "function" == typeof p.lat ? p.lat() : p.lat,
                lng = "function" == typeof p.lng ? p.lng() : p.lng;
              return { lat: Number(lat), lng: Number(lng) };
            },
            haversineMeters = (a, b) => {
              const A = getLatLngLiteral(a),
                B = getLatLngLiteral(b),
                toRad = (deg) => deg * (Math.PI / 180),
                dLat = toRad(B.lat - A.lat),
                dLng = toRad(B.lng - A.lng),
                lat1 = toRad(A.lat),
                lat2 = toRad(B.lat),
                sinDLat = Math.sin(dLat / 2),
                sinDLng = Math.sin(dLng / 2),
                h =
                  sinDLat * sinDLat +
                  Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
              return 12742e3 * Math.asin(Math.min(1, Math.sqrt(h)));
            },
            pathForAnimation = ((path) => {
              const maxSegmentMeters =
                distForAnimation > 0 && distForAnimation <= 1
                  ? 45
                  : distForAnimation > 1 && distForAnimation <= 5
                    ? 85
                    : 0;
              if (!maxSegmentMeters || !Array.isArray(path) || path.length < 2)
                return path;
              const dense = [];
              for (let i = 0; i < path.length; i++) {
                const p = path[i],
                  lat = "function" == typeof p.lat ? p.lat() : p.lat,
                  lng = "function" == typeof p.lng ? p.lng() : p.lng;
                dense.push(new google.maps.LatLng(lat, lng));
              }
              for (let i = 0; i < path.length - 1; i++) {
                const a = dense[i],
                  b = dense[i + 1],
                  d = haversineMeters(a, b),
                  inserts = Math.min(
                    12,
                    Math.max(0, Math.ceil(d / maxSegmentMeters) - 1),
                  );
                if (inserts > 0) {
                  const A = getLatLngLiteral(a),
                    B = getLatLngLiteral(b);
                  for (let k = 1; k <= inserts; k++) {
                    const t = k / (inserts + 1),
                      lat = A.lat + (B.lat - A.lat) * t,
                      lng = A.lng + (B.lng - A.lng) * t;
                    dense.push(new google.maps.LatLng(lat, lng));
                  }
                }
              }
              return dense;
            })(fullPath),
            totalPoints = pathForAnimation.length;
          let index = 0,
            segmentCount = 190;
          distForAnimation > 5 && distForAnimation <= 40
            ? (segmentCount = 150)
            : distForAnimation > 40 && (segmentCount = 130);
          let step = Math.max(1, Math.floor(totalPoints / segmentCount));
          distForAnimation > 0 && distForAnimation <= 5 && (step = 1);
          const frameCountForAnimation = Math.max(
            1,
            Math.ceil(totalPoints / step),
          );
          let targetDurationMs = 0;
          distForAnimation > 0 && distForAnimation <= 1
            ? (targetDurationMs = 1500)
            : distForAnimation > 1 && distForAnimation <= 5
              ? (targetDurationMs = 2e3)
              : distForAnimation > 5 && distForAnimation <= 40
                ? (targetDurationMs = 3200)
                : distForAnimation > 40 && (targetDurationMs = 3800);
          const perFrameDelayMs =
              targetDurationMs > 0
                ? Math.min(
                    180,
                    Math.max(
                      0,
                      Math.round(
                        targetDurationMs / frameCountForAnimation - 16,
                      ),
                    ),
                  )
                : 0,
            drawNext = () => {
              const nextIndex = Math.min(totalPoints, index + step);
              for (let i = index; i < nextIndex; i++)
                animatedPath.push(pathForAnimation[i]);
              ((index = nextIndex),
                index < totalPoints
                  ? perFrameDelayMs > 0
                    ? setTimeout(() => scheduleFrame(drawNext), perFrameDelayMs)
                    : scheduleFrame(drawNext)
                  : setTimeout(() => {
                      try {
                        destinationMarker &&
                          ("function" == typeof destinationMarker.setMap
                            ? destinationMarker.setMap(returnRouteMapInstance)
                            : destinationMarker.map ||
                              (destinationMarker.map = returnRouteMapInstance));
                      } catch (_) {}
                      (((polyline) => {
                        if (polyline)
                          try {
                            const originalOpacity =
                                "function" == typeof polyline.get
                                  ? polyline.get("strokeOpacity")
                                  : 1,
                              originalColor =
                                "function" == typeof polyline.get
                                  ? polyline.get("strokeColor")
                                  : "#e2bf55",
                              originalWeight =
                                "function" == typeof polyline.get
                                  ? polyline.get("strokeWeight")
                                  : 4,
                              brightColor = "#f6e27a",
                              boostedWeight = originalWeight + 2;
                            (polyline.setOptions({
                              strokeOpacity: 1,
                              strokeColor: brightColor,
                              strokeWeight: boostedWeight,
                            }),
                              setTimeout(() => {
                                try {
                                  polyline.setOptions({
                                    strokeOpacity:
                                      null == originalOpacity
                                        ? 1
                                        : originalOpacity,
                                    strokeColor: originalColor || "#e2bf55",
                                    strokeWeight: originalWeight,
                                  });
                                } catch (_) {}
                              }, 600));
                          } catch (_) {}
                      })(returnRoutePolyline),
                        bounceMarker(taxiMarker, taxiBaseSize),
                        bounceMarker(destinationMarker, destinationBaseSize),
                        startLocation &&
                          originLabelText &&
                          !originLabelOverlayReturn &&
                          (originLabelOverlayReturn =
                            createReturnRouteLabelOverlay(
                              returnRouteMapInstance,
                              startLocation,
                              originLabelText,
                              originLabelClassReturn,
                            )),
                        endLocation &&
                          destinationLabelText &&
                          !destinationLabelOverlayReturn &&
                          (destinationLabelOverlayReturn =
                            createReturnRouteLabelOverlay(
                              returnRouteMapInstance,
                              endLocation,
                              destinationLabelText,
                              destinationLabelClassReturn,
                            )));
                    }, 220));
            },
            startReturnRouteAnimation = () => {
              (bounceMarker(taxiMarker, taxiBaseSize), drawNext());
            };
          (createMarkers(!1),
            (function waitForReturnMapReadyAndDelay() {
              !routeMapElement ||
              routeMapElement.classList.contains("route-map--ready")
                ? setTimeout(startReturnRouteAnimation, 1180)
                : setTimeout(waitForReturnMapReadyAndDelay, 50);
            })());
        }),
      currentBookingDetails &&
        currentBookingDetails.returnTrip &&
        returnIncludedSuccessEl &&
        confirmReturnBtn)
    ) {
      confirmReturnBtn.style.display = "none";
      const successMsg =
        calcMsgs && calcMsgs.returnIncludedSuccess
          ? calcMsgs.returnIncludedSuccess
          : "";
      (successMsg && (returnIncludedSuccessEl.textContent = successMsg),
        (returnIncludedSuccessEl.style.display = "inline-block"));
    }
    confirmReturnBtn &&
      confirmReturnBtn.addEventListener("click", () => {
        const pickupDateTime =
          currentBookingDetails && currentBookingDetails.returnPickupDateTime
            ? currentBookingDetails.returnPickupDateTime
            : null;
        if (!pickupDateTime) return void showMinLeadTimeNotice();
        const finalizeIncludeReturn = () => {
          ((currentBookingDetails.returnTrip = !0),
            returnTripYes && (returnTripYes.checked = !0),
            returnTripNo && (returnTripNo.checked = !1),
            updateTotalPriceAmount());
          const btnEl = document.getElementById("confirm-return-btn"),
            successEl = document.getElementById("return-included-success");
          if (
            (btnEl && ((btnEl.disabled = !0), (btnEl.style.display = "none")),
            successEl)
          ) {
            const msg =
              calcMsgs && calcMsgs.returnIncludedSuccess
                ? calcMsgs.returnIncludedSuccess
                : "";
            (msg && (successEl.textContent = msg),
              (successEl.style.display = "inline-block"));
          }
        };
        currentBookingDetails.returnRawPrice < 45
          ? (function (onAccept) {
              if (!returnCalcResultDiv) return;
              const formattedMinPrice = formatPrice(45);
              returnCalcResultDiv.innerHTML = `\n      <div class="min-price-notice min-price-notice--return">\n        <p>${calcMsgs.minPriceIntro}</p>\n        <p>${calcMsgs.minPriceLine(formattedMinPrice)}</p>\n        <p class="min-price-note" style="font-size: 0.9rem; color: #ccc; font-style: italic; text-align: center; border: none;">${calcMsgs.minPriceNote}</p>\n        <div class="min-price-buttons">\n          <button type="button" id="return-min-accept-btn" class="btn btn-primary">${calcMsgs.confirmReturnButton}</button>\n          <button type="button" id="return-min-cancel-btn" class="btn btn-light">${calcMsgs.returnCancelButton}</button>\n        </div>\n      </div>\n    `;
              try {
                returnCalcResultDiv.__returnMinPriceNoticeActive = !0;
              } catch (_) {}
              (showElement(returnCalcResultDiv),
                returnCalcResultDiv.addEventListener("click", function (e) {
                  (e.target &&
                    "return-min-accept-btn" === e.target.id &&
                    (currentBookingDetails &&
                      ((currentBookingDetails.returnPrice = 45),
                      (currentBookingDetails.returnTrip = !0)),
                    updateTotalPriceAmount(),
                    displayReturnCalculationResult(
                      45,
                      currentBookingDetails &&
                        "number" ==
                          typeof currentBookingDetails.returnDistanceKm
                        ? currentBookingDetails.returnDistanceKm
                        : 0,
                      currentBookingDetails &&
                        "string" ==
                          typeof currentBookingDetails.returnDurationText
                        ? currentBookingDetails.returnDurationText
                        : "",
                      !1,
                    ),
                    // Verificar las 12 horas después de aceptar el precio mínimo
                    (pickupDateTime.getTime() - new Date().getTime()) / 36e5 < 12
                      ? showMinLeadTimeNotice()
                      : "function" == typeof onAccept && onAccept()),
                    e.target &&
                      "return-min-cancel-btn" === e.target.id &&
                      (hideElementSmooth(returnCalcResultDiv),
                      cancelReturnTrip()));
                }));
            })(finalizeIncludeReturn)
          : (function () {
              if ((pickupDateTime.getTime() - new Date().getTime()) / 36e5 < 12)
                return void showMinLeadTimeNotice();
              finalizeIncludeReturn();
            })();
      });
  }
  function cancelReturnTrip() {
    (returnTripNo && (returnTripNo.checked = !0),
      returnTripYes && (returnTripYes.checked = !1),
      origenVueltaInput && (origenVueltaInput.required = !1),
      destinoVueltaInput && (destinoVueltaInput.required = !1),
      returnDateInput && (returnDateInput.required = !1),
      returnTimeInput && (returnTimeInput.required = !1),
      (currentBookingDetails.returnTrip = !1),
      (currentBookingDetails.returnPrice = 0),
      (currentBookingDetails.returnDistanceKm = 0),
      (currentBookingDetails.returnDurationText = ""),
      (currentBookingDetails.returnOrigin = ""),
      (currentBookingDetails.returnDestination = ""),
      (currentBookingDetails.returnPickupDateTime = null),
      // Guardar el precio del trayecto de ida antes de modificar currentCalculation
      currentCalculation && currentCalculation.totalPriceOneWay > 0 &&
        (currentBookingDetails.oneWayPrice = currentCalculation.totalPriceOneWay),
      updateTotalPriceAmount());
    const returnMapContainer = document.getElementById(
        "return-route-map-container",
      ),
      performUiCloseAndScroll = () => {
        (hideElementSmooth(returnDetailsDiv, 140),
          hideElementSmooth(returnCalcResultDiv, 140),
          hideElementSmooth(additionalTripForm, 140),
          hideElementSmooth(additionalTripCalcResultDiv, 140),
          // Solo ocultar la sección de trayectos adicionales si no hay trayectos añadidos
          additionalTripsList &&
            additionalTripsList.children.length === 0 &&
            additionalTripsSection &&
            (additionalTripsSection.style.display = "none"),
          // Si hay trayectos adicionales, mantener la sección visible pero ocultar el botón de añadir
          additionalTripsList &&
            additionalTripsList.children.length > 0 &&
            (additionalTripsSection && (additionalTripsSection.style.display = "block"),
            totalPriceSection && showElement(totalPriceSection),
            addAdditionalTripBtnWrapper &&
            (addAdditionalTripBtnWrapper.style.display = "none")));
        const returnTripWrapper = document.getElementById(
          "return-trip-wrapper",
        );
        if (returnTripWrapper && "undefined" != typeof window)
          try {
            setTimeout(() => {
              const startY = window.pageYOffset || window.scrollY || 0,
                distance =
                  returnTripWrapper.getBoundingClientRect().top +
                  startY -
                  130 -
                  startY;
              let startTime = null;
              window.requestAnimationFrame(function step(timestamp) {
                startTime || (startTime = timestamp);
                const elapsed = timestamp - startTime,
                  progress = Math.min(elapsed / 1e3, 1),
                  eased = ((t = progress), 1 - Math.pow(1 - t, 3));
                var t;
                (window.scrollTo(0, startY + distance * eased),
                  progress < 1
                    ? window.requestAnimationFrame(step)
                    : (returnTripNo &&
                        "function" == typeof returnTripNo.focus &&
                        returnTripNo.focus(),
                      returnTripWrapper.classList.add(
                        "highlight-return-question",
                      ),
                      setTimeout(() => {
                        returnTripWrapper.classList.remove(
                          "highlight-return-question",
                        );
                      }, 900)));
              });
            }, 140);
          } catch (e) {}
      };
    if (
      !(
        !returnMapContainer || !returnMapContainer.classList.contains("visible")
      )
    ) {
      (returnMapContainer.classList.remove("visible"),
        returnMapContainer.setAttribute("aria-hidden", "true"));
      const returnMapEl = document.getElementById("return-route-map");
      (returnMapEl && returnMapEl.classList.remove("route-map--ready"),
        setTimeout(performUiCloseAndScroll, 200));
    } else performUiCloseAndScroll();
    showBookingForm();
  }
  function showBookingForm() {
    const wrapper = document.getElementById("booking-form-wrapper"),
      section = document.getElementById("formulario-reserva");
    // Asegurarse de que totalAmountDisplay está definido
    if (!totalAmountDisplay) {
      totalAmountDisplay = document.getElementById("total-amount-display");
    }
    // Asegurarse de que totalPriceSection está definido
    if (!totalPriceSection) {
      totalPriceSection = document.querySelector(".total-price-section");
    }
    if (
      (wrapper &&
        (wrapper.classList.add("visible"), (wrapper.style.display = "block")),
      section && (section.style.display = "block"),
      totalPriceSection && showElement(totalPriceSection),
      section && "undefined" != typeof window)
    ) {
      // Pequeño retraso para asegurar que el DOM esté actualizado antes de actualizar el precio
      setTimeout(() => {
        // Volver a buscar el elemento por si el DOM cambió
        totalAmountDisplay = document.getElementById("total-amount-display");
        updateTotalPriceAmount();
      }, 50);
      try {
        const computeOffset = () => {
            try {
              const nav = document.querySelector(".navbar"),
                navH = (nav && nav.getBoundingClientRect().height) || 0;
              return Math.max(0, Math.round(navH + 24));
            } catch (_) {
              return 120;
            }
          },
          scrollToSectionTop = () => {
            const offset = computeOffset(),
              y =
                (window.pageYOffset || window.scrollY || 0) +
                section.getBoundingClientRect().top -
                offset;
            window.scrollTo({
              top: Math.max(0, Math.round(y)),
              behavior: "smooth",
            });
          };
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            (scrollToSectionTop(),
              setTimeout(() => {
                try {
                  const offset = computeOffset(),
                    topNow = section.getBoundingClientRect().top;
                  (topNow < offset - 6 || topNow > offset + 6) &&
                    window.scrollBy({
                      top: Math.round(topNow - offset),
                      left: 0,
                      behavior: "auto",
                    });
                } catch (_) {}
              }, 420));
          });
        });
      } catch (_) {}
    } else
      bookingSectionTitle &&
        "function" == typeof bookingSectionTitle.scrollIntoView &&
        bookingSectionTitle.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
  }
  function resetCalculatorForm() {
    try {
      (origenCalcInput && (origenCalcInput.value = ""),
        destinoCalcInput && (destinoCalcInput.value = ""),
        fechaCalcInput && (fechaCalcInput.value = ""),
        horaCalcInput && (horaCalcInput.value = ""),
        (autocompleteSelectedPlaces.origenCalc = null),
        (autocompleteSelectedPlaces.destinoCalc = null));
      const origenSummary = document.getElementById("origen-calc-summary"),
        destinoSummary = document.getElementById("destino-calc-summary");
      (clearAddressSummary(origenSummary),
        clearAddressSummary(destinoSummary),
        (currentCalculation = {
          origin: "",
          destination: "",
          distanceKm: 0,
          durationSeconds: 0,
          durationText: "",
          rawPrice: 0,
          totalPriceOneWay: 0,
          pickupDateTime: null,
          isBelowMinPrice: !1,
          isMinPriceApplied: !1,
          lastRequestKey: "",
        }),
        (currentRouteOverviewPath = null),
        (currentRouteStartLocation = null),
        (currentRouteEndLocation = null),
        (currentRouteBounds = null),
        (routeMapInstance = null),
        (routeMapPolyline = null),
        (routeMapMarkers = []),
        setMinDate(),
        fechaCalcInput && (fechaCalcInput.value = ""));
    } catch (_) {}
  }
  function resetBookingForm() {
    // Guardar el precio del trayecto de ida si ya se ha calculado
    const savedOneWayPrice = currentBookingDetails && currentBookingDetails.oneWayPrice > 0 ? currentBookingDetails.oneWayPrice : 0;
    ((currentBookingDetails = {
      returnTrip: !1,
      returnPrice: 0,
      finalTotalPrice: 0,
      oneWayPrice: savedOneWayPrice,
      returnDistanceKm: 0,
      returnDurationText: "",
      returnOrigin: "",
      returnDestination: "",
      returnRawPrice: 0,
      returnPickupDateTime: null,
    }),
      hideElement(returnDetailsDiv),
      hideElement(childSeatQuestionsDiv),
      hideElement(babySeatAgeQuestionDiv),
      hideElement(returnCalcResultDiv),
      totalPriceSection && hideElement(totalPriceSection),
      bookingForm && bookingForm.reset(),
      returnTripNo && (returnTripNo.checked = !0),
      needsSRINo && (needsSRINo.checked = !0),
      origenVueltaInput && (origenVueltaInput.required = !1),
      destinoVueltaInput && (destinoVueltaInput.required = !1),
      returnDateInput && (returnDateInput.required = !1),
      returnTimeInput && (returnTimeInput.required = !1),
      updateTotalPriceAmount());
  }
  function populateBookingForm() {
    if (!currentCalculation.pickupDateTime) return;
    (origenBookInput && (origenBookInput.value = currentCalculation.origin),
      destinoBookInput &&
        (destinoBookInput.value = currentCalculation.destination));
    const pickupDate = currentCalculation.pickupDateTime;
    (fechaBookInput &&
      (fechaBookInput.value = pickupDate.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })),
      horaBookInput &&
        (horaBookInput.value = pickupDate.toLocaleTimeString("es-ES", {
          hour: "2-digit",
          minute: "2-digit",
        })));
    pickupDate.toISOString().split("T")[0];
    if (
      (returnDateInput && (returnDateInput.value = ""),
      returnTimeInput && (returnTimeInput.value = ""),
      origenVueltaInput)
    ) {
      let swappedOriginText = currentCalculation.destination;
      try {
        const swappedOriginPlace =
          void 0 !== autocompleteSelectedPlaces
            ? autocompleteSelectedPlaces.destinoCalc
            : null;
        if (swappedOriginPlace && swappedOriginPlace.place_id) {
          if (
            ((swappedOriginText = (
              swappedOriginPlace.name ||
              swappedOriginPlace.formatted_address ||
              swappedOriginText ||
              ""
            ).trim()),
            swappedOriginText)
          ) {
            const simplifiedAirport = simplifyAirportName(swappedOriginText);
            simplifiedAirport && (swappedOriginText = simplifiedAirport);
          }
          // Asegurar que se copian las coordenadas para evitar rutas incorrectas
          let originLat = null, originLng = null;
          if (swappedOriginPlace.geometry && swappedOriginPlace.geometry.location) {
            const loc = swappedOriginPlace.geometry.location;
            originLat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
            originLng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
          } else if (swappedOriginPlace.lat && swappedOriginPlace.lng) {
            originLat = typeof swappedOriginPlace.lat === 'function' ? swappedOriginPlace.lat() : swappedOriginPlace.lat;
            originLng = typeof swappedOriginPlace.lng === 'function' ? swappedOriginPlace.lng() : swappedOriginPlace.lng;
          }
          
          const swappedOriginPlaceWithCoords = {
            ...swappedOriginPlace,
            lat: originLat,
            lng: originLng,
            geometry: swappedOriginPlace.geometry || {
              location: {
                lat: () => originLat,
                lng: () => originLng
              }
            }
          };
          ((autocompleteSelectedPlaces.origenVuelta = swappedOriginPlaceWithCoords),
            (autocompleteSuppressNextInputInvalidation.origenVuelta = !0),
            (autocompleteLastConfirmedText.origenVuelta = swappedOriginText),
            updateAddressSummary(
              document.getElementById("origen-vuelta-calc-summary"),
              swappedOriginPlaceWithCoords,
            ),
            setTimeout(() => {
              try {
                autocompleteSuppressNextInputInvalidation.origenVuelta = !1;
              } catch (_) {}
            }, 0));
        }
      } catch (_) {}
      ((origenVueltaInput.value = swappedOriginText),
        origenVueltaInput.dispatchEvent(new Event("input", { bubbles: !0 })));
    }
    if (destinoVueltaInput) {
      let swappedDestinationText = currentCalculation.origin;
      try {
        const swappedDestinationPlace =
          void 0 !== autocompleteSelectedPlaces
            ? autocompleteSelectedPlaces.origenCalc
            : null;
        if (swappedDestinationPlace && swappedDestinationPlace.place_id) {
          if (
            ((swappedDestinationText = (
              swappedDestinationPlace.name ||
              swappedDestinationPlace.formatted_address ||
              swappedDestinationText ||
              ""
            ).trim()),
            swappedDestinationText)
          ) {
            const simplifiedAirport = simplifyAirportName(
              swappedDestinationText,
            );
            simplifiedAirport && (swappedDestinationText = simplifiedAirport);
          }
          // Asegurar que se copian las coordenadas para evitar rutas incorrectas
          let destLat = null, destLng = null;
          if (swappedDestinationPlace.geometry && swappedDestinationPlace.geometry.location) {
            const loc = swappedDestinationPlace.geometry.location;
            destLat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
            destLng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
          } else if (swappedDestinationPlace.lat && swappedDestinationPlace.lng) {
            destLat = typeof swappedDestinationPlace.lat === 'function' ? swappedDestinationPlace.lat() : swappedDestinationPlace.lat;
            destLng = typeof swappedDestinationPlace.lng === 'function' ? swappedDestinationPlace.lng() : swappedDestinationPlace.lng;
          }
          
          const swappedDestinationPlaceWithCoords = {
            ...swappedDestinationPlace,
            lat: destLat,
            lng: destLng,
            geometry: swappedDestinationPlace.geometry || {
              location: {
                lat: () => destLat,
                lng: () => destLng
              }
            }
          };
          ((autocompleteSelectedPlaces.destinoVuelta = swappedDestinationPlaceWithCoords),
            (autocompleteSuppressNextInputInvalidation.destinoVuelta = !0),
            (autocompleteLastConfirmedText.destinoVuelta =
              swappedDestinationText),
            updateAddressSummary(
              document.getElementById("destino-vuelta-calc-summary"),
              swappedDestinationPlaceWithCoords,
            ),
            setTimeout(() => {
              try {
                autocompleteSuppressNextInputInvalidation.destinoVuelta = !1;
              } catch (_) {}
            }, 0));
        }
      } catch (_) {}
      ((destinoVueltaInput.value = swappedDestinationText),
        destinoVueltaInput.dispatchEvent(new Event("input", { bubbles: !0 })));
    }
  }
  function updateTotalPriceAmount() {
    // Asegurarse de que totalAmountDisplay está definido
    if (!totalAmountDisplay) {
      totalAmountDisplay = document.getElementById("total-amount-display");
    }
    const oneWayPrice =
      (currentCalculation &&
      "number" == typeof currentCalculation.totalPriceOneWay
        ? currentCalculation.totalPriceOneWay
        : 0) ||
      (currentBookingDetails &&
      "number" == typeof currentBookingDetails.oneWayPrice
        ? currentBookingDetails.oneWayPrice
        : 0);
    const finalTotal =
      oneWayPrice +
      (!(!currentBookingDetails || !0 !== currentBookingDetails.returnTrip) &&
      currentBookingDetails &&
      "number" == typeof currentBookingDetails.returnPrice
        ? currentBookingDetails.returnPrice
        : 0) +
      window.additionalTrips.reduce((sum, trip) => sum + (trip.price || 0), 0);
    (currentBookingDetails &&
      ((currentBookingDetails.finalTotalPrice = finalTotal),
      (currentBookingDetails.additionalTrips = window.additionalTrips)),
      totalAmountDisplay &&
        (totalAmountDisplay.textContent = formatPrice(finalTotal)));
  }
  function invalidateReturnCalculation() {
    if (
      (currentBookingDetails &&
        ((currentBookingDetails.returnTrip = !1),
        (currentBookingDetails.returnPrice = 0),
        (currentBookingDetails.returnRawPrice = 0),
        (currentBookingDetails.returnDistanceKm = 0),
        (currentBookingDetails.returnDurationText = ""),
        (currentBookingDetails.returnPickupDateTime = null)),
      returnCalcResultDiv)
    ) {
      try {
        returnCalcResultDiv.__returnMinPriceNoticeActive = !1;
      } catch (_) {}
      hideElementSmooth(returnCalcResultDiv);
      try {
        ((returnCalcResultDiv.innerHTML = ""),
          returnCalcResultDiv.style &&
            (returnCalcResultDiv.style.display = "none"));
      } catch (_) {}
    }
    updateTotalPriceAmount();
  }
  function attachInvalidateReturnOnChange(el) {
    if (!el) return;
    const type =
      el.getAttribute && "function" == typeof el.getAttribute
        ? String(el.getAttribute("type") || "").toLowerCase()
        : "";
    if (!type || "text" === type || "search" === type) {
      el.__returnLastValueForInvalidate =
        "string" == typeof el.value ? el.value : "";
      const beforeInputHandler = (e) => {
          e &&
            "string" == typeof e.inputType &&
            0 === e.inputType.indexOf("delete") &&
            invalidateReturnCalculation();
        },
        inputHandler = () => {
          const prev =
              "string" == typeof el.__returnLastValueForInvalidate
                ? el.__returnLastValueForInvalidate
                : "",
            next = "string" == typeof el.value ? el.value : "";
          (next.length < prev.length && invalidateReturnCalculation(),
            (el.__returnLastValueForInvalidate = next));
        };
      return (
        el.addEventListener("beforeinput", beforeInputHandler),
        void el.addEventListener("input", inputHandler)
      );
    }
    const handler = () => {
      invalidateReturnCalculation();
    };
    (el.addEventListener("input", handler),
      el.addEventListener("change", handler));
  }
  function resetBookingFieldErrors() {
    [
      "nombre",
      "email",
      "telefono",
      "pasajeros",
      "origen-vuelta-calc",
      "destino-vuelta-calc",
      "return-date",
      "return-time",
      "accept-terms",
    ].forEach((id) => {
      const msgEl = document.getElementById(id + "-error");
      msgEl && (msgEl.textContent = "");
    });
    [
      "nombre",
      "email",
      "telefono",
      "pasajeros",
      "origen-vuelta-calc",
      "destino-vuelta-calc",
      "return-date",
      "return-time",
    ].forEach((id) => {
      const el = document.getElementById(id);
      el &&
        el.style &&
        ((el.style.borderColor = ""), (el.style.boxShadow = ""));
    });
  }
  function markFieldAsError(el) {
    el &&
      el.style &&
      ((el.style.borderColor = "var(--error-color)"),
      (el.style.boxShadow = "0 0 0 1px rgba(220,53,69,0.3)"));
  }
  function setFieldErrorMessage(fieldId, message) {
    const msgEl = document.getElementById(fieldId + "-error");
    msgEl && (msgEl.textContent = message || "");
  }
  function initConfirmationMap(isReturn = !1) {
    const mapElement = document.getElementById(
        isReturn ? "confirm-vuelta-route-map" : "confirm-ida-route-map",
      ),
      container = document.getElementById(
        isReturn
          ? "confirm-vuelta-route-container"
          : "confirm-ida-route-container",
      ),
      chipElement = document.getElementById(
        isReturn ? "confirm-vuelta-route-chip" : "confirm-ida-route-chip",
      );
    if (!mapElement || !container) return;
    if (isReturn)
      try {
        const vueltaSection = document.getElementById("confirm-vuelta-section");
        if (
          !vueltaSection ||
          "none" === vueltaSection.style.display ||
          "true" === vueltaSection.getAttribute("aria-hidden")
        ) {
          try {
            container.dataset &&
              (delete container.dataset.confirmMapStateReturn,
              delete container.dataset.confirmMapAnimReturn);
          } catch (_) {}
          if (vueltaSection && "IntersectionObserver" in window)
            try {
              new IntersectionObserver(
                (entries, obs) => {
                  for (const entry of entries)
                    if (entry.isIntersecting) {
                      obs.disconnect();
                      try {
                        initConfirmationMap(!0);
                      } catch (_) {}
                      break;
                    }
                },
                { threshold: 0.1 },
              ).observe(vueltaSection);
            } catch (_) {}
          return;
        }
      } catch (_) {}
    const stateKey = isReturn
        ? "confirmMapStateReturn"
        : "confirmMapStateOneWay",
      animationKey = isReturn ? "confirmMapAnimReturn" : "confirmMapAnimOneWay";
    try {
      if (container.dataset && "ready" === container.dataset[stateKey]) return;
    } catch (_) {}
    let fullPath =
      (isReturn ? currentReturnRouteOverviewPath : currentRouteOverviewPath) ||
      [];
    fullPath = fullPath
      .map((p) => {
        if (!p) return null;
        const lat = "function" == typeof p.lat ? p.lat() : p.lat,
          lng = "function" == typeof p.lng ? p.lng() : p.lng;
        return new google.maps.LatLng(lat, lng);
      })
      .filter((p) => null !== p);
    const startLocation = isReturn
        ? currentReturnRouteStartLocation
        : currentRouteStartLocation,
      endLocation = isReturn
        ? currentReturnRouteEndLocation
        : currentRouteEndLocation;
    if (!fullPath.length || !startLocation || !endLocation) return;
    const distanceKm = isReturn
        ? currentBookingDetails?.returnDistanceKm || 0
        : currentCalculation?.distanceKm || 0,
      durationText = isReturn
        ? currentBookingDetails?.returnDurationText || ""
        : currentCalculation?.durationText || "";
    chipElement &&
      distanceKm > 0 &&
      durationText &&
      (chipElement.textContent = `${distanceKm.toFixed(1)} km · ${durationText}`);
    (async () => {
      try {
        await loadGoogleMapsIfNeeded();
      } catch (_) {
        return null;
      }
      if (!googleApiLoaded || void 0 === google.maps.Map) return null;
      const bounds = new google.maps.LatLngBounds();
      fullPath.forEach((p) => bounds.extend(p));
      let padding = 40;
      distanceKm > 0 && distanceKm <= 5
        ? (padding = 55)
        : distanceKm > 5 && distanceKm <= 40
          ? (padding = 30)
          : distanceKm > 40 && (padding = 15);
      let mapInstance = null;
      try {
        mapInstance = new google.maps.Map(mapElement, {
          center: startLocation,
          zoom: 11,
          disableDefaultUI: !0,
          clickableIcons: !1,
          keyboardShortcuts: !1,
          gestureHandling: "greedy",
          mapId: "150019df79666595709f2472",
        });
      } catch (e) {
        return (
          console.error("Confirmation map init failed (create map)", e),
          null
        );
      }
      try {
        ((mapElement.style.height = "350px"), (mapElement.style.opacity = "1"));
      } catch (_) {}
      new google.maps.Polyline({
        path: fullPath || [],
        geodesic: !0,
        strokeColor: "#d4af37",
        strokeOpacity: 0.2,
        strokeWeight: 4,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        zIndex: 5,
        map: mapInstance,
      });
      try {
        const hasAdvancedMarker = !(
            !google.maps.marker || !google.maps.marker.AdvancedMarkerElement
          ),
          createEmojiMarker = (pos, emoji) => {
            if (!pos) return null;
            if (hasAdvancedMarker) {
              const el = document.createElement("div");
              return (
                (el.textContent = emoji),
                (el.style.fontSize = "30px"),
                (el.style.lineHeight = "1"),
                (el.style.transform = "translate3d(0,0,0)"),
                new google.maps.marker.AdvancedMarkerElement({
                  map: mapInstance,
                  position: pos,
                  content: el,
                })
              );
            }
            return new google.maps.Marker({
              position: pos,
              map: mapInstance,
              icon: { path: google.maps.SymbolPath.CIRCLE, scale: 0 },
              label: { text: emoji, fontSize: "28px" },
            });
          };
        function createRouteLabelOverlay(map, position, text, extraClass) {
          function RouteLabelOverlay(pos, txt, cls) {
            ((this.position = pos),
              (this.text = txt),
              (this.extraClass = cls || ""),
              (this.div = null));
          }
          ((RouteLabelOverlay.prototype = Object.create(
            google.maps.OverlayView.prototype,
          )),
            (RouteLabelOverlay.prototype.constructor = RouteLabelOverlay),
            (RouteLabelOverlay.prototype.onAdd = function () {
              const div = document.createElement("div");
              ((div.className =
                "route-map-label" +
                (this.extraClass ? " " + this.extraClass : "")),
                (div.textContent = null != this.text ? String(this.text) : ""),
                (this.div = div));
              const panes = this.getPanes();
              panes && panes.floatPane && panes.floatPane.appendChild(div);
            }),
            (RouteLabelOverlay.prototype.draw = function () {
              if (!this.div) return;
              const projection = this.getProjection();
              if (!projection) return;
              const point = projection.fromLatLngToDivPixel(this.position);
              if (!point) return;
              ((this.div.style.left = point.x + 18 + "px"),
                (this.div.style.top = point.y + -14 + "px"));
            }),
            (RouteLabelOverlay.prototype.onRemove = function () {
              (this.div &&
                this.div.parentNode &&
                this.div.parentNode.removeChild(this.div),
                (this.div = null));
            }));
          const overlay = new RouteLabelOverlay(position, text, extraClass);
          return (overlay.setMap(map), overlay);
        }
        (createEmojiMarker(startLocation, "🚕"),
          createEmojiMarker(endLocation, "🏁"));
        const originTitle = buildShortAddressLabel(
            isReturn
              ? currentBookingDetails && currentBookingDetails.returnOrigin
                ? currentBookingDetails.returnOrigin
                : ""
              : currentCalculation && currentCalculation.origin
                ? currentCalculation.origin
                : "",
          ),
          destinationTitle = buildShortAddressLabel(
            isReturn
              ? currentBookingDetails && currentBookingDetails.returnDestination
                ? currentBookingDetails.returnDestination
                : ""
              : currentCalculation && currentCalculation.destination
                ? currentCalculation.destination
                : "",
          ),
          originText =
            originTitle ||
            getMessagesSection("calc").routeOriginLabel ||
            "Origen",
          destinationText =
            destinationTitle ||
            getMessagesSection("calc").routeDestinationLabel ||
            "Destino";
        (createRouteLabelOverlay(
          mapInstance,
          startLocation,
          originText,
          "route-map-label--origin",
        ),
          createRouteLabelOverlay(
            mapInstance,
            endLocation,
            destinationText,
            "route-map-label--destination",
          ));
      } catch (_) {}
      try {
        mapInstance.fitBounds(bounds, padding);
      } catch (_) {}
      setTimeout(() => {
        try {
          (google.maps.event.trigger(mapInstance, "resize"),
            mapInstance.fitBounds(bounds, padding));
        } catch (_) {}
      }, 150);
      try {
        container.dataset && (container.dataset[stateKey] = "ready");
      } catch (_) {}
      return { mapInstance: mapInstance, bounds: bounds, padding: padding };
    })().then((ctx) => {
      if (!ctx) return;
      const animObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            if (
              entry.intersectionRatio >= 0.55 &&
              "done" !== container.dataset[animationKey]
            ) {
              ((container.dataset[animationKey] = "done"),
                animObserver.disconnect());
              try {
                try {
                  (google.maps.event.trigger(ctx.mapInstance, "resize"),
                    ctx.mapInstance.fitBounds(ctx.bounds, ctx.padding));
                } catch (_) {}
                const animPolyline = new google.maps.Polyline({
                    path: new google.maps.MVCArray(),
                    map: ctx.mapInstance,
                    strokeColor: "#e2bf55",
                    strokeOpacity: 1,
                    strokeWeight: 4,
                  }),
                  getLatLngLiteral = (p) => {
                    if (!p) return { lat: 0, lng: 0 };
                    const lat = "function" == typeof p.lat ? p.lat() : p.lat,
                      lng = "function" == typeof p.lng ? p.lng() : p.lng;
                    return { lat: Number(lat), lng: Number(lng) };
                  },
                  haversineMeters = (a, b) => {
                    const A = getLatLngLiteral(a),
                      B = getLatLngLiteral(b),
                      toRad = (deg) => deg * (Math.PI / 180),
                      dLat = toRad(B.lat - A.lat),
                      dLng = toRad(B.lng - A.lng),
                      lat1 = toRad(A.lat),
                      lat2 = toRad(B.lat),
                      sinDLat = Math.sin(dLat / 2),
                      sinDLng = Math.sin(dLng / 2),
                      h =
                        sinDLat * sinDLat +
                        Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
                    return 12742e3 * Math.asin(Math.min(1, Math.sqrt(h)));
                  },
                  pathForAnimation = ((path) => {
                    const maxSegmentMeters =
                      distanceKm > 0 && distanceKm <= 1
                        ? 45
                        : distanceKm > 1 && distanceKm <= 5
                          ? 85
                          : 0;
                    if (
                      !maxSegmentMeters ||
                      !Array.isArray(path) ||
                      path.length < 2
                    )
                      return path;
                    const dense = [path[0]];
                    for (let i = 0; i < path.length - 1; i++) {
                      const a = path[i],
                        b = path[i + 1],
                        d = haversineMeters(a, b),
                        inserts = Math.min(
                          12,
                          Math.max(0, Math.ceil(d / maxSegmentMeters) - 1),
                        );
                      if (inserts > 0) {
                        const A = getLatLngLiteral(a),
                          B = getLatLngLiteral(b);
                        for (let k = 1; k <= inserts; k++) {
                          const t = k / (inserts + 1),
                            lat = A.lat + (B.lat - A.lat) * t,
                            lng = A.lng + (B.lng - A.lng) * t;
                          dense.push(new google.maps.LatLng(lat, lng));
                        }
                      }
                      dense.push(b);
                    }
                    return dense;
                  })(fullPath),
                  totalPoints = pathForAnimation.length;
                let index = 0,
                  segmentCount = 190;
                distanceKm > 5 && distanceKm <= 40
                  ? (segmentCount = 150)
                  : distanceKm > 40 && (segmentCount = 130);
                let step = Math.max(1, Math.floor(totalPoints / segmentCount));
                distanceKm > 0 && distanceKm <= 5 && (step = 1);
                const frameCountForAnimation = Math.max(
                  1,
                  Math.ceil(totalPoints / step),
                );
                let targetDurationMs = 0;
                distanceKm > 0 && distanceKm <= 1
                  ? (targetDurationMs = 1500)
                  : distanceKm > 1 && distanceKm <= 5
                    ? (targetDurationMs = 2e3)
                    : distanceKm > 5 && distanceKm <= 40
                      ? (targetDurationMs = 3200)
                      : distanceKm > 40 && (targetDurationMs = 3800);
                const perFrameDelayMs =
                    targetDurationMs > 0
                      ? Math.min(
                          180,
                          Math.max(
                            0,
                            Math.round(
                              targetDurationMs / frameCountForAnimation - 16,
                            ),
                          ),
                        )
                      : 0,
                  scheduleFrame = (callback) => requestAnimationFrame(callback),
                  drawNext = () => {
                    const nextIndex = Math.min(totalPoints, index + step);
                    for (let i = index; i < nextIndex; i++)
                      animPolyline.getPath().push(pathForAnimation[i]);
                    ((index = nextIndex),
                      index < totalPoints &&
                        (perFrameDelayMs > 0
                          ? setTimeout(
                              () => scheduleFrame(drawNext),
                              perFrameDelayMs,
                            )
                          : scheduleFrame(drawNext)));
                  };
                setTimeout(drawNext, 320);
              } catch (_) {}
            }
          });
        },
        {
          root: document.querySelector(".confirmation-grid"),
          threshold: [0.25, 0.5, 0.75, 0.9, 0.98, 1],
        },
      );
      animObserver.observe(container);
    });
  }
  function createConfirmationRouteToggle({
    toggleButton: toggleButton,
    container: container,
    mapElement: mapElement,
    chipElement: chipElement,
    isReturn: isReturn,
  }) {
    initConfirmationMap(isReturn);
  }
  if (
    (returnTripYes &&
      returnTripNo &&
      returnDetailsDiv &&
      (returnTripYes.addEventListener("change", () => {
        if (returnTripYes.checked) {
          (showElement(returnDetailsDiv),
            showElement(additionalTripsList),
            additionalTripForm &&
              additionalTripFormOriginalParent &&
              additionalTripFormOriginalParent.insertBefore(
                additionalTripForm,
                additionalTripFormOriginalNextSibling,
              ),
            addAdditionalTripBtnWrapper &&
              addAdditionalTripBtnOriginalParent &&
              addAdditionalTripBtnOriginalParent.insertBefore(
                addAdditionalTripBtnWrapper,
                addAdditionalTripBtnOriginalNextSibling,
              ),
            additionalTripsSection &&
              (additionalTripsSection.style.display = "block"),
            addAdditionalTripBtnWrapper &&
              (addAdditionalTripBtnWrapper.style.display = "block"),
            // Si hay trayectos adicionales, asegurar que el botón de añadir más esté visible
            additionalTripsList &&
              additionalTripsList.children.length > 0 &&
              addAdditionalTripBtnWrapper &&
              (addAdditionalTripBtnWrapper.style.display = "block"),
            origenVueltaInput && (origenVueltaInput.required = !0),
            destinoVueltaInput && (destinoVueltaInput.required = !0),
            returnDateInput && (returnDateInput.required = !0),
            returnTimeInput && (returnTimeInput.required = !0));
          const returnTripWrapper = document.getElementById(
            "return-trip-wrapper",
          );
          if (returnTripWrapper && "undefined" != typeof window)
            try {
              setTimeout(() => {
                const startY = window.pageYOffset || window.scrollY || 0,
                  distance =
                    returnTripWrapper.getBoundingClientRect().top +
                    startY -
                    130 -
                    startY;
                let startTime = null;
                window.requestAnimationFrame(function step(timestamp) {
                  startTime || (startTime = timestamp);
                  const elapsed = timestamp - startTime,
                    progress = Math.min(elapsed / 450, 1),
                    eased = ((t = progress), 1 - Math.pow(1 - t, 3));
                  var t;
                  (window.scrollTo(0, startY + distance * eased),
                    progress < 1
                      ? window.requestAnimationFrame(step)
                      : (returnTripYes &&
                          "function" == typeof returnTripYes.focus &&
                          returnTripYes.focus(),
                        returnTripWrapper.classList.add(
                          "highlight-return-question",
                        ),
                        setTimeout(() => {
                          returnTripWrapper.classList.remove(
                            "highlight-return-question",
                          );
                        }, 900)));
                });
              }, 80);
            } catch (e) {}
        }
        updateTotalPriceAmount();
      }),
      returnTripNo.addEventListener("change", () => {
        (returnTripNo.checked &&
          (hideElementSmooth(returnDetailsDiv),
          hideElementSmooth(returnCalcResultDiv),
          hideElementSmooth(additionalTripForm),
          hideElementSmooth(additionalTripCalcResultDiv),
          origenVueltaInput && (origenVueltaInput.required = !1),
          destinoVueltaInput && (destinoVueltaInput.required = !1),
          returnDateInput && (returnDateInput.required = !1),
          returnTimeInput && (returnTimeInput.required = !1),
          currentBookingDetails &&
            ((currentBookingDetails.returnTrip = !1),
            (currentBookingDetails.returnPrice = 0)),
          // Guardar el precio del trayecto de ida antes de modificar currentCalculation
          currentCalculation && currentCalculation.totalPriceOneWay > 0 &&
            (currentBookingDetails.oneWayPrice = currentCalculation.totalPriceOneWay),
          additionalTripForm &&
            additionalTripFormOriginalParent &&
            additionalTripFormOriginalParent.insertBefore(
              additionalTripForm,
              additionalTripFormOriginalNextSibling,
            ),
          addAdditionalTripBtn &&
            addAdditionalTripBtnOriginalParent &&
            addAdditionalTripBtnOriginalParent.insertBefore(
              addAdditionalTripBtn,
              addAdditionalTripBtnOriginalNextSibling,
            ),
          // Solo ocultar la sección de trayectos adicionales si no hay trayectos añadidos
          additionalTripsList &&
            additionalTripsList.children.length === 0 &&
            additionalTripsSection &&
            (additionalTripsSection.style.display = "none"),
          // Si hay trayectos adicionales, mantener la sección visible pero ocultar el botón de añadir
          additionalTripsList &&
            additionalTripsList.children.length > 0 &&
            (additionalTripsSection && (additionalTripsSection.style.display = "block"),
            totalPriceSection && showElement(totalPriceSection),
            addAdditionalTripBtnWrapper &&
            (addAdditionalTripBtnWrapper.style.display = "none")),
          showBookingForm()),
          updateTotalPriceAmount());
      })),
    addAdditionalTripBtn &&
      addAdditionalTripBtn.addEventListener("click", function () {
        if (
          (hideElement(additionalTripCalcResultDiv),
          showElement(additionalTripForm),
          additionalTripForm &&
            additionalTripsList &&
            additionalTripsList.children.length > 0 &&
            additionalTripsList.parentElement.insertBefore(
              additionalTripForm,
              additionalTripsList.nextElementSibling,
            ),
          addAdditionalTripBtnWrapper &&
            additionalTripForm &&
            additionalTripForm.parentElement.insertBefore(
              addAdditionalTripBtnWrapper,
              additionalTripForm.nextElementSibling,
            ),
          additionalTripOrigenInput && (additionalTripOrigenInput.value = ""),
          additionalTripDestinoInput && (additionalTripDestinoInput.value = ""),
          additionalTripFechaInput && (additionalTripFechaInput.value = ""),
          additionalTripHoraInput && (additionalTripHoraInput.value = ""),
          additionalTripOrigenInput &&
            !autocompleteInstances.additionalTripOrigen)
        ) {
          const additionalTripOrigenSummary = document.getElementById(
              "additional-trip-origen-summary",
            ),
            CONIL_LAT_LNG = { lat: 36.2746, lng: -6.089 },
            conilBounds = new google.maps.LatLngBounds(
              new google.maps.LatLng(
                CONIL_LAT_LNG.lat - 0.1,
                CONIL_LAT_LNG.lng - 0.1,
              ),
              new google.maps.LatLng(
                CONIL_LAT_LNG.lat + 0.1,
                CONIL_LAT_LNG.lng + 0.1,
              ),
            );
          setupLegacyAutocompleteField(
            additionalTripOrigenInput,
            {
              fields: [
                "formatted_address",
                "name",
                "place_id",
                "address_components",
                "geometry",
              ],
              bounds: conilBounds,
              strictBounds: !1,
            },
            additionalTripOrigenSummary,
            "additionalTripOrigen",
          );
        }
        if (
          additionalTripDestinoInput &&
          !autocompleteInstances.additionalTripDestino
        ) {
          const additionalTripDestinoSummary = document.getElementById(
              "additional-trip-destino-summary",
            ),
            CONIL_LAT_LNG = { lat: 36.2746, lng: -6.089 },
            conilBounds = new google.maps.LatLngBounds(
              new google.maps.LatLng(
                CONIL_LAT_LNG.lat - 0.1,
                CONIL_LAT_LNG.lng - 0.1,
              ),
              new google.maps.LatLng(
                CONIL_LAT_LNG.lat + 0.1,
                CONIL_LAT_LNG.lng + 0.1,
              ),
            );
          setupLegacyAutocompleteField(
            additionalTripDestinoInput,
            {
              fields: [
                "formatted_address",
                "name",
                "place_id",
                "address_components",
                "geometry",
              ],
              bounds: conilBounds,
              strictBounds: !1,
            },
            additionalTripDestinoSummary,
            "additionalTripDestino",
          );
        }
        if (additionalTripFechaInput) {
          const now = new Date(),
            offsetMinutes = now.getTimezoneOffset(),
            today = new Date(now.getTime() - 6e4 * offsetMinutes)
              .toISOString()
              .split("T")[0];
          additionalTripFechaInput.min = today;
        }
        setTimeout(() => {
          try {
            additionalTripForm &&
              "function" == typeof additionalTripForm.scrollIntoView &&
              additionalTripForm.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
          } catch (_) {}
        }, 100);
      }),
    calculateAdditionalTripBtn &&
      calculateAdditionalTripBtn.addEventListener("click", async function () {
        if (
          !(
            additionalTripOrigenInput &&
            additionalTripDestinoInput &&
            additionalTripFechaInput &&
            additionalTripHoraInput
          )
        )
          return;
        const origin = additionalTripOrigenInput.value.trim(),
          destination = additionalTripDestinoInput.value.trim(),
          date = additionalTripFechaInput.value,
          time = additionalTripHoraInput.value;
        origin && destination && date && time
          ? validateCalculator(date, time) &&
            calculatePrice(origin, destination, date, time, "additional")
          : additionalTripCalcResultDiv &&
            (additionalTripCalcResultDiv.innerHTML =
              '<p style="color: #dc3545;">Por favor, complete todos los campos.</p>');
      }),
    attachInvalidateReturnOnChange(origenVueltaInput),
    attachInvalidateReturnOnChange(destinoVueltaInput),
    attachInvalidateReturnOnChange(returnDateInput),
    attachInvalidateReturnOnChange(returnTimeInput),
    calculateReturnPriceBtn &&
      calculateReturnPriceBtn.addEventListener("click", async () => {
        const originValue = origenVueltaInput
            ? origenVueltaInput.value.trim()
            : "",
          destinationValue = destinoVueltaInput
            ? destinoVueltaInput.value.trim()
            : "",
          addressErrors = [];
        if (
          (originValue ||
            (validationMsgs &&
              validationMsgs.errorReturnOriginRequired &&
              addressErrors.push(validationMsgs.errorReturnOriginRequired)),
          destinationValue ||
            (validationMsgs &&
              validationMsgs.errorReturnDestinationRequired &&
              addressErrors.push(
                validationMsgs.errorReturnDestinationRequired,
              )),
          addressErrors.length > 0)
        ) {
          const baseMsg =
              validationMsgs && validationMsgs.reviewFieldsBase
                ? validationMsgs.reviewFieldsBase
                : "",
            detail = addressErrors.map((msg) => "• " + msg).join("\n");
          return (
            alert((baseMsg ? baseMsg + "\n\n" : "") + detail),
            void (originValue
              ? destinationValue ||
                (destinoVueltaInput &&
                  "function" == typeof destinoVueltaInput.focus &&
                  destinoVueltaInput.focus())
              : origenVueltaInput &&
                "function" == typeof origenVueltaInput.focus &&
                origenVueltaInput.focus())
          );
        }
        if (
          ([
            origenVueltaInput,
            destinoVueltaInput,
            returnDateInput,
            returnTimeInput,
          ].forEach((el) => {
            el &&
              "function" == typeof el.setCustomValidity &&
              el.setCustomValidity("");
          }),
          !(
            originValue &&
            destinationValue &&
            returnDateInput.value &&
            returnTimeInput.value
          ))
        ) {
          const firstMissingField =
              !originValue && origenVueltaInput
                ? origenVueltaInput
                : !destinationValue && destinoVueltaInput
                  ? destinoVueltaInput
                  : !returnDateInput.value && returnDateInput
                    ? returnDateInput
                    : !returnTimeInput.value && returnTimeInput
                      ? returnTimeInput
                      : null,
            message =
              alerts && alerts.returnFieldsMissing
                ? alerts.returnFieldsMissing
                : "";
          if (
            firstMissingField &&
            "function" == typeof firstMissingField.setCustomValidity
          ) {
            if (
              (firstMissingField.setCustomValidity(message),
              "function" == typeof firstMissingField.reportValidity
                ? firstMissingField.reportValidity()
                : bookingForm && "function" == typeof bookingForm.reportValidity
                  ? bookingForm.reportValidity()
                  : message && alert(message),
              "function" == typeof firstMissingField.focus)
            )
              try {
                firstMissingField.focus();
              } catch (e) {}
          } else message && alert(message);
          return;
        }
        if (validateCalculator(returnDateInput.value, returnTimeInput.value)) {
          try {
            googleMapsAllowNotLoadedAlert = !0;
          } catch (_) {}
          try {
            tcTrackEvent("click_calcular_vuelta", { trip_type: "vuelta" });
          } catch (_) {}
          try {
            await loadGoogleMapsIfNeeded();
          } catch (_) {
            try {
              alerts &&
                alerts.googleMapsNotLoaded &&
                alert(alerts.googleMapsNotLoaded);
            } catch (_) {}
            return;
          }
          if (googleApiLoaded)
            calculatePrice(
              originValue,
              destinationValue,
              returnDateInput.value,
              returnTimeInput.value,
              "vuelta",
            );
          else {
            console.error(
              "Google Maps API is not marked as loaded after loadGoogleMapsIfNeeded call (return trip).",
            );
            try {
              alerts &&
                alerts.googleMapsNotLoaded &&
                alert(alerts.googleMapsNotLoaded);
            } catch (_) {}
          }
        }
      }),
    returnCalcResultDiv &&
      returnCalcResultDiv.addEventListener("click", (e) => {
        const target = e.target;
        target &&
          target.id &&
          "cancel-return-btn" === target.id &&
          cancelReturnTrip();
      }),
    needsSRIYes &&
      needsSRINo &&
      childSeatQuestionsDiv &&
      babySeatsSelect &&
      babySeatAgeQuestionDiv &&
      (needsSRIYes.addEventListener("change", () => {
        needsSRIYes.checked && showElement(childSeatQuestionsDiv);
      }),
      needsSRINo.addEventListener("change", () => {
        needsSRINo.checked &&
          (hideElementSmooth(childSeatQuestionsDiv),
          hideElementSmooth(babySeatAgeQuestionDiv),
          babySeatsSelect && (babySeatsSelect.value = "0"),
          childSeatsSelect && (childSeatsSelect.value = "0"));
      }),
      babySeatsSelect &&
        babySeatsSelect.addEventListener("change", () => {
          parseInt(babySeatsSelect.value, 10) > 0
            ? showElement(babySeatAgeQuestionDiv)
            : hideElementSmooth(babySeatAgeQuestionDiv);
        })),
    showConfirmationOverlayBtn &&
      showConfirmationOverlayBtn.addEventListener("click", () => {
        try {
          const errors = (function () {
            const errors = [];
            if (!bookingForm) return errors;
            resetBookingFieldErrors();
            const nombreEl = document.getElementById("nombre");
            nombreEl &&
              !nombreEl.value.trim() &&
              (errors.push(validationMsgs.errorNameRequired),
              markFieldAsError(nombreEl),
              setFieldErrorMessage("nombre", validationMsgs.errorNameRequired));
            const emailEl = document.getElementById("email");
            emailEl &&
              (emailEl.value.trim()
                ? emailEl.checkValidity() ||
                  (errors.push(validationMsgs.errorEmailInvalid),
                  markFieldAsError(emailEl),
                  setFieldErrorMessage(
                    "email",
                    validationMsgs.errorEmailInvalid,
                  ))
                : (errors.push(validationMsgs.errorEmailRequired),
                  markFieldAsError(emailEl),
                  setFieldErrorMessage(
                    "email",
                    validationMsgs.errorEmailRequired,
                  )));
            const telEl = document.getElementById("telefono");
            if (telEl) {
              const value = telEl.value.trim(),
                digits = value.replace(/\D/g, "");
              value
                ? digits.length < 4 &&
                  (errors.push(validationMsgs.errorPhoneTooShort),
                  markFieldAsError(telEl),
                  setFieldErrorMessage(
                    "telefono",
                    validationMsgs.errorPhoneTooShort,
                  ))
                : (errors.push(validationMsgs.errorPhoneRequired),
                  markFieldAsError(telEl),
                  setFieldErrorMessage(
                    "telefono",
                    validationMsgs.errorPhoneRequired,
                  ));
            }
            const pasajerosEl = document.getElementById("pasajeros");
            pasajerosEl &&
              !pasajerosEl.value &&
              (errors.push(validationMsgs.errorPassengersRequired),
              markFieldAsError(pasajerosEl),
              setFieldErrorMessage(
                "pasajeros",
                validationMsgs.errorPassengersRequired,
              ));
            const acceptTermsEl = document.getElementById("accept-terms");
            if (
              (acceptTermsEl &&
                !acceptTermsEl.checked &&
                (errors.push(validationMsgs.errorTermsRequired),
                setFieldErrorMessage(
                  "accept-terms",
                  validationMsgs.errorTermsRequired,
                )),
              returnTripYes && returnTripYes.checked)
            ) {
              const origenVueltaEl =
                  document.getElementById("origen-vuelta-calc"),
                destinoVueltaEl = document.getElementById(
                  "destino-vuelta-calc",
                ),
                returnDateEl = document.getElementById("return-date"),
                returnTimeEl = document.getElementById("return-time");
              (origenVueltaEl &&
                !origenVueltaEl.value.trim() &&
                (errors.push(validationMsgs.errorReturnOriginRequired),
                markFieldAsError(origenVueltaEl),
                setFieldErrorMessage(
                  "origen-vuelta-calc",
                  validationMsgs.errorReturnOriginRequired,
                )),
                destinoVueltaEl &&
                  !destinoVueltaEl.value.trim() &&
                  (errors.push(validationMsgs.errorReturnDestinationRequired),
                  markFieldAsError(destinoVueltaEl),
                  setFieldErrorMessage(
                    "destino-vuelta-calc",
                    validationMsgs.errorReturnDestinationRequired,
                  )),
                returnDateEl &&
                  !returnDateEl.value &&
                  (errors.push(validationMsgs.errorReturnDateRequired),
                  markFieldAsError(returnDateEl),
                  setFieldErrorMessage(
                    "return-date",
                    validationMsgs.errorReturnDateRequired,
                  )),
                returnTimeEl &&
                  !returnTimeEl.value &&
                  (errors.push(validationMsgs.errorReturnTimeRequired),
                  markFieldAsError(returnTimeEl),
                  setFieldErrorMessage(
                    "return-time",
                    validationMsgs.errorReturnTimeRequired,
                  )));
            }
            return errors;
          })();
          if (
            returnTripYes &&
            returnTripYes.checked &&
            currentBookingDetails &&
            "number" == typeof currentBookingDetails.returnRawPrice &&
            currentBookingDetails.returnRawPrice > 0 &&
            !currentBookingDetails.returnTrip
          ) {
            let decisionMsg = "";
            if (validationMsgs && validationMsgs.errorReturnDecisionRequired) {
              const confirmBtn = document.getElementById("confirm-return-btn"),
                cancelBtn = document.getElementById("cancel-return-btn"),
                confirmLabel =
                  confirmBtn && confirmBtn.textContent
                    ? confirmBtn.textContent.trim()
                    : "",
                cancelLabel =
                  cancelBtn && cancelBtn.textContent
                    ? cancelBtn.textContent.trim()
                    : "";
              "function" == typeof validationMsgs.errorReturnDecisionRequired
                ? (decisionMsg = validationMsgs.errorReturnDecisionRequired(
                    confirmLabel,
                    cancelLabel,
                  ))
                : "string" ==
                    typeof validationMsgs.errorReturnDecisionRequired &&
                  (decisionMsg = validationMsgs.errorReturnDecisionRequired);
            }
            return void (decisionMsg && alert(decisionMsg));
          }
          if (errors.length > 0) {
            const baseMsg =
                validationMsgs && validationMsgs.reviewFieldsBase
                  ? validationMsgs.reviewFieldsBase
                  : "Revise los siguientes campos:",
              detail = errors.map((msg) => "• " + msg).join("\n");
            return (
              alert(baseMsg + "\n\n" + detail),
              (function () {
                if (!bookingForm) return;
                const ids = ["nombre", "email", "telefono", "pasajeros"];
                returnTripYes &&
                  returnTripYes.checked &&
                  ids.push(
                    "origen-vuelta-calc",
                    "destino-vuelta-calc",
                    "return-date",
                    "return-time",
                  );
                let firstEl = null;
                for (let i = 0; i < ids.length; i++) {
                  const el = document.getElementById(ids[i]);
                  if (
                    el &&
                    el.style &&
                    "var(--error-color)" === el.style.borderColor
                  ) {
                    firstEl = el;
                    break;
                  }
                }
                if (
                  firstEl &&
                  ("function" == typeof firstEl.scrollIntoView &&
                    firstEl.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    }),
                  "function" == typeof firstEl.focus)
                )
                  try {
                    firstEl.focus();
                  } catch (e) {}
              })(),
              void (formErrorMessage && hideElement(formErrorMessage))
            );
          }
          (hideElement(formErrorMessage),
            openDialog(bookingConfirmationOverlay));
          try {
            !(function () {
              const getElValue = (id) =>
                  document.getElementById(id)?.value || "",
                getRadioValue = (name) =>
                  document.querySelector(`input[name="${name}"]:checked`)
                    ?.value || "",
                confirmNombreEl = document.getElementById("confirm-nombre");
              confirmNombreEl &&
                (confirmNombreEl.textContent = getElValue("nombre"));
              const confirmTelefonoEl =
                document.getElementById("confirm-telefono");
              confirmTelefonoEl &&
                (confirmTelefonoEl.textContent = getElValue("telefono"));
              const confirmEmailEl = document.getElementById("confirm-email");
              confirmEmailEl &&
                (confirmEmailEl.textContent = getElValue("email"));
              const confirmPasajerosEl =
                document.getElementById("confirm-pasajeros");
              confirmPasajerosEl &&
                (confirmPasajerosEl.textContent = getElValue("pasajeros"));
              const origenIdaEl = document.getElementById("confirm-origen-ida"),
                destinoIdaEl = document.getElementById("confirm-destino-ida");
              if (currentCalculation) {
                const originLabel = buildShortAddressLabel(
                    currentCalculation.origin || "",
                  ),
                  destinationLabel = buildShortAddressLabel(
                    currentCalculation.destination || "",
                  );
                (origenIdaEl && (origenIdaEl.textContent = originLabel || ""),
                  destinoIdaEl &&
                    (destinoIdaEl.textContent = destinationLabel || ""));
              }
              const idaRouteChipEl = document.getElementById(
                  "confirm-ida-route-chip",
                ),
                idaRouteMapEl = document.getElementById(
                  "confirm-ida-route-map",
                ),
                idaRouteToggleBtn = document.getElementById(
                  "confirm-ida-route-toggle",
                ),
                idaRouteContainerEl = document.getElementById(
                  "confirm-ida-route-container",
                ),
                hasIdaGeometry =
                  Array.isArray(currentRouteOverviewPath) &&
                  currentRouteOverviewPath.length > 0 &&
                  currentRouteStartLocation &&
                  currentRouteEndLocation;
              idaRouteChipEl &&
                currentCalculation &&
                "number" == typeof currentCalculation.distanceKm &&
                currentCalculation.durationText &&
                (idaRouteChipEl.textContent = `${currentCalculation.distanceKm.toFixed(1)} km · ${currentCalculation.durationText}`);
              idaRouteMapEl &&
                currentCalculation &&
                "number" == typeof currentCalculation.distanceKm &&
                currentCalculation.durationText &&
                idaRouteMapEl.setAttribute(
                  "aria-label",
                  `${currentCalculation.distanceKm.toFixed(1)} km, ${currentCalculation.durationText}`,
                );
              idaRouteToggleBtn &&
              calcMsgs &&
              calcMsgs.viewRouteButton &&
              hasIdaGeometry &&
              idaRouteContainerEl &&
              idaRouteMapEl
                ? ((idaRouteToggleBtn.innerHTML = `${calcMsgs.viewRouteButton} <span class="route-toggle-icon">&#9662;</span>`),
                  (idaRouteToggleBtn.style.display = ""),
                  idaRouteContainerEl.classList.remove("visible"),
                  idaRouteContainerEl.setAttribute("aria-hidden", "true"),
                  createConfirmationRouteToggle({
                    toggleButton: idaRouteToggleBtn,
                    container: idaRouteContainerEl,
                    mapElement: idaRouteMapEl,
                    chipElement: idaRouteChipEl,
                    isReturn: !1,
                  }))
                : idaRouteToggleBtn &&
                  idaRouteContainerEl &&
                  (idaRouteContainerEl.classList.remove("visible"),
                  idaRouteContainerEl.setAttribute("aria-hidden", "true"));
              const datetimeIdaEl = document.getElementById(
                "confirm-datetime-ida",
              );
              datetimeIdaEl &&
                (datetimeIdaEl.textContent = `${fechaBookInput?.value || confirmMsgs.notAvailable}${confirmMsgs.atTimeConnector}${horaBookInput?.value || confirmMsgs.notAvailable}`);
              const precioIdaSpan =
                document.getElementById("confirm-precio-ida");
              precioIdaSpan &&
                (precioIdaSpan.textContent = formatPrice(
                  currentCalculation.totalPriceOneWay || 0,
                ));
              const returnDateEl = document.getElementById("return-date"),
                returnTimeEl = document.getElementById("return-time");
              let formattedReturnDate = confirmMsgs.notAvailable;
              if (returnDateEl && returnDateEl.value) {
                const parts = returnDateEl.value.split("-");
                if (3 === parts.length) {
                  const [yyyy, mm, dd] = parts;
                  formattedReturnDate = `${dd}/${mm}/${yyyy}`;
                } else formattedReturnDate = returnDateEl.value;
              }
              const formattedReturnTime =
                  returnTimeEl && returnTimeEl.value
                    ? returnTimeEl.value
                    : confirmMsgs.notAvailable,
                vueltaSection = document.getElementById(
                  "confirm-vuelta-section",
                );
              if (
                returnTripYes?.checked &&
                currentBookingDetails?.returnPrice > 0
              ) {
                const origenVueltaEl = document.getElementById(
                    "confirm-origen-vuelta",
                  ),
                  destinoVueltaEl = document.getElementById(
                    "confirm-destino-vuelta",
                  ),
                  origenVueltaManual = getElValue("origen-vuelta-calc"),
                  destinoVueltaManual = getElValue("destino-vuelta-calc"),
                  origenVuelta =
                    currentBookingDetails.returnOrigin ||
                    origenVueltaManual ||
                    "",
                  destinoVuelta =
                    currentBookingDetails.returnDestination ||
                    destinoVueltaManual ||
                    "",
                  originReturnPlace =
                    void 0 !== autocompleteSelectedPlaces &&
                    autocompleteSelectedPlaces.origenVuelta
                      ? autocompleteSelectedPlaces.origenVuelta
                      : null,
                  destinationReturnPlace =
                    void 0 !== autocompleteSelectedPlaces &&
                    autocompleteSelectedPlaces.destinoVuelta
                      ? autocompleteSelectedPlaces.destinoVuelta
                      : null,
                  originReturnLabel = buildMapLabelFromPlaceOrAddress(
                    originReturnPlace,
                    origenVuelta,
                  ),
                  destinationReturnLabel = buildMapLabelFromPlaceOrAddress(
                    destinationReturnPlace,
                    destinoVuelta,
                  );
                (origenVueltaEl &&
                  (origenVueltaEl.textContent =
                    originReturnLabel ||
                    buildShortAddressLabel(origenVuelta) ||
                    ""),
                  destinoVueltaEl &&
                    (destinoVueltaEl.textContent =
                      destinationReturnLabel ||
                      buildShortAddressLabel(destinoVuelta) ||
                      ""));
                const datetimeVueltaEl = document.getElementById(
                  "confirm-datetime-vuelta",
                );
                datetimeVueltaEl &&
                  (datetimeVueltaEl.textContent = `${formattedReturnDate}${confirmMsgs.atTimeConnector}${formattedReturnTime}`);
                const precioVueltaSpan = document.getElementById(
                  "confirm-precio-vuelta",
                );
                precioVueltaSpan &&
                  (precioVueltaSpan.textContent = formatPrice(
                    currentBookingDetails.returnPrice || 0,
                  ));
                const vueltaRouteChipEl = document.getElementById(
                    "confirm-vuelta-route-chip",
                  ),
                  vueltaRouteMapEl = document.getElementById(
                    "confirm-vuelta-route-map",
                  ),
                  vueltaRouteToggleBtn = document.getElementById(
                    "confirm-vuelta-route-toggle",
                  ),
                  vueltaRouteContainerEl = document.getElementById(
                    "confirm-vuelta-route-container",
                  ),
                  hasVueltaGeometry =
                    Array.isArray(currentReturnRouteOverviewPath) &&
                    currentReturnRouteOverviewPath.length > 0 &&
                    currentReturnRouteStartLocation &&
                    currentReturnRouteEndLocation;
                if (
                  (vueltaRouteChipEl &&
                    "number" == typeof currentBookingDetails.returnDistanceKm &&
                    currentBookingDetails.returnDurationText &&
                    (vueltaRouteChipEl.textContent = `${currentBookingDetails.returnDistanceKm.toFixed(1)} km · ${currentBookingDetails.returnDurationText}`),
                  vueltaRouteMapEl &&
                    "number" == typeof currentBookingDetails.returnDistanceKm &&
                    currentBookingDetails.returnDurationText &&
                    vueltaRouteMapEl.setAttribute(
                      "aria-label",
                      `${currentBookingDetails.returnDistanceKm.toFixed(1)} km, ${currentBookingDetails.returnDurationText}`,
                    ),
                  vueltaRouteToggleBtn &&
                    calcMsgs &&
                    vueltaSection &&
                    hasVueltaGeometry &&
                    vueltaRouteContainerEl &&
                    vueltaRouteMapEl)
                ) {
                  const label =
                    calcMsgs.viewReturnRouteButton || calcMsgs.viewRouteButton;
                  (label &&
                    (vueltaRouteToggleBtn.innerHTML = `${label} <span class="route-toggle-icon">&#9662;</span>`),
                    (vueltaRouteToggleBtn.style.display = ""),
                    vueltaRouteContainerEl.classList.remove("visible"),
                    vueltaRouteContainerEl.setAttribute("aria-hidden", "true"),
                    createConfirmationRouteToggle({
                      toggleButton: vueltaRouteToggleBtn,
                      container: vueltaRouteContainerEl,
                      mapElement: vueltaRouteMapEl,
                      chipElement: vueltaRouteChipEl,
                      isReturn: !0,
                    }));
                } else
                  vueltaRouteToggleBtn &&
                    vueltaRouteContainerEl &&
                    (vueltaRouteContainerEl.classList.remove("visible"),
                    vueltaRouteContainerEl.setAttribute("aria-hidden", "true"));
                vueltaSection && (vueltaSection.style.display = "block");
              }
              const additionalTripsSection = document.getElementById(
                "confirm-additional-trips-section",
              );
              additionalTripsSection &&
                ((additionalTripsSection.innerHTML = ""),
                Array.isArray(window.additionalTrips) && window.additionalTrips.length > 0
                  ? ((additionalTripsSection.style.display = "block"),
                    window.additionalTrips.forEach((trip, index) => {
                      const tripNumber = index + 1,
                        tripSection = document.createElement("div");
                      ((tripSection.className = "additional-trip-confirmation"),
                        (tripSection.style.marginTop = "1.5rem"),
                        (tripSection.style.paddingTop = "1.5rem"),
                        (tripSection.style.borderTop = "1px solid #dee2e6"));
                      const originLabel = buildShortAddressLabel(
                          trip.origin || "",
                        ),
                        destinationLabel = buildShortAddressLabel(
                          trip.destination || "",
                        );
                      let formattedAdditionalDate =
                        trip.date || confirmMsgs.notAvailable;
                      if (trip.date && trip.date.includes("-")) {
                        const parts = trip.date.split("-");
                        if (3 === parts.length) {
                          const [yyyy, mm, dd] = parts;
                          formattedAdditionalDate = `${dd}/${mm}/${yyyy}`;
                        }
                      }
                      const formattedAdditionalTime =
                          trip.time || confirmMsgs.notAvailable,
                        tripId = trip.id || `additional-trip-${index}`,
                        routeChipId = `confirm-additional-${tripId}-route-chip`,
                        routeMapId = `confirm-additional-${tripId}-route-map`,
                        routeToggleBtnId = `confirm-additional-${tripId}-route-toggle`,
                        routeContainerId = `confirm-additional-${tripId}-route-container`;
                      ((tripSection.innerHTML = `\n            <h3 class="confirmation-section-title">Trayecto adicional ${tripNumber}</h3>\n            <div class="confirmation-field-row"><strong>Origen:</strong> <span id="confirm-additional-${tripId}-origen">${originLabel}</span></div>\n            <div class="confirmation-field-row"><strong>Destino:</strong> <span id="confirm-additional-${tripId}-destino">${destinationLabel}</span></div>\n            <div class="confirmation-field-row"><strong>Fecha y hora:</strong> <span id="confirm-additional-${tripId}-datetime">${formattedAdditionalDate}${confirmMsgs.atTimeConnector}${formattedAdditionalTime}</span></div>\n            <div class="confirmation-field-row"><strong>Precio:</strong> <span id="confirm-additional-${tripId}-precio">${formatPrice(trip.price || 0)}</span></div>\n\n            <div class="confirmation-route-wrapper">\n              <div\n                id="${routeContainerId}"\n                class="route-map-container confirmation-route-map-container visible">\n                <div class="route-map-info">\n                  <div class="route-map-chip">\n                    <span class="route-map-chip-main" id="${routeChipId}"></span>\n                  </div>\n                </div>\n                <div\n                  id="${routeMapId}"\n                  class="route-map"\n                  role="img"\n                  aria-label="Mapa del trayecto adicional ${tripNumber}"></div>\n              </div>\n            </div>\n          `),
                        additionalTripsSection.appendChild(tripSection));
                      const routeChipEl = document.getElementById(routeChipId),
                        routeMapEl = document.getElementById(routeMapId),
                        routeToggleBtnEl =
                          document.getElementById(routeToggleBtnId),
                        routeContainerEl =
                          document.getElementById(routeContainerId);
                      (routeChipEl &&
                        "number" == typeof trip.distance &&
                        trip.duration &&
                        (routeChipEl.textContent = `${trip.distance.toFixed(1)} km · ${trip.duration}`),
                        routeMapEl &&
                          "number" == typeof trip.distance &&
                          trip.duration &&
                          routeMapEl.setAttribute(
                            "aria-label",
                            `${trip.distance.toFixed(1)} km, ${trip.duration}`,
                          ));
                      const hasGeometry =
                        Array.isArray(trip.overview_path) &&
                        trip.overview_path.length > 0 &&
                        trip.start_location &&
                        trip.end_location;
                      routeToggleBtnEl &&
                      calcMsgs &&
                      hasGeometry &&
                      routeContainerEl &&
                      routeMapEl
                        ? ((routeToggleBtnEl.innerHTML = `${calcMsgs.viewRouteButton || "Ver ruta"} <span class="route-toggle-icon">&#9662;</span>`),
                          (routeToggleBtnEl.style.display = ""),
                          routeContainerEl.classList.remove("visible"),
                          routeContainerEl.setAttribute("aria-hidden", "true"),
                          createConfirmationRouteToggle({
                            toggleButton: routeToggleBtnEl,
                            container: routeContainerEl,
                            mapElement: routeMapEl,
                            chipElement: routeChipEl,
                            isReturn: !1,
                            isAdditional: !0,
                            additionalTripIndex: index,
                          }))
                        : routeToggleBtnEl &&
                          routeContainerEl &&
                          ((routeToggleBtnEl.style.display = "none"),
                          routeContainerEl.classList.remove("visible"),
                          routeContainerEl.setAttribute("aria-hidden", "true"));
                    }))
                  : (additionalTripsSection.style.display = "none"));
              const equipajeEl = document.getElementById("confirm-equipaje");
              equipajeEl &&
                (equipajeEl.textContent = `${confirmMsgs.luggageCabinLabel}: ${getElValue("maletas-cabina")}, ${confirmMsgs.luggageLargeLabel}: ${getElValue("maletas-grandes")}`);
              const mascotaEl = document.getElementById("confirm-mascota");
              mascotaEl &&
                (mascotaEl.textContent =
                  "yes" === getRadioValue("mascota")
                    ? confirmMsgs.yes
                    : confirmMsgs.no);
              let sriTxt = confirmMsgs.no;
              needsSRIYes?.checked &&
                ((sriTxt = confirmMsgs.sriYes(
                  getElValue("baby-seats"),
                  getElValue("child-seats"),
                )),
                parseInt(getElValue("baby-seats"), 10) > 0 &&
                  (sriTxt += `${confirmMsgs.sriAgeWeightPrefix}${getElValue("baby-age") || confirmMsgs.notAvailable}`));
              const confirmSriEl = document.getElementById("confirm-sri");
              confirmSriEl && (confirmSriEl.textContent = sriTxt);
              const comentariosEl = document.getElementById(
                "confirm-comentarios",
              );
              comentariosEl &&
                (comentariosEl.textContent =
                  getElValue("comentarios") || confirmMsgs.none);
              const confirmTotalEl = document.getElementById("confirm-total");
              confirmTotalEl &&
                (confirmTotalEl.textContent = formatPrice(
                  currentBookingDetails.finalTotalPrice,
                ));
            })();
          } catch (e) {
            console.error("populateConfirmationOverlay failed:", e);
          }
          try {
            setTimeout(() => {
              try {
                initConfirmationMap(!1);
              } catch (_) {}
              try {
                initConfirmationMap(!0);
              } catch (_) {}
              Array.isArray(window.additionalTrips) &&
                window.additionalTrips.length > 0 &&
                window.additionalTrips.forEach((_, index) => {
                  try {
                    !(function (additionalTripIndex) {
                      if (
                        !Array.isArray(window.additionalTrips) ||
                        !window.additionalTrips[additionalTripIndex]
                      )
                        return;
                      const trip = window.additionalTrips[additionalTripIndex],
                        tripId =
                          trip.id || `additional-trip-${additionalTripIndex}`,
                        mapElement = document.getElementById(
                          `confirm-additional-${tripId}-route-map`,
                        ),
                        container = document.getElementById(
                          `confirm-additional-${tripId}-route-container`,
                        ),
                        chipElement = document.getElementById(
                          `confirm-additional-${tripId}-route-chip`,
                        );
                      if (!mapElement || !container) return;
                      const stateKey = `confirmMapStateAdditional_${additionalTripIndex}`,
                        animationKey = `confirmMapAnimAdditional_${additionalTripIndex}`;
                      try {
                        if (
                          container.dataset &&
                          "ready" === container.dataset[stateKey]
                        )
                          return;
                      } catch (_) {}
                      let fullPath = trip.overview_path || [];
                      fullPath = fullPath
                        .map((p) => {
                          if (!p) return null;
                          const lat =
                              "function" == typeof p.lat ? p.lat() : p.lat,
                            lng = "function" == typeof p.lng ? p.lng() : p.lng;
                          return new google.maps.LatLng(lat, lng);
                        })
                        .filter((p) => null !== p);
                      const startLocation = trip.start_location,
                        endLocation = trip.end_location;
                      if (!fullPath.length || !startLocation || !endLocation)
                        return;
                      const distanceKm = trip.distance || 0,
                        durationText = trip.duration || "";
                      (chipElement &&
                        distanceKm > 0 &&
                        durationText &&
                        (chipElement.textContent = `${distanceKm.toFixed(1)} km · ${durationText}`),
                        (async () => {
                          try {
                            await loadGoogleMapsIfNeeded();
                          } catch (_) {
                            return null;
                          }
                          if (!googleApiLoaded || void 0 === google.maps.Map)
                            return null;
                          const bounds = new google.maps.LatLngBounds();
                          fullPath.forEach((p) => bounds.extend(p));
                          let padding = 40;
                          distanceKm > 0 && distanceKm <= 5
                            ? (padding = 55)
                            : distanceKm > 5 && distanceKm <= 40
                              ? (padding = 30)
                              : distanceKm > 40 && (padding = 15);
                          let mapInstance = null;
                          try {
                            mapInstance = new google.maps.Map(mapElement, {
                              center: startLocation,
                              zoom: 11,
                              disableDefaultUI: !0,
                              clickableIcons: !1,
                              keyboardShortcuts: !1,
                              gestureHandling: "greedy",
                              mapId: "150019df79666595709f2472",
                            });
                          } catch (e) {
                            return (
                              console.error(
                                "Additional confirmation map init failed",
                                e,
                              ),
                              null
                            );
                          }
                          try {
                            ((mapElement.style.height = "350px"),
                              (mapElement.style.opacity = "1"));
                          } catch (_) {}
                          new google.maps.Polyline({
                            path: fullPath || [],
                            geodesic: !0,
                            strokeColor: "#d4af37",
                            strokeOpacity: 0.2,
                            strokeWeight: 4,
                            strokeLinecap: "round",
                            strokeLinejoin: "round",
                            zIndex: 5,
                            map: mapInstance,
                          });
                          try {
                            const hasAdvancedMarker = !(
                                !google.maps.marker ||
                                !google.maps.marker.AdvancedMarkerElement
                              ),
                              createEmojiMarker = (pos, emoji) => {
                                if (!pos) return null;
                                if (hasAdvancedMarker) {
                                  const el = document.createElement("div");
                                  return (
                                    (el.textContent = emoji),
                                    (el.style.fontSize = "30px"),
                                    (el.style.lineHeight = "1"),
                                    (el.style.transform = "translate3d(0,0,0)"),
                                    new google.maps.marker.AdvancedMarkerElement(
                                      {
                                        map: mapInstance,
                                        position: pos,
                                        content: el,
                                      },
                                    )
                                  );
                                }
                                return new google.maps.Marker({
                                  position: pos,
                                  map: mapInstance,
                                  icon: {
                                    path: google.maps.SymbolPath.CIRCLE,
                                    scale: 0,
                                  },
                                  label: {
                                    text: emoji,
                                    fontSize: "24px",
                                    fontWeight: "bold",
                                  },
                                });
                              },
                              originLabelClass =
                                (createEmojiMarker(startLocation, "🚕"),
                                createEmojiMarker(endLocation, "🏁"),
                                "route-map-label--origin"),
                              destLabelClass = "route-map-label--destination";
                            if (
                              hasAdvancedMarker &&
                              google.maps.marker &&
                              google.maps.marker.AdvancedMarkerElement
                            ) {
                              const createLabelMarker = (
                                  pos,
                                  text,
                                  labelClass,
                                ) => {
                                  if (!pos) return null;
                                  const el = document.createElement("div");
                                  return (
                                    (el.className = `route-map-label ${labelClass}`),
                                    (el.textContent = text),
                                    (el.style.padding = "6px 10px"),
                                    (el.style.borderRadius = "6px"),
                                    (el.style.fontSize = "13px"),
                                    (el.style.fontWeight = "600"),
                                    (el.style.whiteSpace = "nowrap"),
                                    (el.style.boxShadow =
                                      "0 2px 8px rgba(0,0,0,0.2)"),
                                    new google.maps.marker.AdvancedMarkerElement(
                                      {
                                        map: mapInstance,
                                        position: pos,
                                        content: el,
                                        zIndex: 10,
                                      },
                                    )
                                  );
                                },
                                originLabelText = trip.origin || "Origen",
                                destLabelText = trip.destination || "Destino";
                              (createLabelMarker(
                                startLocation,
                                originLabelText,
                                originLabelClass,
                              ),
                                createLabelMarker(
                                  endLocation,
                                  destLabelText,
                                  destLabelClass,
                                ));
                            }
                          } catch (_) {}
                          mapInstance.fitBounds(bounds, padding);
                          try {
                            container.dataset &&
                              (container.dataset[stateKey] = "ready");
                          } catch (_) {}
                          return mapInstance;
                        })().then((ctx) => {
                          if (!ctx) return;
                          const animObserver = new IntersectionObserver(
                            (entries) => {
                              entries.forEach((entry) => {
                                if (entry.isIntersecting)
                                  if (
                                    container.dataset &&
                                    "played" === container.dataset[animationKey]
                                  )
                                    animObserver.disconnect();
                                  else
                                    try {
                                      const animPolyline =
                                          new google.maps.Polyline({
                                            path: [],
                                            geodesic: !0,
                                            strokeColor: "#d4af37",
                                            strokeOpacity: 1,
                                            strokeWeight: 5,
                                            strokeLinecap: "round",
                                            strokeLinejoin: "round",
                                            zIndex: 6,
                                            map: ctx,
                                          }),
                                        pathForAnimation = fullPath.slice(),
                                        totalPoints = pathForAnimation.length,
                                        step = Math.max(
                                          1,
                                          Math.floor(totalPoints / 60),
                                        );
                                      let index = 0;
                                      const frameCountForAnimation = Math.max(
                                        1,
                                        Math.ceil(totalPoints / step),
                                      );
                                      let targetDurationMs = 0;
                                      distanceKm > 0 && distanceKm <= 1
                                        ? (targetDurationMs = 1500)
                                        : distanceKm > 1 && distanceKm <= 5
                                          ? (targetDurationMs = 2e3)
                                          : distanceKm > 5 && distanceKm <= 40
                                            ? (targetDurationMs = 3200)
                                            : distanceKm > 40 &&
                                              (targetDurationMs = 3800);
                                      const perFrameDelayMs =
                                          targetDurationMs > 0
                                            ? Math.min(
                                                180,
                                                Math.max(
                                                  0,
                                                  Math.round(
                                                    targetDurationMs /
                                                      frameCountForAnimation -
                                                      16,
                                                  ),
                                                ),
                                              )
                                            : 0,
                                        scheduleFrame = (callback) =>
                                          requestAnimationFrame(callback),
                                        drawNext = () => {
                                          const nextIndex = Math.min(
                                            totalPoints,
                                            index + step,
                                          );
                                          for (
                                            let i = index;
                                            i < nextIndex;
                                            i++
                                          )
                                            animPolyline
                                              .getPath()
                                              .push(pathForAnimation[i]);
                                          ((index = nextIndex),
                                            index < totalPoints &&
                                              (perFrameDelayMs > 0
                                                ? setTimeout(
                                                    () =>
                                                      scheduleFrame(drawNext),
                                                    perFrameDelayMs,
                                                  )
                                                : scheduleFrame(drawNext)));
                                        };
                                      (setTimeout(drawNext, 320),
                                        container.dataset &&
                                          (container.dataset[animationKey] =
                                            "played"));
                                    } catch (_) {}
                              });
                            },
                            {
                              root: document.querySelector(
                                ".confirmation-grid",
                              ),
                              threshold: [0.25, 0.5, 0.75, 0.9, 0.98, 1],
                            },
                          );
                          animObserver.observe(container);
                        }));
                    })(index);
                  } catch (_) {}
                });
            }, 120);
          } catch (_) {}
        } catch (e) {
          console.error("Error opening confirmation overlay:", e);
          try {
            alert(
              "Error al abrir la confirmación. Por favor, recargue la página e inténtelo de nuevo.",
            );
          } catch (_) {}
        }
      }),
    cancelConfirmationBtn &&
      cancelConfirmationBtn.addEventListener("click", () => {
        if (
          (closeDialog(bookingConfirmationOverlay),
          bookingSectionTitle &&
            "function" == typeof bookingSectionTitle.scrollIntoView &&
            bookingSectionTitle.scrollIntoView({
              behavior: "smooth",
              block: "start",
            }),
          bookingSectionTitle && "function" == typeof bookingSectionTitle.focus)
        )
          try {
            bookingSectionTitle.focus({ preventScroll: !0 });
          } catch (_) {}
      }),
    backToHomeBtn &&
      backToHomeBtn.addEventListener("click", () => {
        window.location.href = window.location.pathname;
      }),
    finalBookBtn &&
      finalBookBtn.addEventListener("click", (e) => {
        try {
          e && "function" == typeof e.preventDefault && e.preventDefault();
        } catch (_) {}
        if (bookingForm) {
          try {
            if ("function" == typeof bookingForm.requestSubmit)
              return void bookingForm.requestSubmit();
          } catch (_) {}
          try {
            const ev = new Event("submit", { bubbles: !0, cancelable: !0 });
            bookingForm.dispatchEvent(ev);
          } catch (_) {
            try {
              bookingForm.submit();
            } catch (_) {}
          }
        } else
          console.error("Booking form not found when clicking final-book-btn");
      }),
    bookingForm)
  ) {
    try {
      if ("undefined" != typeof window) {
        if (window.__tc_booking_form_submit_bound) return;
        window.__tc_booking_form_submit_bound = !0;
      }
    } catch (_) {}
    bookingForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      try {
        if ("undefined" != typeof window) {
          if (window.__tc_booking_submit_inflight) return;
          window.__tc_booking_submit_inflight = !0;
        }
      } catch (_) {}
      if ("function" != typeof window.fillHiddenFields)
        return void console.error(
          "Error: fillHiddenFields function is not defined",
        );
      
      // Validación de campos críticos antes de llamar fillHiddenFields
      const origenBook = document.getElementById("origen-book")?.value || "";
      const destinoBook = document.getElementById("destino-book")?.value || "";
      const fechaBook = document.getElementById("fecha-book")?.value || "";
      const horaBook = document.getElementById("hora-book")?.value || "";
      
      if (!origenBook.trim() || !destinoBook.trim()) {
        console.error("Error: Origen o destino están vacíos.");
        alert("Error: Por favor, indique el origen y destino del trayecto.");
        try {
          "undefined" != typeof window && (window.__tc_booking_submit_inflight = !1);
        } catch (_) {}
        return;
      }
      
      if (!fechaBook.trim() || !horaBook.trim()) {
        console.error("Error: Fecha o hora están vacíos.");
        alert("Error: Por favor, indique la fecha y hora del trayecto.");
        try {
          "undefined" != typeof window && (window.__tc_booking_submit_inflight = !1);
        } catch (_) {}
        return;
      }
      
      try {
        window.fillHiddenFields();
      } catch (fillError) {
        console.error("Error al llenar campos hidden:", fillError);
        try {
          "undefined" != typeof window && (window.__tc_booking_submit_inflight = !1);
        } catch (_) {}
        return;
      }
      
      // Validación crítica después de fillHiddenFields
      const trayectoIda = document.getElementById("hidden-trayecto")?.value || "";
      const precioTotal = document.getElementById("hidden-precio-total")?.value || "";
      
      
      if (!trayectoIda.trim()) {
        alert("Error: No se pudo obtener el trayecto. Por favor, recargue la página e intente nuevamente.");
        try {
          "undefined" != typeof window && (window.__tc_booking_submit_inflight = !1);
        } catch (_) {}
        return;
      }
      
      if (!precioTotal.trim()) {
        alert("Error: No se pudo obtener el precio. Por favor, recargue la página e intente nuevamente.");
        try {
          "undefined" != typeof window && (window.__tc_booking_submit_inflight = !1);
        } catch (_) {}
        return;
      }
      
      const finalBookBtnLocal = document.getElementById("final-book-btn");
      finalBookBtnLocal &&
        ((finalBookBtnLocal.disabled = !0),
        (finalBookBtnLocal.innerHTML = bookingMsgs.sending));
      try {
        const makeOk = await tcSendBookingToMake();
        let fallbackOk = !1;
        if (!makeOk) {
          fallbackOk = !!(await sendBookingViaEmailJS(e));
        }
        if (makeOk || fallbackOk) {
          (bookingConfirmationOverlay &&
            closeDialog(bookingConfirmationOverlay),
            bookingSectionTitle &&
              (bookingSectionTitle.textContent = bookingMsgs.bookingSentTitle),
            bookingSuccessMessage && openDialog(bookingSuccessMessage));
          try {
            tcTrackEvent("reserva_enviada", {
              total_price_eur:
                currentBookingDetails &&
                "number" == typeof currentBookingDetails.finalTotalPrice
                  ? currentBookingDetails.finalTotalPrice
                  : currentCalculation &&
                      "number" == typeof currentCalculation.totalPriceOneWay
                    ? currentCalculation.totalPriceOneWay
                    : null,
              has_return:
                !!currentBookingDetails && !!currentBookingDetails.returnTrip,
              channel: makeOk ? "make" : "emailjs_fallback",
            });
          } catch (_) {}
        }
      } catch (error) {
        (console.error("Error submitting the booking form:", error),
          formErrorMessage &&
            ((formErrorMessage.textContent = bookingMsgs.formError),
            (formErrorMessage.style.display = "block"),
            formErrorMessage.scrollIntoView({ behavior: "smooth" })));
      } finally {
        finalBookBtnLocal &&
          ((finalBookBtnLocal.disabled = !1),
          (finalBookBtnLocal.innerHTML = bookingMsgs.confirmButton));
        try {
          "undefined" != typeof window &&
            (window.__tc_booking_submit_inflight = !1);
        } catch (_) {}
      }
    });
  }
  window.fillHiddenFields = function () {
    const setHiddenValue = (id, value) => {
        const el = document.getElementById(id);
        el && (el.value = value || "");
      },
      confirmMsgs = getMessagesSection("confirmation") || {},
      atTimeConnector =
        "string" == typeof confirmMsgs.atTimeConnector
          ? confirmMsgs.atTimeConnector
          : " a las ",
      returnTripSelected =
        !!document.getElementById("return-trip-yes")?.checked;
    
    // currentCalculation siempre está definido como objeto, pero puede tener valores vacíos
    // No hacemos return temprano, permitimos que los fallbacks llenen los campos desde el formulario
    
    // Logging para depuración
    
    // Fallback robusto: intentar leer de múltiples fuentes
    const origenBookValue = document.getElementById("origen-book")?.value || "";
    const destinoBookValue = document.getElementById("destino-book")?.value || "";
    const origenCalcValue = document.getElementById("origen-calc")?.value || "";
    const destinoCalcValue = document.getElementById("destino-calc")?.value || "";
    
    
    const rawOriginIda =
        origenBookValue ||
        origenCalcValue ||
        (currentCalculation ? currentCalculation.origin : "") ||
        "",
      rawDestinationIda =
        destinoBookValue ||
        destinoCalcValue ||
        (currentCalculation ? currentCalculation.destination : "") ||
        "",
      originPlaceIda =
        void 0 !== autocompleteSelectedPlaces &&
        autocompleteSelectedPlaces.origenCalc
          ? autocompleteSelectedPlaces.origenCalc
          : null,
      destinationPlaceIda =
        void 0 !== autocompleteSelectedPlaces &&
        autocompleteSelectedPlaces.destinoCalc
          ? autocompleteSelectedPlaces.destinoCalc
          : null;
    
    
    // Fallback: si normalizeLocationForEmailWithPlace devuelve vacío, usar el valor raw
    const originNormalized = normalizeLocationForEmailWithPlace(rawOriginIda, originPlaceIda) || rawOriginIda;
    const destinationNormalized = normalizeLocationForEmailWithPlace(rawDestinationIda, destinationPlaceIda) || rawDestinationIda;
    
    const trayectoValue = `${originNormalized} -> ${destinationNormalized}`;
    
    (setHiddenValue(
      "hidden-trayecto",
      trayectoValue,
    ),
      setHiddenValue(
        "hidden-distancia-ida",
        currentCalculation && currentCalculation.distanceKm
          ? `${currentCalculation.distanceKm.toFixed(1)} km`
          : "",
      ),
      setHiddenValue(
        "hidden-duracion-ida",
        currentCalculation && currentCalculation.durationText
          ? currentCalculation.durationText
          : "",
      ));
    
    const fallbackIdaPrice =
        currentBookingDetails &&
        "number" == typeof currentBookingDetails.finalTotalPrice &&
        currentBookingDetails.finalTotalPrice > 0
          ? currentBookingDetails.finalTotalPrice
          : 0,
      idaPriceToSend =
        currentCalculation && currentCalculation.totalPriceOneWay
          ? currentCalculation.totalPriceOneWay
          : fallbackIdaPrice;
    setHiddenValue(
      "hidden-precio-ida",
      idaPriceToSend ? formatPrice(idaPriceToSend) : "",
    );
    
    // Fallback robusto para fecha y hora
    const fechaBookValue = document.getElementById("fecha-book")?.value || "";
    const horaBookValue = document.getElementById("hora-book")?.value || "";
    const fechaCalcValue = document.getElementById("fecha-calc")?.value || "";
    const horaCalcValue = document.getElementById("hora-calc")?.value || "";
    
    
    const fechaIda = fechaBookValue || fechaCalcValue || "";
    const horaIda = horaBookValue || horaCalcValue || "";
    
    setHiddenValue(
      "hidden-detalles-ida",
      fechaIda && horaIda ? `${fechaIda}${atTimeConnector}${horaIda}` : "",
    );
    let vueltaTxt = "",
      vueltaPrecio = "",
      vueltaTrayecto = "",
      fechaHoraVueltaTxt = "",
      distanciaVueltaTxt = "",
      duracionVueltaTxt = "";
    if (
      (currentBookingDetails && currentBookingDetails.returnTrip) ||
      returnTripSelected
    ) {
      const cbd = currentBookingDetails || {},
        fechaVueltaRaw = document.getElementById("return-date")?.value || "",
        horaVuelta = document.getElementById("return-time")?.value || "";
      let fechaVuelta = fechaVueltaRaw;
      if (fechaVueltaRaw) {
        const dateParts = fechaVueltaRaw.split("-");
        if (3 === dateParts.length) {
          const [yyyy, mm, dd] = dateParts;
          fechaVuelta = `${dd}/${mm}/${yyyy}`;
        }
      }
      ((fechaHoraVueltaTxt =
        fechaVuelta && horaVuelta
          ? `${fechaVuelta}${atTimeConnector}${horaVuelta}`
          : ""),
        (vueltaTxt = fechaHoraVueltaTxt),
        (vueltaPrecio =
          cbd.returnPrice && cbd.returnPrice > 0
            ? formatPrice(cbd.returnPrice)
            : ""));
      const origenVueltaManual =
          document.getElementById("origen-vuelta-calc")?.value || "",
        destinoVueltaManual =
          document.getElementById("destino-vuelta-calc")?.value || "",
        origenVuelta = cbd.returnOrigin || origenVueltaManual || "",
        destinoVuelta = cbd.returnDestination || destinoVueltaManual || "",
        originPlaceVuelta =
          void 0 !== autocompleteSelectedPlaces &&
          autocompleteSelectedPlaces.origenVuelta
            ? autocompleteSelectedPlaces.origenVuelta
            : null,
        destinationPlaceVuelta =
          void 0 !== autocompleteSelectedPlaces &&
          autocompleteSelectedPlaces.destinoVuelta
            ? autocompleteSelectedPlaces.destinoVuelta
            : null;
      
      // Fallback: si normalizeLocationForEmailWithPlace devuelve vacío, usar el valor raw
      const originVueltaNormalized = normalizeLocationForEmailWithPlace(origenVuelta, originPlaceVuelta) || origenVuelta;
      const destinationVueltaNormalized = normalizeLocationForEmailWithPlace(destinoVuelta, destinationPlaceVuelta) || destinoVuelta;
      
      ((vueltaTrayecto = `${originVueltaNormalized} -> ${destinationVueltaNormalized}`),
        cbd.returnDistanceKm &&
          cbd.returnDistanceKm > 0 &&
          (distanciaVueltaTxt = `${cbd.returnDistanceKm.toFixed(1)} km`),
        cbd.returnDurationText && (duracionVueltaTxt = cbd.returnDurationText));
    }
    (setHiddenValue("hidden-distancia-vuelta", distanciaVueltaTxt),
      setHiddenValue("hidden-duracion-vuelta", duracionVueltaTxt),
      setHiddenValue("hidden-detalles-vuelta", vueltaTxt),
      setHiddenValue("hidden-precio-vuelta", vueltaPrecio),
      setHiddenValue("hidden-trayecto-vuelta", vueltaTrayecto),
      setHiddenValue("hidden-fecha-hora-vuelta", fechaHoraVueltaTxt),
      setHiddenValue(
        "hidden-precio-total",
        formatPrice(
          currentBookingDetails?.finalTotalPrice ||
            currentCalculation?.totalPriceOneWay ||
            0,
        ),
      ));
    
    // Validación final: asegurar que al menos los campos críticos tienen valores
    const finalTrayecto = document.getElementById("hidden-trayecto")?.value || "";
    const finalPrecioTotal = document.getElementById("hidden-precio-total")?.value || "";
    
    
    // Si el trayecto está vacío después de todos los intentos, usar emergency fallback
    if (!finalTrayecto.trim()) {
      const lastResortOrigen = document.getElementById("origen-calc")?.value || "";
      const lastResortDestino = document.getElementById("destino-calc")?.value || "";
      if (lastResortOrigen && lastResortDestino) {
        const emergencyValue = `${lastResortOrigen} -> ${lastResortDestino}`;
        setHiddenValue("hidden-trayecto", emergencyValue);
      }
    }
    
    // Si el precio total es 0 o está vacío, intentar calcularlo de otra manera
    if (!finalPrecioTotal.trim() || finalPrecioTotal === "€0.00") {
      const precioIda = document.getElementById("hidden-precio-ida")?.value || "";
      const precioVuelta = document.getElementById("hidden-precio-vuelta")?.value || "";
      if (precioIda) {
        // Si tenemos al menos precio de ida, usar ese como fallback
        setHiddenValue("hidden-precio-total", precioIda);
      }
    }
    let additionalTripsData = [];
    (Array.isArray(window.additionalTrips) &&
      window.additionalTrips.length > 0 &&
      window.additionalTrips.forEach((trip, index) => {
        let formattedDate = trip.date || "";
        if (trip.date && trip.date.includes("-")) {
          const parts = trip.date.split("-");
          if (3 === parts.length) {
            const [yyyy, mm, dd] = parts;
            formattedDate = `${dd}/${mm}/${yyyy}`;
          }
        }
        const tripData = {
          numero: index + 1,
          origen: trip.origin || "",
          destino: trip.destination || "",
          fecha: formattedDate,
          hora: trip.time || "",
          distancia_km:
            "number" == typeof trip.distance
              ? parseFloat(trip.distance.toFixed(1))
              : 0,
          duracion: trip.duration || "",
          precio: "number" == typeof trip.price ? trip.price : 0,
        };
        additionalTripsData.push(tripData);
      }),
      setHiddenValue(
        "hidden-trayectos-adicionales",
        JSON.stringify(additionalTripsData),
      ));
    let sriTxt = "";
    const babySeats = parseInt(
      document.getElementById("baby-seats")?.value || "0",
      10,
    );
    if (babySeats > 0) {
      const sriYesFn =
          "function" == typeof confirmMsgs.sriYes
            ? confirmMsgs.sriYes
            : (b, c) => `${confirmMsgs.yes || ""} (${b || 0}, ${c || 0})`,
        sriAgePrefix =
          "string" == typeof confirmMsgs.sriAgeWeightPrefix
            ? confirmMsgs.sriAgeWeightPrefix
            : "";
      if (((sriTxt = sriYesFn(babySeats, 0)), babySeats > 0)) {
        const ageText = document.getElementById("baby-age")?.value || "";
        ageText && (sriTxt += sriAgePrefix + ageText);
      }
    }
    setHiddenValue("hidden-sillas-infantiles", encodeEmailHtmlEntities(sriTxt));
  };
}),
  (window.__user_ip = ""));
const SERVICE_ID = "service_4j49j0k",
  TEMPLATE_CLIENT = "template_a55wzag",
  TEMPLATE_ADMIN = "template_wo24o5o",
  PUBLIC_KEY = "xc4NBl3_8h3b1sLN9";
let emailJsLoadingPromise = null,
  emailJsInitialized = !1;
function loadEmailJsIfNeeded() {
  if (window.emailjs && "function" == typeof emailjs.send) {
    if (!emailJsInitialized && "function" == typeof emailjs.init)
      try {
        (emailjs.init({ publicKey: PUBLIC_KEY }), (emailJsInitialized = !0));
      } catch (err) {
        console.warn("EmailJS init failed", err);
      }
    return Promise.resolve();
  }
  return (
    emailJsLoadingPromise ||
    ((emailJsLoadingPromise = new Promise((resolve, reject) => {
      try {
        const existingScript = document.querySelector(
          'script[data-emailjs-loader="true"]',
        );
        if (existingScript)
          return (
            existingScript.addEventListener("load", () => {
              try {
                window.emailjs && "function" == typeof emailjs.init
                  ? (emailjs.init({ publicKey: PUBLIC_KEY }),
                    (emailJsInitialized = !0),
                    resolve())
                  : reject(
                      new Error("EmailJS library did not expose init function"),
                    );
              } catch (err) {
                reject(err);
              }
            }),
            void existingScript.addEventListener("error", reject)
          );
        const script = document.createElement("script");
        ((script.src =
          "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"),
          (script.async = !0),
          (script.defer = !0),
          script.setAttribute("data-emailjs-loader", "true"),
          (script.onload = () => {
            try {
              window.emailjs && "function" == typeof emailjs.init
                ? (emailjs.init({ publicKey: PUBLIC_KEY }),
                  (emailJsInitialized = !0),
                  resolve())
                : reject(
                    new Error("EmailJS library did not expose init function"),
                  );
            } catch (err) {
              reject(err);
            }
          }),
          (script.onerror = (err) => {
            (console.error("Failed to load EmailJS library", err), reject(err));
          }),
          document.head.appendChild(script));
      } catch (err) {
        reject(err);
      }
    })),
    emailJsLoadingPromise)
  );
}
function tcGetConfiguredMakeReviewWebhookUrl() {
  if ("undefined" == typeof window) return "";
  const url =
      window.TC_MAKE_REVIEW_WEBHOOK_URL || window.__TC_MAKE_REVIEW_WEBHOOK_URL,
    trimmed = "string" == typeof url ? url.trim() : "";
  return (
    trimmed || "https://hook.eu1.make.com/472qqvv21gimfeicjebfwt5xswshy38p"
  );
}
function tcParseLocalDateFromInputs(dateInputId, timeInputId) {
  const dateValue = document.getElementById(dateInputId)?.value || "",
    timeValue = document.getElementById(timeInputId)?.value || "";
  if (!dateValue || !timeValue) return null;
  const dateNums = (String(dateValue).trim().match(/\d+/g) || []).map(Number);
  if (dateNums.length < 3 || dateNums.some((n) => isNaN(n))) return null;
  let year, monthIndex, day;
  4 === String(dateNums[0]).length
    ? ((year = dateNums[0]),
      (monthIndex = dateNums[1] - 1),
      (day = dateNums[2]))
    : ((day = dateNums[0]),
      (monthIndex = dateNums[1] - 1),
      (year = dateNums[2]));
  const timeMatch = String(timeValue).match(/(\d{1,2}):(\d{2})/);
  if (!timeMatch) return null;
  const hour = parseInt(timeMatch[1], 10),
    minute = parseInt(timeMatch[2], 10);
  if (isNaN(hour) || isNaN(minute)) return null;
  const d = new Date(year, monthIndex, day, hour, minute, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}
function tcBuildReviewSendAt(tripEndDate) {
  if (!tripEndDate || isNaN(tripEndDate.getTime())) return null;
  const candidate = new Date(tripEndDate.getTime());
  (candidate.setDate(candidate.getDate() + 1), candidate.setHours(19, 0, 0, 0));
  return (
    candidate.getTime() - tripEndDate.getTime() < 864e5 &&
      (candidate.setDate(candidate.getDate() + 1),
      candidate.setHours(19, 0, 0, 0)),
    candidate
  );
}
function tcBuildWhatsAppReminderSendAt(tripStartDate) {
  if (!tripStartDate || isNaN(tripStartDate.getTime())) return null;
  const d = new Date(tripStartDate.getTime());
  return (d.setDate(d.getDate() - 1), d.setHours(18, 30, 0, 0), d);
}
function tcExtractCityFromRouteText(routeText) {
  if (!routeText) return "";
  const parts = String(routeText).split("->"),
    right = parts.length >= 2 ? parts[parts.length - 1] : routeText,
    cleaned = String(right).trim();
  if (!cleaned) return "";
  const firstComma = cleaned.split(",")[0],
    noParens = String(firstComma)
      .replace(/\([^)]*\)/g, "")
      .trim(),
    noZip = String(noParens)
      .replace(/\b\d{4,5}\b/g, "")
      .trim();
  return String(noZip)
    .replace(/\s+-\s+/g, " ")
    .trim();
}
function tcGetLocalityFromPlace(place) {
  try {
    return extractLocalityFromAddressComponents(
      place && place.address_components ? place.address_components : null,
    );
  } catch (_) {
    return "";
  }
}
function tcGenerateRequestId() {
  try {
    if (
      "undefined" != typeof crypto &&
      crypto &&
      "function" == typeof crypto.randomUUID
    )
      return crypto.randomUUID();
  } catch (_) {}
  try {
    return (
      "rid_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).slice(2, 10)
    );
  } catch (_) {
    return "rid_" + String(Date.now());
  }
}
function tcBuildBookingFingerprint(params) {
  try {
    const email = String(params?.email || "")
        .trim()
        .toLowerCase(),
      phone = String(
        params?.Telefono_WhatsApp || params?.Telefono || "",
      ).replace(/\D/g, ""),
      ida = String(params?.Trayecto_Ida || "")
        .trim()
        .toLowerCase(),
      vuelta = String(params?.Trayecto_Vuelta || "")
        .trim()
        .toLowerCase(),
      fechaIda = String(params?.Fecha_Hora_Ida || "")
        .trim()
        .toLowerCase(),
      fechaVuelta = String(params?.Fecha_Hora_Vuelta || "")
        .trim()
        .toLowerCase();
    return [
      email,
      phone,
      ida,
      vuelta,
      fechaIda,
      fechaVuelta,
      vuelta ? "1" : "0",
    ].join("|");
  } catch (_) {
    return "";
  }
}
function tcWasRecentlySentToMake(key, ttlMs) {
  try {
    if (!key) return !1;
    if ("undefined" == typeof window || !window.localStorage) return !1;
    const storageKey = "tc_make_last_" + key,
      raw = window.localStorage.getItem(storageKey),
      last = raw ? parseInt(raw, 10) : 0,
      now = Date.now();
    return !!(last && !isNaN(last) && now - last < ttlMs);
  } catch (_) {
    return !1;
  }
}
function tcMarkSentToMake(key) {
  try {
    if (!key) return;
    if ("undefined" == typeof window || !window.localStorage) return;
    const storageKey = "tc_make_last_" + key;
    window.localStorage.setItem(storageKey, String(Date.now()));
  } catch (_) {}
}
async function tcSendReviewRequestToMake() {
  try {
    if ("undefined" != typeof window) {
      const now = Date.now(),
        last = window.__tc_last_make_review_send_at || 0;
      if (window.__tc_make_review_inflight) return !1;
      if (now - last < 5e3) return !1;
      ((window.__tc_make_review_inflight = !0),
        (window.__tc_last_make_review_send_at = now));
    }
  } catch (_) {}
  const webhookUrl = tcGetConfiguredMakeReviewWebhookUrl();
  if (!webhookUrl) return !1;
  const params = buildTemplateParamsForEmailJS(),
    hasReturn = !(!currentBookingDetails || !currentBookingDetails.returnTrip),
    rawEmailCandidate =
      document.getElementById("email")?.value || params.email || "",
    rawNameCandidate =
      document.getElementById("nombre")?.value || params.Nombre || "",
    normalizedEmail = ((value) => {
      const s = String(value || "").trim();
      if (!s) return "";
      const angle = s.match(/<\s*([^>\s]+@[^>\s]+)\s*>/);
      if (angle && angle[1]) return String(angle[1]).trim();
      const any = s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
      return any && any[0] ? String(any[0]).trim() : s;
    })(rawEmailCandidate),
    normalizedName = String(rawNameCandidate || "").trim(),
    idaStart = tcParseLocalDateFromInputs("fecha-book", "hora-book"),
    vueltaStart = hasReturn
      ? tcParseLocalDateFromInputs("return-date", "return-time")
      : null,
    idaDurationMinutes = estimateDurationMinutesFromText(
      document.getElementById("hidden-duracion-ida")?.value || "",
    ),
    vueltaDurationMinutes = estimateDurationMinutesFromText(
      document.getElementById("hidden-duracion-vuelta")?.value || "",
    ),
    lastStart = hasReturn && vueltaStart ? vueltaStart : idaStart,
    lastDuration =
      hasReturn && vueltaStart ? vueltaDurationMinutes : idaDurationMinutes;
  if (!lastStart) return !1;
  
  // Validación adicional: verificar que los campos críticos tengan valores
  const trayectoIda = params.Trayecto_Ida || "";
  const nombre = params.Nombre || "";
  const email = params.email || "";
  
  if (!trayectoIda.trim()) {
    console.error("Error: Trayecto_Ida está vacío en review request. No se puede enviar.");
    return !1;
  }
  if (!nombre.trim()) {
    console.error("Error: Nombre está vacío en review request. No se puede enviar.");
    return !1;
  }
  if (!email.trim()) {
    console.error("Error: Email está vacío en review request. No se puede enviar.");
    return !1;
  }
  const tripEnd = new Date(
      lastStart.getTime() + 60 * (lastDuration + 30) * 1e3,
    ),
    sendAt = tcBuildReviewSendAt(tripEnd);
  if (!sendAt) return !1;
  const lastRouteText = hasReturn
      ? params.Trayecto_Vuelta || ""
      : params.Trayecto_Ida || "",
    destinationCity =
      tcGetLocalityFromPlace(
        void 0 !== autocompleteSelectedPlaces
          ? hasReturn
            ? autocompleteSelectedPlaces.destinoVuelta
            : autocompleteSelectedPlaces.destinoCalc
          : null,
      ) || tcExtractCityFromRouteText(lastRouteText),
    langCode = (function () {
      const l =
        void 0 !== CURRENT_LANG && CURRENT_LANG
          ? String(CURRENT_LANG).toLowerCase()
          : "es";
      return "en" === l ? "EN" : "de" === l ? "DE" : "fr" === l ? "FR" : "ES";
    })(),
    payload = {
      type: "review_request",
      request_id: tcGenerateRequestId(),
      lang: void 0 !== CURRENT_LANG ? CURRENT_LANG : "es",
      ...params,
      Lang: langCode,
      Nombre: normalizedName,
      email: normalizedEmail,
      Destino_Ciudad: destinationCity,
      Destino_Texto: lastRouteText,
      Has_Return: hasReturn ? "yes" : "no",
      Send_At_ISO: sendAt.toISOString(),
      Trip_End_ISO: tripEnd.toISOString(),
      customer: { name: normalizedName, email: normalizedEmail },
      booking: {
        has_return: hasReturn,
        last_leg: hasReturn ? "return" : "outbound",
        trayecto_ida: params.Trayecto_Ida || "",
        trayecto_vuelta: params.Trayecto_Vuelta || "",
        precio_total: params.Precio_Total_Reserva || "",
        destination_text: lastRouteText,
        destination_city: destinationCity,
      },
      trip_end_local: tripEnd.toISOString(),
      send_at_local: sendAt.toISOString(),
    };
  let dedupKey = "";
  try {
    const fp = tcBuildBookingFingerprint(params);
    if (
      ((payload.booking_fingerprint = fp),
      fp &&
        ((dedupKey = "review_" + fp), tcWasRecentlySentToMake(dedupKey, 12e4)))
    )
      return !1;
  } catch (_) {}
  const controller =
      "undefined" != typeof AbortController ? new AbortController() : null,
    timeout = setTimeout(() => {
      try {
        controller && controller.abort();
      } catch (_) {}
    }, 5e3);
  try {
    await tcSendPayloadToMake(webhookUrl, payload, controller);
    try {
      dedupKey && tcMarkSentToMake(dedupKey);
    } catch (_) {}
    return !0;
  } finally {
    try {
      "undefined" != typeof window && (window.__tc_make_review_inflight = !1);
    } catch (_) {}
    clearTimeout(timeout);
  }
}
async function tcSendWhatsAppReminderToMake() {
  try {
    if ("undefined" != typeof window) {
      const now = Date.now(),
        last = window.__tc_last_make_whatsapp_send_at || 0;
      if (window.__tc_make_whatsapp_inflight) return !1;
      if (now - last < 5e3) return !1;
      ((window.__tc_make_whatsapp_inflight = !0),
        (window.__tc_last_make_whatsapp_send_at = now));
    }
  } catch (_) {}
  const webhookUrl = tcGetConfiguredMakeWhatsAppWebhookUrl();
  if (!webhookUrl) return !1;
  try {
    const reviewUrl = tcGetConfiguredMakeReviewWebhookUrl();
    if (
      reviewUrl &&
      String(reviewUrl).trim() &&
      String(reviewUrl).trim() === String(webhookUrl).trim()
    )
      return !1;
  } catch (_) {}
  const params = buildTemplateParamsForEmailJS(),
    hasReturn = !(!currentBookingDetails || !currentBookingDetails.returnTrip),
    idaStart = tcParseLocalDateFromInputs("fecha-book", "hora-book"),
    vueltaStart = hasReturn
      ? tcParseLocalDateFromInputs("return-date", "return-time")
      : null,
    langCode = (function () {
      const l =
        void 0 !== CURRENT_LANG && CURRENT_LANG
          ? String(CURRENT_LANG).toLowerCase()
          : "es";
      return "en" === l ? "EN" : "de" === l ? "DE" : "fr" === l ? "FR" : "ES";
    })(),
    legs = [];
  
  // Validación adicional: verificar que los campos críticos tengan valores
  const trayectoIda = params.Trayecto_Ida || "";
  const nombre = params.Nombre || "";
  const telefono = params.Telefono || "";
  
  if (!trayectoIda.trim()) {
    console.error("Error: Trayecto_Ida está vacío en WhatsApp reminder. No se puede enviar.");
    return !1;
  }
  if (!nombre.trim()) {
    console.error("Error: Nombre está vacío en WhatsApp reminder. No se puede enviar.");
    return !1;
  }
  if (!telefono.trim()) {
    console.error("Error: Teléfono está vacío en WhatsApp reminder. No se puede enviar.");
    return !1;
  }
  
  if (
    (idaStart && legs.push({ leg: "ida", start: idaStart }),
    vueltaStart && legs.push({ leg: "vuelta", start: vueltaStart }),
    !legs.length)
  )
    return !1;
  const controller =
      "undefined" != typeof AbortController ? new AbortController() : null,
    timeout = setTimeout(() => {
      try {
        controller && controller.abort();
      } catch (_) {}
    }, 5e3);
  try {
    for (let i = 0; i < legs.length; i++) {
      const legInfo = legs[i],
        sendAt = tcBuildWhatsAppReminderSendAt(legInfo.start);
      if (!sendAt) continue;
      const normalizedPhone = normalizePhoneForWhatsApp(
          params?.Telefono_WhatsApp || params?.Telefono || "",
          CURRENT_LANG,
        ),
        payload = {
          type: "whatsapp_reminder",
          request_id: tcGenerateRequestId(),
          ...params,
          Lang: langCode,
          Leg: legInfo.leg,
          Reminder_Send_At_ISO: sendAt.toISOString(),
          Reminder_For_ISO: legInfo.start.toISOString(),
          Fecha_envio: sendAt.toISOString(),
          fecha_envio: sendAt.toISOString(),
          send_at_local: sendAt.toISOString(),
          trip_send_at_local: sendAt.toISOString(),
        };
      normalizedPhone &&
        ((payload.Telefono_WhatsApp = normalizedPhone),
        (payload.Telefono = normalizedPhone));
      let waDedupKey = "";
      try {
        const fp = tcBuildBookingFingerprint(params);
        if (
          ((payload.booking_fingerprint = fp),
          fp &&
            ((waDedupKey = "wa_" + fp + "_" + legInfo.leg),
            tcWasRecentlySentToMake(waDedupKey, 12e4)))
        )
          continue;
      } catch (_) {}
      await tcSendPayloadToMake(webhookUrl, payload, controller);
      try {
        waDedupKey && tcMarkSentToMake(waDedupKey);
      } catch (_) {}
    }
    return !0;
  } finally {
    try {
      "undefined" != typeof window && (window.__tc_make_whatsapp_inflight = !1);
    } catch (_) {}
    clearTimeout(timeout);
  }
}
function normalizePhoneForWhatsApp(phoneInput, lang) {
  if (!phoneInput) return "";
  const value = String(phoneInput).trim(),
    hasPlus = value.startsWith("+"),
    hasDoubleZero = value.startsWith("00");
  let digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (hasPlus) return digits;
  if (hasDoubleZero)
    return (digits.startsWith("00") && (digits = digits.slice(2)), digits);
  const langLower = "string" == typeof lang ? lang.toLowerCase() : "";
  let defaultCountryCode = "34";
  if (
    ("de" === langLower
      ? (defaultCountryCode = "49")
      : "fr" === langLower && (defaultCountryCode = "33"),
    digits.startsWith(defaultCountryCode))
  )
    return digits;
  if ("de" === langLower) {
    if (digits.length >= 10 && digits.length <= 11)
      return defaultCountryCode + digits;
  } else if ("fr" === langLower) {
    if (9 === digits.length) return defaultCountryCode + digits;
  } else if (9 === digits.length && /^[6789]/.test(digits))
    return defaultCountryCode + digits;
  return digits.length > 9
    ? digits
    : "de" === langLower || "fr" === langLower
      ? defaultCountryCode + digits
      : digits;
}
function formatPhoneWithPrefix(phoneInput, lang) {
  if (!phoneInput) return "";
  const value = String(phoneInput).trim(),
    hasPlus = value.startsWith("+"),
    hasDoubleZero = value.startsWith("00");
  let digits = value.replace(/\D/g, "");
  if (!digits) return value;
  if (hasPlus) return value;
  if (hasDoubleZero) return "+" + digits.replace(/^00/, "");
  const langLower = "string" == typeof lang ? lang.toLowerCase() : "";
  let defaultCountryCode = "34";
  if (
    ("de" === langLower
      ? (defaultCountryCode = "49")
      : "fr" === langLower && (defaultCountryCode = "33"),
    digits.startsWith(defaultCountryCode) &&
      digits.length > defaultCountryCode.length)
  )
    return "+" + digits;
  if ("de" === langLower) {
    if (digits.length >= 10 && digits.length <= 11)
      return "+" + defaultCountryCode + digits;
  } else if ("fr" === langLower) {
    if (9 === digits.length) return "+" + defaultCountryCode + digits;
  } else if (9 === digits.length && /^[6789]/.test(digits))
    return "+" + defaultCountryCode + digits;
  return digits.length > 9
    ? "+" + digits
    : "de" === langLower || "fr" === langLower
      ? "+" + defaultCountryCode + digits
      : value;
}
function estimateDurationMinutesFromText(durationText) {
  if (!durationText) return 60;
  const matches = String(durationText).match(/\d+/g);
  if (!matches || !matches.length) return 60;
  if (1 === matches.length) {
    const minutes = parseInt(matches[0], 10);
    return !isNaN(minutes) && minutes > 0 && minutes <= 600 ? minutes : 60;
  }
  const hours = parseInt(matches[0], 10),
    minutes = parseInt(matches[1], 10);
  let total = 0;
  return (
    !isNaN(hours) && hours > 0 && (total += 60 * hours),
    !isNaN(minutes) && minutes > 0 && (total += minutes),
    total ? (total > 600 ? 600 : total) : 60
  );
}
function buildGoogleCalendarLink(options) {
  if (!options) return "";
  try {
    const dateEl = document.getElementById(options.dateInputId),
      timeEl = document.getElementById(options.timeInputId),
      dateValue = dateEl && dateEl.value ? dateEl.value : "",
      timeValue = timeEl && timeEl.value ? timeEl.value : "";
    if (!dateValue || !timeValue) return "";
    let year, monthIndex, day;
    const dateNums = (String(dateValue).trim().match(/\d+/g) || []).map(Number);
    let hour, minute;
    dateNums.length >= 3 &&
      dateNums.every((n) => !isNaN(n)) &&
      (4 === String(dateNums[0]).length
        ? ((year = dateNums[0]),
          (monthIndex = dateNums[1] - 1),
          (day = dateNums[2]))
        : ((day = dateNums[0]),
          (monthIndex = dateNums[1] - 1),
          (year = dateNums[2])));
    const timeMatch = String(timeValue).match(/(\d{1,2}):(\d{2})/);
    if (
      (timeMatch &&
        ((hour = parseInt(timeMatch[1], 10)),
        (minute = parseInt(timeMatch[2], 10))),
      !year ||
        isNaN(year) ||
        isNaN(monthIndex) ||
        monthIndex < 0 ||
        monthIndex > 11 ||
        !day ||
        isNaN(day) ||
        null == hour ||
        isNaN(hour) ||
        null == minute ||
        isNaN(minute))
    )
      return "";
    const start = new Date(year, monthIndex, day, hour, minute, 0, 0);
    let durationMinutes =
      "number" == typeof options.durationMinutes && options.durationMinutes > 0
        ? options.durationMinutes
        : 60;
    const maxDuration = 600;
    durationMinutes > maxDuration && (durationMinutes = maxDuration);
    const end = new Date(start.getTime() + 6e4 * durationMinutes),
      formatForGCal = (date) =>
        "" +
        date.getFullYear() +
        String(date.getMonth() + 1).padStart(2, "0") +
        String(date.getDate()).padStart(2, "0") +
        "T" +
        String(date.getHours()).padStart(2, "0") +
        String(date.getMinutes()).padStart(2, "0") +
        "00",
      startStr = formatForGCal(start),
      endStr = formatForGCal(end),
      text = encodeURIComponent(options.title || ""),
      details = encodeURIComponent(options.description || "");
    return (
      "https://calendar.google.com/calendar/render?action=TEMPLATE&text=" +
      text +
      "&dates=" +
      startStr +
      "/" +
      endStr +
      "&details=" +
      details +
      "&location=" +
      encodeURIComponent(options.location || "") +
      "&ctz=Europe/Madrid"
    );
  } catch (err) {
    try {
      console.warn("Error building Google Calendar link", err);
    } catch (_) {}
    return "";
  }
}
function buildTemplateParamsForEmailJS() {
  const get = (id) => document.getElementById(id)?.value || "",
    telefonoOriginal = get("telefono"),
    telefonoWhatsApp = normalizePhoneForWhatsApp(
      telefonoOriginal,
      CURRENT_LANG,
    ),
    telefonoConPrefijo = formatPhoneWithPrefix(telefonoOriginal, CURRENT_LANG),
    mascotaRaw =
      ((name = "mascota"),
      document.querySelector('input[name="' + name + '"]:checked')?.value ||
        "");
  var name;
  const mascotaParam =
      "no" === mascotaRaw
        ? ""
        : "yes" === mascotaRaw
          ? getMessagesSection("confirmation")?.yes || ""
          : mascotaRaw,
    confirmMsgs = getMessagesSection("confirmation"),
    now = new Date(),
    localeForNow = LOCALES[CURRENT_LANG] || LOCALES.es || "es-ES",
    currentDateStr = now.toLocaleString(localeForNow, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    userIp =
      "undefined" != typeof window && window.__user_ip ? window.__user_ip : "",
    trayectoVuelta = get("hidden-trayecto-vuelta"),
    detallesVuelta = get("hidden-detalles-vuelta"),
    fechaHoraVuelta = get("hidden-fecha-hora-vuelta") || detallesVuelta,
    detallesIda = get("hidden-detalles-ida"),
    trayectoIda =
      get("hidden-trayecto") ||
      `${get("origen-book")} -> ${get("destino-book")}`,
    duracionIda = get("hidden-duracion-ida"),
    duracionVuelta = get("hidden-duracion-vuelta"),
    precioIda = get("hidden-precio-ida"),
    precioVuelta = get("hidden-precio-vuelta"),
    idaDurationMinutes = estimateDurationMinutesFromText(duracionIda),
    vueltaDurationMinutes = estimateDurationMinutesFromText(duracionVuelta);
  let origenIda = "",
    destinoIda = "";
  if (trayectoIda) {
    const parts = String(trayectoIda).split("->");
    parts.length >= 2 &&
      ((origenIda = parts[0].trim()), (destinoIda = parts[1].trim()));
  }
  let calendarTitleIda = "Taxi Conil - Ida",
    calendarDescriptionIdaLines = [];
  switch (CURRENT_LANG) {
    case "fr":
      ((calendarTitleIda = "Taxi Conil - Aller"),
        (calendarDescriptionIdaLines = [
          "Merci pour votre réservation.",
          "",
          "Aller (départ)",
          "",
          "Origine : " + (origenIda || trayectoIda || ""),
          "Destination : " + (destinoIda || ""),
          "Passagers : " + (get("pasajeros") || ""),
          "Téléphone : " + (telefonoOriginal || ""),
          "Email : " + (get("email") || ""),
          "",
          "Taxi Conil - +34 670 70 57 74",
        ]));
      break;
    case "en":
      ((calendarTitleIda = "Taxi Conil - Outbound"),
        (calendarDescriptionIdaLines = [
          "Departure: " + (detallesIda || ""),
          "From: " + (origenIda || trayectoIda || ""),
          "To: " + (destinoIda || ""),
          "Price: " + (precioIda || ""),
          "Note: Spanish peninsular time.",
        ]));
      break;
    case "de":
      ((calendarTitleIda = "Taxi Conil - Hinfahrt"),
        (calendarDescriptionIdaLines = [
          "Abfahrt: " + (detallesIda || ""),
          "Von: " + (origenIda || trayectoIda || ""),
          "Nach: " + (destinoIda || ""),
          "Preis: " + (precioIda || ""),
          "Hinweis: spanische Festlandszeit.",
        ]));
      break;
    default:
      ((calendarTitleIda = "Taxi Conil - Ida"),
        (calendarDescriptionIdaLines = [
          "Salida: " + (detallesIda || ""),
          "Origen: " + (origenIda || trayectoIda || ""),
          "Destino: " + (destinoIda || ""),
          "Precio: " + (precioIda || ""),
          "Nota: hora peninsular (España).",
        ]));
  }
  const calendarLinkIda = buildGoogleCalendarLink({
    title: calendarTitleIda,
    description: calendarDescriptionIdaLines.join("\n"),
    location: trayectoIda,
    dateInputId: "fecha-book",
    timeInputId: "hora-book",
    durationMinutes: idaDurationMinutes,
  });
  let calendarLinkVuelta = "";
  if (trayectoVuelta && fechaHoraVuelta) {
    let origenVuelta = "",
      destinoVuelta = "";
    if (trayectoVuelta) {
      const partsVuelta = String(trayectoVuelta).split("->");
      partsVuelta.length >= 2 &&
        ((origenVuelta = partsVuelta[0].trim()),
        (destinoVuelta = partsVuelta[1].trim()));
    }
    let calendarTitleVuelta = "Taxi Conil - Vuelta",
      calendarDescriptionVueltaLines = [];
    switch (CURRENT_LANG) {
      case "fr":
        ((calendarTitleVuelta = "Taxi Conil - Retour"),
          (calendarDescriptionVueltaLines = [
            "Merci pour votre réservation.",
            "",
            "Retour (départ)",
            "",
            "Origine : " + (origenVuelta || trayectoVuelta || ""),
            "Destination : " + (destinoVuelta || ""),
            "Passagers : " + (get("pasajeros") || ""),
            "Téléphone : " + (telefonoOriginal || ""),
            "Email : " + (get("email") || ""),
            "",
            "Taxi Conil - +34 670 70 57 74",
          ]));
        break;
      case "en":
        ((calendarTitleVuelta = "Taxi Conil - Return"),
          (calendarDescriptionVueltaLines = [
            "Departure: " + (fechaHoraVuelta || ""),
            "From: " + (origenVuelta || trayectoVuelta || ""),
            "To: " + (destinoVuelta || ""),
            "Price: " + (precioVuelta || ""),
            "Note: Spanish peninsular time.",
          ]));
        break;
      case "de":
        ((calendarTitleVuelta = "Taxi Conil - Rueckfahrt"),
          (calendarDescriptionVueltaLines = [
            "Abfahrt: " + (fechaHoraVuelta || ""),
            "Von: " + (origenVuelta || trayectoVuelta || ""),
            "Nach: " + (destinoVuelta || ""),
            "Preis: " + (precioVuelta || ""),
            "Hinweis: spanische Festlandszeit.",
          ]));
        break;
      default:
        ((calendarTitleVuelta = "Taxi Conil - Vuelta"),
          (calendarDescriptionVueltaLines = [
            "Salida: " + (fechaHoraVuelta || ""),
            "Origen: " + (origenVuelta || trayectoVuelta || ""),
            "Destino: " + (destinoVuelta || ""),
            "Precio: " + (precioVuelta || ""),
            "Nota: hora peninsular (España).",
          ]));
    }
    calendarLinkVuelta = buildGoogleCalendarLink({
      title: calendarTitleVuelta,
      description: calendarDescriptionVueltaLines.join("\n"),
      location: trayectoVuelta,
      dateInputId: "return-date",
      timeInputId: "return-time",
      durationMinutes: vueltaDurationMinutes,
    });
  }
  return {
    Nombre: get("nombre"),
    Telefono: telefonoConPrefijo,
    Telefono_WhatsApp: telefonoWhatsApp,
    email: get("email"),
    Pasajeros: get("pasajeros") || "1",
    Maletas_Cabina: get("maletas-cabina") || "0",
    Maletas_Grandes: get("maletas-grandes") || "0",
    mascota: mascotaParam,
    Comentarios: get("comentarios"),
    Trayecto_Ida: trayectoIda,
    Detalles_Viaje_Ida: detallesIda,
    Fecha_Hora_Ida: detallesIda,
    Distancia_Ida: get("hidden-distancia-ida"),
    Duracion_Ida: duracionIda,
    Precio_Ida: precioIda,
    Trayecto_Vuelta: trayectoVuelta,
    Detalles_Viaje_Vuelta: detallesVuelta,
    Fecha_Hora_Vuelta: fechaHoraVuelta,
    Distancia_Vuelta: get("hidden-distancia-vuelta"),
    Duracion_Vuelta: duracionVuelta,
    Precio_Vuelta: precioVuelta,
    Precio_Total_Reserva: get("hidden-precio-total") || precioIda,
    SRI_Detalle: (() => {
      const bebe = parseInt(get("baby-seats") || "0", 10),
        elevador = parseInt(get("child-seats") || "0", 10),
        sriYesFn =
          "function" == typeof confirmMsgs.sriYes
            ? confirmMsgs.sriYes
            : (b, c) => `${confirmMsgs.yes || ""} (${b || 0}, ${c || 0})`;
      return encodeEmailHtmlEntities(
        bebe > 0 || elevador > 0 ? sriYesFn(bebe, elevador) : "",
      );
    })(),
    Edad_Peso_Bebe: (() => {
      if (parseInt(get("baby-seats") || "0", 10) > 0) {
        return document.getElementById("baby-age")?.value || "";
      }
      return "";
    })(),
    current_date: currentDateStr,
    user_ip: userIp,
    Calendar_Link_Ida: calendarLinkIda,
    Calendar_Link_Vuelta: calendarLinkVuelta,
  };
}
async function sendBookingViaEmailJS(e) {
  (e && "function" == typeof e.preventDefault && e.preventDefault());
  
  // Validación crítica antes de intentar fillHiddenFields
  if ("function" != typeof window.fillHiddenFields) {
    console.error("CRITICAL ERROR: fillHiddenFields() function could not be found.");
    return !1;
  }
  
  try {
    window.fillHiddenFields();
  } catch (fillError) {
    console.error("Error al llenar campos hidden en sendBookingViaEmailJS:", fillError);
    return !1;
  }
  
  // Validación crítica después de fillHiddenFields
  const trayectoIda = document.getElementById("hidden-trayecto")?.value || "";
  const precioTotal = document.getElementById("hidden-precio-total")?.value || "";
  
  if (!trayectoIda.trim()) {
    console.error("Error crítico en sendBookingViaEmailJS: hidden-trayecto está vacío");
    return !1;
  }
  
  if (!precioTotal.trim()) {
    console.error("Error crítico en sendBookingViaEmailJS: hidden-precio-total está vacío");
    return !1;
  }
  
  const params = buildTemplateParamsForEmailJS();
  params.Precio_Ida ||
    (params.Precio_Ida = params.Precio_Total_Reserva || "€ 0.00");
  const missing = [];
  if ((params.Trayecto_Ida || missing.push("Trayecto_Ida"), missing.length)) {
    const alerts = getMessagesSection("alerts") || {},
      msg =
        "function" == typeof alerts.missingCriticalData
          ? alerts.missingCriticalData(missing)
          : "Faltan datos para enviar la reserva: " + missing.join(", ");
    return (
      window.__emailjs_debug && window.__emailjs_debug(params, { error: msg }),
      alert(msg),
      !1
    );
  }
  try {
    await loadEmailJsIfNeeded();
  } catch (loadErr) {
    console.error("Error loading EmailJS library:", loadErr);
    const errorMsg = document.getElementById("form-error-message"),
      bookingMsgs = getMessagesSection("booking") || {
        emailJsError:
          "No se ha podido enviar el correo en este momento. Inténtelo de nuevo.",
      };
    return (
      errorMsg &&
        ((errorMsg.textContent = bookingMsgs.emailJsError),
        (errorMsg.style.display = "block"),
        errorMsg.scrollIntoView({ behavior: "smooth" })),
      !1
    );
  }
  try {
    return (
      window.__emailjs_debug && window.__emailjs_debug(params, null),
      await emailjs.send(SERVICE_ID, TEMPLATE_CLIENT, params),
      await emailjs.send(SERVICE_ID, TEMPLATE_ADMIN, params),
      !0
    );
  } catch (err) {
    console.error("Error al enviar por EmailJS (fix):", err);
    const errorMsg = document.getElementById("form-error-message"),
      bookingMsgs = getMessagesSection("booking") || {
        emailJsError:
          "No se ha podido enviar el correo en este momento. Inténtelo de nuevo.",
      };
    errorMsg &&
      ((errorMsg.textContent = bookingMsgs.emailJsError),
      (errorMsg.style.display = "block"),
      errorMsg.scrollIntoView({ behavior: "smooth" }));
    const overlay = document.getElementById("booking-confirmation-overlay");
    return (
      overlay && closeDialog(overlay),
      window.__emailjs_debug &&
        window.__emailjs_debug(params, {
          error: err && err.toString ? err.toString() : err,
        }),
      !1
    );
  } finally {
    const finalBookBtn = document.getElementById("final-book-btn");
    if (finalBookBtn) {
      finalBookBtn.disabled = !1;
      const bookingMsgs = getMessagesSection("booking") || {
        confirmButton: "Confirmar solicitud de reserva",
      };
      finalBookBtn.innerHTML = bookingMsgs.confirmButton;
    }
  }
}
function showElement(el) {
  el &&
    (el.__smoothHideTimeoutId &&
      (clearTimeout(el.__smoothHideTimeoutId), delete el.__smoothHideTimeoutId),
    el.classList.remove("hiding"),
    el.classList.add("visible"),
    (el.style.display = "block"));
}
function hideElement(el) {
  el &&
    (el.__smoothHideTimeoutId &&
      (clearTimeout(el.__smoothHideTimeoutId), delete el.__smoothHideTimeoutId),
    el.classList.remove("hiding"),
    el.classList.remove("visible"),
    (el.style.display = "none"));
}
function hideElementSmooth(el, durationMs = 280) {
  if (!el) return;
  try {
    if (
      "undefined" != typeof window &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return void hideElement(el);
  } catch (_) {}
  el.__smoothHideTimeoutId &&
    (clearTimeout(el.__smoothHideTimeoutId), delete el.__smoothHideTimeoutId);
  el.classList.contains("visible") || "block" === el.style.display
    ? ((el.style.display = "block"),
      el.classList.add("hiding"),
      (el.__smoothHideTimeoutId = setTimeout(() => {
        (el.classList.remove("hiding"),
          el.classList.remove("visible"),
          (el.style.display = "none"),
          delete el.__smoothHideTimeoutId);
      }, durationMs)))
    : hideElement(el);
}
let currentOpenDialog = null,
  lastFocusedBeforeDialog = null;
function getFocusableElements(container) {
  if (!container) return [];
  return Array.from(
    container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter(
    (el) =>
      null !== el.offsetParent || "false" === el.getAttribute("aria-hidden"),
  );
}
function openDialog(el) {
  if (!el) return;
  try {
    if ("booking-confirmation-overlay" === el.id && !el.__movedToBody) {
      const placeholder = document.createElement("div");
      ((placeholder.style.display = "none"),
        placeholder.setAttribute("data-dialog-placeholder", el.id),
        el.parentNode && el.parentNode.insertBefore(placeholder, el),
        document.body.appendChild(el),
        (el.__dialogPlaceholder = placeholder),
        (el.__movedToBody = !0));
    }
    if ("booking-success-message" === el.id && !el.__movedToBody) {
      const placeholder = document.createElement("div");
      ((placeholder.style.display = "none"),
        placeholder.setAttribute("data-dialog-placeholder", el.id),
        el.parentNode && el.parentNode.insertBefore(placeholder, el),
        document.body.appendChild(el),
        (el.__dialogPlaceholder = placeholder),
        (el.__movedToBody = !0));
    }
  } catch (_) {}
  showElement(el);
  try {
    el.classList.add("open");
  } catch (_) {}
  try {
    el.getAttribute &&
      "dialog" === el.getAttribute("role") &&
      (el.style.display = "flex");
  } catch (_) {}
  try {
    if ("booking-success-message" === el.id) {
      try {
        el.style.setProperty("position", "fixed", "important");
      } catch (_) {
        el.style.position = "fixed";
      }
      try {
        el.style.setProperty("top", "0", "important");
      } catch (_) {
        el.style.top = "0";
      }
      try {
        el.style.setProperty("right", "0", "important");
      } catch (_) {
        el.style.right = "0";
      }
      try {
        el.style.setProperty("bottom", "0", "important");
      } catch (_) {
        el.style.bottom = "0";
      }
      try {
        el.style.setProperty("left", "0", "important");
      } catch (_) {
        el.style.left = "0";
      }
      try {
        el.style.setProperty("z-index", "4000", "important");
      } catch (_) {
        el.style.zIndex = "4000";
      }
      try {
        el.style.setProperty("display", "flex", "important");
      } catch (_) {
        el.style.display = "flex";
      }
      try {
        el.style.setProperty("align-items", "center", "important");
      } catch (_) {
        el.style.alignItems = "center";
      }
      try {
        el.style.setProperty("justify-content", "center", "important");
      } catch (_) {
        el.style.justifyContent = "center";
      }
      try {
        el.style.setProperty("background", "rgba(0,0,0,0.62)", "important");
      } catch (_) {
        el.style.background = "rgba(0,0,0,0.62)";
      }
      try {
        el.style.setProperty("padding", "24px", "important");
      } catch (_) {
        el.style.padding = "24px";
      }
      try {
        el.style.setProperty("overflow", "auto", "important");
      } catch (_) {
        el.style.overflow = "auto";
      }
      try {
        el.style.setProperty(
          "-webkit-overflow-scrolling",
          "touch",
          "important",
        );
      } catch (_) {
        el.style.webkitOverflowScrolling = "touch";
      }
      const inner = el.querySelector(".container-inner");
      if (inner) {
        try {
          inner.style.setProperty("width", "min(640px, 100%)", "important");
        } catch (_) {
          inner.style.width = "min(640px, 100%)";
        }
        try {
          inner.style.setProperty("margin", "0 auto", "important");
        } catch (_) {
          inner.style.margin = "0 auto";
        }
        try {
          inner.style.setProperty("background", "#fff", "important");
        } catch (_) {
          inner.style.background = "#fff";
        }
        try {
          inner.style.setProperty("border-radius", "18px", "important");
        } catch (_) {
          inner.style.borderRadius = "18px";
        }
        try {
          inner.style.setProperty(
            "box-shadow",
            "0 20px 60px rgba(0,0,0,0.35)",
            "important",
          );
        } catch (_) {
          inner.style.boxShadow = "0 20px 60px rgba(0,0,0,0.35)";
        }
        try {
          inner.style.setProperty("padding", "22px 18px", "important");
        } catch (_) {
          inner.style.padding = "22px 18px";
        }
        try {
          inner.style.setProperty("text-align", "center", "important");
        } catch (_) {
          inner.style.textAlign = "center";
        }
      }
    }
  } catch (_) {}
  el.setAttribute("aria-hidden", "false");
  try {
    if ("booking-confirmation-overlay" === el.id) {
      (el.dataset.prevBodyOverflow ||
        (el.dataset.prevBodyOverflow = document.body.style.overflow || ""),
        el.dataset.prevHtmlOverflow ||
          (el.dataset.prevHtmlOverflow =
            document.documentElement.style.overflow || ""));
      try {
        const scrollbarWidth = Math.max(
          0,
          window.innerWidth - document.documentElement.clientWidth,
        );
        (el.dataset.prevBodyPaddingRight ||
          (el.dataset.prevBodyPaddingRight =
            document.body.style.paddingRight || ""),
          scrollbarWidth > 0 &&
            (document.body.style.paddingRight = `${scrollbarWidth}px`));
      } catch (_) {}
      ((document.body.style.overflow = "hidden"),
        (document.documentElement.style.overflow = "hidden"));
      try {
        const ida = document.getElementById("confirm-ida-route-container"),
          vuelta = document.getElementById("confirm-vuelta-route-container");
        (ida &&
          ida.dataset &&
          (delete ida.dataset.confirmMapAnimOneWay,
          delete ida.dataset.confirmMapStateOneWay),
          vuelta &&
            vuelta.dataset &&
            (delete vuelta.dataset.confirmMapAnimReturn,
            delete vuelta.dataset.confirmMapStateReturn));
      } catch (_) {}
    }
  } catch (_) {}
  if (
    ((currentOpenDialog = el),
    (lastFocusedBeforeDialog =
      document.activeElement && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null),
    el.__dialogCloseTimeoutId)
  ) {
    try {
      clearTimeout(el.__dialogCloseTimeoutId);
    } catch (_) {}
    delete el.__dialogCloseTimeoutId;
    try {
      el.style.display = "";
    } catch (_) {}
  }
  try {
    el.scrollTop = 0;
    const primaryScrollable = el.querySelector(
      ".confirmation-modal, .container-inner",
    );
    if (primaryScrollable) primaryScrollable.scrollTop = 0;
    else {
      const descendants = el.querySelectorAll("*");
      for (const node of descendants)
        if (
          node &&
          "number" == typeof node.scrollTop &&
          node.scrollHeight > node.clientHeight + 1
        ) {
          node.scrollTop = 0;
          break;
        }
    }
    "function" == typeof requestAnimationFrame &&
      requestAnimationFrame(() => {
        try {
          ((el.scrollTop = 0),
            primaryScrollable && (primaryScrollable.scrollTop = 0));
        } catch (_) {}
      });
  } catch (_) {}
  const focusable = getFocusableElements(el);
  if (focusable.length > 0)
    try {
      focusable[0].focus({ preventScroll: !0 });
    } catch (_) {}
  const keydownHandler = function (e) {
    if (currentOpenDialog)
      if ("Tab" === e.key) {
        const focusableEls = getFocusableElements(currentOpenDialog);
        if (!focusableEls.length) return;
        const first = focusableEls[0],
          last = focusableEls[focusableEls.length - 1];
        e.shiftKey
          ? (document.activeElement !== first &&
              currentOpenDialog.contains(document.activeElement)) ||
            (e.preventDefault(), last.focus())
          : (document.activeElement !== last &&
              currentOpenDialog.contains(document.activeElement)) ||
            (e.preventDefault(), first.focus());
      } else
        "Escape" === e.key &&
          (e.preventDefault(), closeDialog(currentOpenDialog));
  };
  ((el.__dialogKeydownHandler = keydownHandler),
    document.addEventListener("keydown", keydownHandler));
}
function closeDialog(el) {
  if (!el) return;
  const isBookingConfirmationOverlay = "booking-confirmation-overlay" === el.id,
    isBookingSuccessMessage = "booking-success-message" === el.id;
  let prefersReducedMotion = !1;
  try {
    prefersReducedMotion =
      "undefined" != typeof window &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch (_) {}
  try {
    if (isBookingConfirmationOverlay) {
      const prevBody =
          el.dataset && "string" == typeof el.dataset.prevBodyOverflow
            ? el.dataset.prevBodyOverflow
            : "",
        prevHtml =
          el.dataset && "string" == typeof el.dataset.prevHtmlOverflow
            ? el.dataset.prevHtmlOverflow
            : "";
      ((document.body.style.overflow = prevBody),
        (document.documentElement.style.overflow = prevHtml));
      try {
        const prevPad =
          el.dataset && "string" == typeof el.dataset.prevBodyPaddingRight
            ? el.dataset.prevBodyPaddingRight
            : "";
        document.body.style.paddingRight = prevPad;
      } catch (_) {}
      el.dataset &&
        (delete el.dataset.prevBodyOverflow,
        delete el.dataset.prevHtmlOverflow,
        delete el.dataset.prevBodyPaddingRight);
    }
  } catch (_) {}
  isBookingConfirmationOverlay &&
  !prefersReducedMotion &&
  el.classList &&
  el.classList.contains("visible")
    ? (el.__dialogCloseTimeoutId &&
        (clearTimeout(el.__dialogCloseTimeoutId),
        delete el.__dialogCloseTimeoutId),
      (el.style.display = "flex"),
      el.classList.remove("visible"),
      (el.__dialogCloseTimeoutId = setTimeout(() => {
        (hideElement(el),
          (el.style.display = ""),
          delete el.__dialogCloseTimeoutId);
      }, 520)))
    : hideElement(el);
  try {
    if (isBookingSuccessMessage) {
      try {
        el.style.removeProperty("position");
      } catch (_) {
        el.style.position = "";
      }
      try {
        el.style.removeProperty("top");
      } catch (_) {
        el.style.top = "";
      }
      try {
        el.style.removeProperty("right");
      } catch (_) {
        el.style.right = "";
      }
      try {
        el.style.removeProperty("bottom");
      } catch (_) {
        el.style.bottom = "";
      }
      try {
        el.style.removeProperty("left");
      } catch (_) {
        el.style.left = "";
      }
      try {
        el.style.removeProperty("z-index");
      } catch (_) {
        el.style.zIndex = "";
      }
      try {
        el.style.removeProperty("display");
      } catch (_) {
        el.style.display = "";
      }
      try {
        el.style.removeProperty("align-items");
      } catch (_) {
        el.style.alignItems = "";
      }
      try {
        el.style.removeProperty("justify-content");
      } catch (_) {
        el.style.justifyContent = "";
      }
      try {
        el.style.removeProperty("background");
      } catch (_) {
        el.style.background = "";
      }
      try {
        el.style.removeProperty("padding");
      } catch (_) {
        el.style.padding = "";
      }
      try {
        el.style.removeProperty("overflow");
      } catch (_) {
        el.style.overflow = "";
      }
      try {
        el.style.removeProperty("-webkit-overflow-scrolling");
      } catch (_) {
        el.style.webkitOverflowScrolling = "";
      }
      const inner = el.querySelector(".container-inner");
      if (inner) {
        try {
          inner.style.removeProperty("width");
        } catch (_) {
          inner.style.width = "";
        }
        try {
          inner.style.removeProperty("margin");
        } catch (_) {
          inner.style.margin = "";
        }
        try {
          inner.style.removeProperty("background");
        } catch (_) {
          inner.style.background = "";
        }
        try {
          inner.style.removeProperty("border-radius");
        } catch (_) {
          inner.style.borderRadius = "";
        }
        try {
          inner.style.removeProperty("box-shadow");
        } catch (_) {
          inner.style.boxShadow = "";
        }
        try {
          inner.style.removeProperty("padding");
        } catch (_) {
          inner.style.padding = "";
        }
        try {
          inner.style.removeProperty("text-align");
        } catch (_) {
          inner.style.textAlign = "";
        }
      }
    }
  } catch (_) {}
  try {
    el.classList.remove("open");
  } catch (_) {}
  if (
    (el.setAttribute("aria-hidden", "true"),
    el.__dialogKeydownHandler &&
      (document.removeEventListener("keydown", el.__dialogKeydownHandler),
      delete el.__dialogKeydownHandler),
    currentOpenDialog === el && (currentOpenDialog = null),
    lastFocusedBeforeDialog &&
      "function" == typeof lastFocusedBeforeDialog.focus)
  )
    try {
      lastFocusedBeforeDialog.focus({ preventScroll: !0 });
    } catch (_) {}
  lastFocusedBeforeDialog = null;
}
(document.addEventListener("DOMContentLoaded", () => {
  const isMobileForInputs =
    "undefined" != typeof window &&
    "undefined" != typeof navigator &&
    (/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (window.matchMedia && window.matchMedia("(pointer: coarse)").matches));
  (document.querySelectorAll('input[type="time"]').forEach((input) => {
    input.addEventListener("pointerdown", (e) => {
      try {
        input.focus({ preventScroll: !0 });
      } catch (_) {
        try {
          input.focus();
        } catch (_) {}
      }
      try {
        "function" == typeof input.showPicker && input.showPicker();
      } catch (_) {}
    });
  }),
    document
      .querySelectorAll(
        'input[type="text"], input[type="email"], input[type="tel"], textarea',
      )
      .forEach((input) => {
        if (input.readOnly) return;
        if (!input.parentNode) return;
        const wrapper = document.createElement("div");
        wrapper.className = "input-wrapper";
        try {
          input.parentNode.insertBefore(wrapper, input);
        } catch (_) {
          return;
        }
        wrapper.appendChild(input);
        const clearBtn = document.createElement("span");
        ((clearBtn.className = "clear-btn"),
          (clearBtn.innerHTML = "&times;"),
          wrapper.appendChild(clearBtn),
          input.addEventListener("input", () => {
            clearBtn.style.display = input.value ? "block" : "none";
          }),
          clearBtn.addEventListener("click", () => {
            ((input.value = ""), isMobileForInputs && input.focus());
          }));
      }));
  if (isMobileForInputs) {
    [
      "origen-calc",
      "destino-calc",
      "origen-vuelta-calc",
      "destino-vuelta-calc",
      "additional-trip-origen",
      "additional-trip-destino",
    ].forEach((id) => {
      const input = document.getElementById(id);
      if (!input) return;
      let handlingTouch = !1;
      input.addEventListener(
        "touchstart",
        function (e) {
          if (handlingTouch) return;
          const rect = input.getBoundingClientRect();
          if (rect.top <= 90) return;
          ((handlingTouch = !0), e.preventDefault());
          const startY = window.pageYOffset || window.scrollY || 0,
            targetY = rect.top + startY - 90;
          try {
            window.scrollTo({ top: targetY, behavior: "smooth" });
          } catch (err) {
            window.scrollTo(0, targetY);
          }
          setTimeout(() => {
            (input.focus(), (handlingTouch = !1));
          }, 220);
        },
        { passive: !1 },
      );
    });
  }
}),
  document.addEventListener("DOMContentLoaded", () => {
    const videoPlaceholder = document.querySelector(".video-placeholder");
    if (videoPlaceholder) {
      const videoId = videoPlaceholder.getAttribute("data-video-id"),
        wrapper = videoPlaceholder.parentElement;
      let videoTitle = "Our vehicle - Taxi Conil";
      try {
        if (
          window.__taxiI18n &&
          "function" == typeof window.__taxiI18n.getMessagesSection
        ) {
          const uiMsgs = window.__taxiI18n.getMessagesSection("ui");
          uiMsgs &&
            uiMsgs.vehicleVideoTitle &&
            (videoTitle = uiMsgs.vehicleVideoTitle);
        }
      } catch (e) {}
      const buildIframeSrc = (autoplay) =>
          `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=${autoplay ? 1 : 0}&rel=0&modestbranding=1&playsinline=1&showinfo=0&iv_load_policy=3`,
        createIframe = (autoplay) => {
          const iframe = document.createElement("iframe");
          return (
            (iframe.src = buildIframeSrc(autoplay)),
            (iframe.title = videoTitle),
            (iframe.loading = "lazy"),
            (iframe.referrerPolicy = "strict-origin-when-cross-origin"),
            (iframe.allow =
              "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"),
            (iframe.allowFullscreen = !0),
            iframe.classList.add("vehicle-video-iframe"),
            (iframe.dataset.autoplay = autoplay ? "1" : "0"),
            iframe
          );
        },
        ensureIframe = (autoplay) => {
          if (!videoId || !wrapper) return null;
          let iframe = wrapper.querySelector("iframe.vehicle-video-iframe");
          return (
            iframe
              ? autoplay &&
                "1" !== iframe.dataset.autoplay &&
                ((iframe.src = buildIframeSrc(!0)),
                (iframe.dataset.autoplay = "1"))
              : ((iframe = createIframe(autoplay)),
                wrapper.insertBefore(iframe, videoPlaceholder)),
            iframe
          );
        },
        revealIframe = (iframe) => {
          iframe &&
            requestAnimationFrame(() => {
              iframe.classList.add("video-iframe-visible");
            });
        },
        preloadVideoIframe = () => {
          videoId &&
            wrapper &&
            (wrapper.querySelector("iframe.vehicle-video-iframe") ||
              (ensureIframe(!1), (videoPlaceholder.dataset.preloaded = "1")));
        },
        loadVideoIframe = () => {
          if (!videoId || !wrapper) return;
          if (
            "1" === videoPlaceholder.dataset.played ||
            "1" === videoPlaceholder.dataset.loading
          )
            return;
          ((videoPlaceholder.dataset.loading = "1"),
            videoPlaceholder.classList.add("video-loading"),
            videoPlaceholder.classList.add("video-fade-out"),
            videoPlaceholder.setAttribute("aria-busy", "true"));
          const prefersReducedMotion =
              window.matchMedia &&
              window.matchMedia("(prefers-reduced-motion: reduce)").matches,
            isPreloaded = "1" === videoPlaceholder.dataset.preloaded,
            show = () => {
              const iframe = ensureIframe(!0);
              (revealIframe(iframe),
                (videoPlaceholder.dataset.played = "1"),
                videoPlaceholder.setAttribute("aria-busy", "false"));
              try {
                videoPlaceholder.remove();
              } catch (_) {
                videoPlaceholder.parentNode &&
                  videoPlaceholder.parentNode.removeChild(videoPlaceholder);
              }
            };
          prefersReducedMotion || isPreloaded ? show() : setTimeout(show, 200);
        };
      (videoPlaceholder.addEventListener("click", loadVideoIframe),
        videoPlaceholder.addEventListener("keydown", (event) => {
          ("Enter" !== event.key && " " !== event.key) ||
            (event.preventDefault(), loadVideoIframe());
        }));
      try {
        const preloadOnIntent = () => {
          try {
            preloadVideoIframe();
          } catch (_) {}
        };
        (videoPlaceholder.addEventListener("pointerenter", preloadOnIntent, {
          once: !0,
        }),
          videoPlaceholder.addEventListener("focus", preloadOnIntent, {
            once: !0,
          }));
      } catch (_) {}
    }
    const navbar = document.querySelector(".navbar"),
      navContainer = document.querySelector(".nav-container"),
      hamburger = document.querySelector(".hamburger");
    let tcNavHeightUpdateScheduled = !1;
    function scheduleNavHeightUpdate(delayMs) {
      try {
        if (tcNavHeightUpdateScheduled) return;
        tcNavHeightUpdateScheduled = !0;
        const run = () => {
          ((tcNavHeightUpdateScheduled = !1),
            (function () {
              try {
                const el =
                  navbar ||
                  (navContainer && navContainer.closest
                    ? navContainer.closest(".navbar")
                    : null);
                if (!el) return;
                const h = Math.max(
                  0,
                  Math.round(el.getBoundingClientRect().height || 0),
                );
                if (!h) return;
                document.documentElement.style.setProperty(
                  "--nav-height",
                  h + "px",
                );
              } catch (_) {}
            })());
        };
        if (delayMs && delayMs > 0)
          return void setTimeout(() => {
            try {
              requestAnimationFrame(run);
            } catch (_) {
              run();
            }
          }, delayMs);
        try {
          requestAnimationFrame(run);
        } catch (_) {
          run();
        }
      } catch (_) {
        tcNavHeightUpdateScheduled = !1;
      }
    }
    try {
      (scheduleNavHeightUpdate(),
        window.addEventListener("resize", () => scheduleNavHeightUpdate()),
        window.addEventListener("orientationchange", () =>
          scheduleNavHeightUpdate(),
        ));
    } catch (_) {}
    let tcNavbarScrollRafPending = !1;
    const tcHandleNavbarScroll = () => {
      if (((tcNavbarScrollRafPending = !1), !navbar)) return;
      const y = window.scrollY || 0;
      try {
        window.matchMedia && window.matchMedia("(min-width: 992px)").matches
          ? y > 80
            ? navbar.classList.add("nav-visible")
            : navbar.classList.remove("nav-visible")
          : navbar.classList.add("nav-visible");
      } catch (_) {
        navbar.classList.add("nav-visible");
      }
      y > 50
        ? navbar.classList.add("scrolled")
        : navbar.classList.remove("scrolled");
    };
    window.addEventListener(
      "scroll",
      () => {
        if (!tcNavbarScrollRafPending) {
          tcNavbarScrollRafPending = !0;
          try {
            requestAnimationFrame(tcHandleNavbarScroll);
          } catch (_) {
            tcHandleNavbarScroll();
          }
        }
      },
      { passive: !0 },
    );
    try {
      tcHandleNavbarScroll();
    } catch (_) {}
    (hamburger &&
      hamburger.addEventListener("click", () => {
        const expanded = "true" === hamburger.getAttribute("aria-expanded");
        (hamburger.setAttribute("aria-expanded", expanded ? "false" : "true"),
          hamburger.classList.toggle("active"),
          navContainer && navContainer.classList.toggle("active"));
        try {
          (scheduleNavHeightUpdate(), scheduleNavHeightUpdate(220));
        } catch (_) {}
      }),
      navContainer &&
        hamburger &&
        document.addEventListener("click", (event) => {
          const target = event.target;
          target &&
            (navContainer.contains(target) ||
              hamburger.contains(target) ||
              (navContainer.classList.contains("active") &&
                (navContainer.classList.remove("active"),
                hamburger.classList.remove("active"),
                hamburger.setAttribute("aria-expanded", "false"))));
        }),
      document
        .querySelectorAll(".nav-links a, .hero-buttons a, .nav-reservar-mobile")
        .forEach((link) => {
          link.addEventListener("click", () => {
            navContainer &&
              navContainer.classList.contains("active") &&
              (navContainer.classList.remove("active"),
              hamburger &&
                (hamburger.classList.remove("active"),
                hamburger.setAttribute("aria-expanded", "false")));
          });
        }),
      tcRunWhenIdle(() => {
        try {
          const revealSelector =
            "section h2, section p, section img, section .btn, .service-item, .review-card, .why-choose-us-text, .why-choose-us-text li, .why-choose-us-logo, .vehicle-content, #price-calculator-form, #booking-form, .form-row, .form-group";
          if ("IntersectionObserver" in window) {
            const revealObserver = new IntersectionObserver(
              (entries, obs) => {
                entries.forEach((entry) => {
                  entry.isIntersecting &&
                    (entry.target.classList.add("reveal-visible"),
                    obs.unobserve(entry.target));
                });
              },
              { threshold: 0.1 },
            );
            document.querySelectorAll(revealSelector).forEach((el) => {
              (el.classList.add("reveal-hidden"), revealObserver.observe(el));
            });
          } else
            document.querySelectorAll(revealSelector).forEach((el) => {
              el.classList.add("reveal-visible");
            });
        } catch (_) {}
      }, 2500));
  }),
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (e) {
      const href = this.getAttribute("href");
      if (!href || "#" === href) return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      const start = window.pageYOffset,
        navbar = document.querySelector(".navbar"),
        headerHeight = navbar ? navbar.offsetHeight : 0,
        baseOffset = headerHeight > 0 ? headerHeight + 12 : 90,
        end =
          target.getBoundingClientRect().top + window.pageYOffset - baseOffset,
        prefersReducedMotion =
          window.matchMedia &&
          window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        isMobileViewport = window.innerWidth <= 768,
        duration = prefersReducedMotion ? 0 : isMobileViewport ? 700 : 450;
      if (0 === duration) return void window.scrollTo(0, end);
      let startTime = null;
      requestAnimationFrame(function step(ts) {
        startTime || (startTime = ts);
        const elapsed = ts - startTime,
          eased = (function (t) {
            return 1 - Math.pow(1 - t, 3);
          })(Math.min(1, elapsed / duration));
        (window.scrollTo(0, start + (end - start) * eased),
          elapsed < duration && requestAnimationFrame(step));
      });
    });
  }),
  document.addEventListener("DOMContentLoaded", function () {
    try {
      if (!window.location || "file:" !== window.location.protocol) return;
      const langAttr =
        document.documentElement && document.documentElement.lang
          ? document.documentElement.lang.toLowerCase()
          : "";
      let home = "index.html";
      (langAttr.startsWith("en") && (home = "index-en.html"),
        langAttr.startsWith("de") && (home = "index-de.html"),
        langAttr.startsWith("fr") && (home = "index-fr.html"),
        document.querySelectorAll('a[href="/"]').forEach((link) => {
          !link.closest || !link.closest(".nav-flags, .nav-quick-flags")
            ? link.setAttribute("href", home)
            : link.setAttribute("href", "index.html");
        }),
        document.querySelectorAll('a[href^="/#"]').forEach((link) => {
          const href = link.getAttribute("href") || "";
          link.setAttribute("href", home + href.slice(1));
        }),
        document
          .querySelectorAll(
            'a[href="/en"], a[href^="/en#"], a[href="/de"], a[href^="/de#"], a[href="/fr"], a[href^="/fr#"], a[href="/index-en.html"], a[href^="/index-en.html#"], a[href="/index-de.html"], a[href^="/index-de.html#"], a[href="/index-fr.html"], a[href^="/index-fr.html#"]',
          )
          .forEach((link) => {
            const mapped = (function (href) {
              return href
                ? "/en" === href ||
                  href.startsWith("/en#") ||
                  "/index-en.html" === href ||
                  href.startsWith("/index-en.html#")
                  ? "/index-en.html" +
                    href.replace(/^\/((en)|(index-en\.html))/, "")
                  : "/de" === href ||
                      href.startsWith("/de#") ||
                      "/index-de.html" === href ||
                      href.startsWith("/index-de.html#")
                    ? "/index-de.html" +
                      href.replace(/^\/((de)|(index-de\.html))/, "")
                    : "/fr" === href ||
                        href.startsWith("/fr#") ||
                        "/index-fr.html" === href ||
                        href.startsWith("/index-fr.html#")
                      ? "/index-fr.html" +
                        href.replace(/^\/((fr)|(index-fr\.html))/, "")
                      : "/" === href || href.startsWith("/#")
                        ? home + href.slice(1)
                        : null
                : null;
            })(link.getAttribute("href") || "");
            mapped && link.setAttribute("href", mapped);
          }));
    } catch (_) {}
  }),
  document.addEventListener("DOMContentLoaded", function () {
    try {
      (tcEnsureMobileOnlyQuickIconsCSS(), tcFixFrenchFlagIcons(document));
      const hamburger = document.querySelector(".hamburger");
      hamburger &&
        hamburger.addEventListener(
          "click",
          function () {
            try {
              (setTimeout(function () {
                tcFixFrenchFlagIcons(document);
              }, 0),
                setTimeout(function () {
                  tcFixFrenchFlagIcons(document);
                }, 120));
            } catch (_) {}
          },
          { passive: !0 },
        );
    } catch (_) {}
  }),
  document.addEventListener("DOMContentLoaded", function () {
    const overlay = document.getElementById("legal-overlay"),
      inner = document.getElementById("legal-overlay-inner"),
      closeBtn = document.getElementById("legal-overlay-close");
    if (!overlay || !inner) return;
    let previousBodyOverflow = "",
      previousHtmlOverflow = "";
    const TC_LEGAL_PROSE_TARGETS = [
        "legal-condiciones",
        "legal-privacidad",
        "legal-aviso",
        "legal-cookies",
      ],
      TC_LEGAL_FAQ_TARGETS = ["legal-faq"],
      TC_LEGAL_PICKUP_TARGETS = ["airport-pickups"];
    function tcClearLegalOverlayModes() {
      try {
        (inner.classList.remove(
          "tc-legal-prose",
          "tc-legal-faq",
          "tc-legal-pickups",
        ),
          overlay.classList.remove(
            "tc-legal-prose-mode",
            "tc-legal-faq-mode",
            "tc-legal-pickups-mode",
          ));
      } catch (_) {}
    }
    function openOverlayWithHtml(html, targetId) {
      const wasVisible = overlay.classList.contains("visible");
      try {
        targetId
          ? overlay.setAttribute("data-overlay-target", targetId)
          : overlay.removeAttribute("data-overlay-target");
      } catch (_) {}
      ((inner.innerHTML = html),
        (function (targetId) {
          try {
            tcClearLegalOverlayModes();
            const tid = targetId ? String(targetId) : "";
            if (!tid) return;
            const prose = -1 !== TC_LEGAL_PROSE_TARGETS.indexOf(tid),
              faq = -1 !== TC_LEGAL_FAQ_TARGETS.indexOf(tid),
              pickup = -1 !== TC_LEGAL_PICKUP_TARGETS.indexOf(tid);
            (inner.classList.toggle("tc-legal-prose", prose),
              inner.classList.toggle("tc-legal-faq", faq),
              inner.classList.toggle("tc-legal-pickups", pickup),
              overlay.classList.toggle("tc-legal-prose-mode", prose),
              overlay.classList.toggle("tc-legal-faq-mode", faq),
              overlay.classList.toggle("tc-legal-pickups-mode", pickup));
          } catch (_) {}
        })(targetId),
        inner.querySelectorAll(".reveal-hidden").forEach((el) => {
          (el.classList.remove("reveal-hidden"),
            el.classList.add("reveal-visible"));
        }),
        wasVisible ||
          (overlay.classList.add("visible"),
          (previousBodyOverflow = document.body.style.overflow),
          (previousHtmlOverflow = document.documentElement.style.overflow),
          (document.body.style.overflow = "hidden"),
          (document.documentElement.style.overflow = "hidden")),
        (overlay.scrollTop = 0));
      const overlayContent = overlay.querySelector(".legal-overlay-content");
      (overlayContent && (overlayContent.scrollTop = 0), (inner.scrollTop = 0));
    }
    function getLegalOverlayErrorHtml() {
      try {
        const lang =
          document.documentElement && document.documentElement.lang
            ? document.documentElement.lang.toLowerCase()
            : "";
        if (lang.startsWith("en"))
          return "<p>We could not load the legal content.</p>";
        if (lang.startsWith("de"))
          return "<p>Der rechtliche Inhalt konnte nicht geladen werden.</p>";
      } catch (_) {}
      return "<p>No se pudo cargar el contenido legal.</p>";
    }
    function closeOverlay() {
      (overlay.classList.remove("visible"), (inner.innerHTML = ""));
      try {
        tcClearLegalOverlayModes();
      } catch (_) {}
      try {
        overlay.removeAttribute("data-overlay-target");
      } catch (_) {}
      ((document.body.style.overflow = previousBodyOverflow),
        (document.documentElement.style.overflow = previousHtmlOverflow));
    }
    (!(function () {
      try {
        if (document.querySelector('link[data-tc-legal-overlay-prose="1"]'))
          return;
        const l = document.createElement("link");
        ((l.rel = "stylesheet"),
          (l.href = "/css/legal-overlay-prose.css?v=20260513c"),
          l.setAttribute("data-tc-legal-overlay-prose", "1"),
          document.head.appendChild(l));
      } catch (_) {}
    })(),
      document.querySelectorAll(".legal-link").forEach((link) => {
        link.addEventListener("click", function (e) {
          const targetId = this.dataset.target,
            href = this.getAttribute("href") || "";
          if (!targetId) {
            const trimmedHref = String(href || "").trim(),
              isHashOnly =
                "#" === trimmedHref ||
                "" === trimmedHref ||
                trimmedHref.startsWith("#"),
              isTermsRoute = trimmedHref.startsWith("/terms");
            if (isTermsRoute && trimmedHref.includes("#")) return;
            if (!isHashOnly && !isTermsRoute) return;
          }
          const url = (function () {
            const lang =
              document.documentElement && document.documentElement.lang
                ? document.documentElement.lang.toLowerCase()
                : "";
            return lang.startsWith("de")
              ? "/terms-de"
              : lang.startsWith("en")
                ? "/terms-en"
                : lang.startsWith("fr")
                  ? "/terms-fr"
                  : "/terms";
          })();
          if (!window.location || "file:" !== window.location.protocol) {
            e.preventDefault();
            try {
              e.stopImmediatePropagation();
            } catch (_) {}
            !(function () {
              function fetchText(u) {
                return fetch(u, { credentials: "same-origin" }).then((res) => {
                  if (!res.ok) throw new Error("HTTP " + res.status);
                  return res.text();
                });
              }
              function tryParseAndOpen(html) {
                const doc = new DOMParser().parseFromString(html, "text/html"),
                  fetchedSection = targetId
                    ? doc.getElementById(targetId)
                    : null;
                return targetId
                  ? !!fetchedSection &&
                      (openOverlayWithHtml(fetchedSection.innerHTML, targetId),
                      !0)
                  : (openOverlayWithHtml(html, targetId), !0);
              }
              fetchText(url)
                .then((html) => {
                  if (tryParseAndOpen(html)) return;
                  return fetchText(
                    url.endsWith(".html") ? url : url + ".html",
                  ).then((html2) => {
                    tryParseAndOpen(html2) ||
                      openOverlayWithHtml(getLegalOverlayErrorHtml(), targetId);
                  });
                })
                .catch(() => {
                  fetchText(url.endsWith(".html") ? url : url + ".html")
                    .then((html2) => {
                      tryParseAndOpen(html2) ||
                        openOverlayWithHtml(
                          getLegalOverlayErrorHtml(),
                          targetId,
                        );
                    })
                    .catch(() => {
                      openOverlayWithHtml(getLegalOverlayErrorHtml(), targetId);
                    });
                });
            })();
          }
        });
      }),
      closeBtn &&
        closeBtn.addEventListener("click", function (e) {
          (e.stopPropagation(), closeOverlay());
        }),
      overlay.addEventListener("click", function (e) {
        e.target === overlay && closeOverlay();
      }),
      document.addEventListener("keydown", function (e) {
        "Escape" === e.key &&
          overlay.classList.contains("visible") &&
          closeOverlay();
      }));
  }),
  document.addEventListener("DOMContentLoaded", function () {
    try {
      if ("en" !== getPageLangCode()) return;
      const ariaMap = {
        "Ver ubicación en Google Maps": "View location on Google Maps",
        "Seguir Taxi Conil en Facebook": "Follow Taxi Conil on Facebook",
        "Seguir Taxi Conil en Instagram": "Follow Taxi Conil on Instagram",
      };
      document.querySelectorAll("[aria-label]").forEach((el) => {
        try {
          const current = el.getAttribute("aria-label");
          if (!current) return;
          const replacement = ariaMap[current];
          if (!replacement) return;
          el.setAttribute("aria-label", replacement);
        } catch (_) {}
      });
      const titleByLang = {
        es: "Spanish",
        en: "English",
        de: "German",
        fr: "French",
      };
      document
        .querySelectorAll(
          ".nav-flags a[title], .nav-quick-flags a[title], .lang-selector a[title], .article-hero-lang-selector a[title]",
        )
        .forEach((a) => {
          try {
            const linkLang = tcGetLangFromHref(a.getAttribute("href") || "");
            if (!linkLang) return;
            const replacement = titleByLang[linkLang];
            if (!replacement) return;
            a.setAttribute("title", replacement);
          } catch (_) {}
        });
    } catch (_) {}
  }),
  document.addEventListener("DOMContentLoaded", function () {
    try {
      if (
        "undefined" == typeof window ||
        !window.location ||
        !document ||
        !document.body
      )
        return;
      const path = String(window.location.pathname || "").toLowerCase();
      if (
        !(
          path.includes("/articulos/") ||
          path.includes("/articles/") ||
          path.includes("/artikel/")
        )
      )
        return;
      let btn = document.querySelector("a.floating-whatsapp"),
        styleEl = document.getElementById("tc-wa-float-style");
      if (
        (styleEl ||
          ((styleEl = document.createElement("style")),
          (styleEl.id = "tc-wa-float-style"),
          (styleEl.textContent =
            ".floating-whatsapp{position:fixed;right:24px;bottom:24px;width:60px;height:60px;border-radius:50%;background:#25d366;color:#fff;display:flex;align-items:center;justify-content:center;font-size:28px;box-shadow:0 4px 12px rgba(37,211,102,.4);z-index:2147483647;cursor:pointer;text-decoration:none;animation:tc-wa-bounce 2s infinite;visibility:visible;opacity:1}.floating-whatsapp:hover{animation:none;transform:scale(1.05);box-shadow:0 6px 20px rgba(37,211,102,.5)}@keyframes tc-wa-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}"),
          (document.head || document.body).appendChild(styleEl)),
        !btn)
      ) {
        ((btn = document.createElement("a")),
          (btn.href = "https://wa.me/34670705774"),
          (btn.target = "_blank"),
          (btn.rel = "noopener noreferrer"),
          (btn.className = "floating-whatsapp"),
          btn.setAttribute("aria-label", "WhatsApp"));
        const icon = document.createElement("i");
        ((icon.className = "fab fa-whatsapp"),
          icon.setAttribute("aria-hidden", "true"),
          btn.appendChild(icon),
          document.body.appendChild(btn));
      }
      ((btn.style.display = "flex"),
        (btn.style.visibility = "visible"),
        (btn.style.opacity = "1"),
        (btn.style.zIndex = "2147483647"));
    } catch (_) {}
  }));
