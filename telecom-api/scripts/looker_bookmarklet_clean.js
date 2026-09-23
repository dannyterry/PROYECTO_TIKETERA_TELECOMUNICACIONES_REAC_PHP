// Bookmarklet optimizado y robusto para Google Looker Studio
(function(){
  if (!location.hostname.includes("datastudio.google.com") && !location.hostname.includes("lookerstudio.google.com")) {
    alert("⚠️ Abre primero Google Looker Studio en la pestaña activa y haz clic aquí.");
    return;
  }

  function cleanDist(d) {
    var s = (d || "").replace(/\.{2,}/g, "").trim();
    var up = s.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (up.includes("VILLA MARIA") || up.includes("VMT")) return "Villa María del Triunfo";
    if (up.includes("CHORRILLOS")) return "Chorrillos";
    if (up.includes("SURCO") || up.includes("SANTIAGO")) return "Santiago de Surco";
    if (up.includes("SAN JUAN DE MIRA") || up.includes("SJM")) return "San Juan de Miraflores";
    if (up.includes("VILLA EL SAL") || up.includes("VES")) return "Villa El Salvador";
    if (up.includes("LURIN")) return "Lurín";
    if (up.includes("PACHACAMAC")) return "Pachacámac";
    if (up.includes("CERCADO") || up.includes("LIMA")) return "Cercado de Lima";
    if (up.includes("SAN MARTIN")) return "San Martín de Porres";
    if (up.includes("SAN MIGUEL")) return "San Miguel";
    if (up.includes("LA MOLINA")) return "La Molina";
    if (up.includes("LINCE")) return "Lince";
    if (up.includes("LURIGANCHO") || up.includes("SJL")) return "San Juan de Lurigancho";
    if (up.includes("PUEBLO LIBRE")) return "Pueblo Libre";
    if (up.includes("BRENA") || up.includes("BREÑA") || up.includes("BRES")) return "Breña";
    if (up.includes("PUNTA NEGRA")) return "Punta Negra";
    if (up.includes("SURQUILLO")) return "Surquillo";
    return s || "Zona Sur";
  }

  function sync() {
    try {
      var c = document.cookie || "";
      var xm = c.match(/RAP_XSRF_TOKEN=([^;]+)/);
      var x = xm ? xm[1] : "";
      var o = [];

      var fullText = document.body.innerText || "";
      var o = [];
      var secDefs = [
        { name: "AVERIAS PREFERENTE", tipo: "AVERIAS", prefix: "PREF-", key: "AVERIAS PREFERENTE" },
        { name: "AVERIAS ALTO VALOR", tipo: "AVERIAS ALTO VALOR", prefix: "ALTO-", key: "AVERIAS ALTO VALOR" },
        { name: "MOTOWIN ZONAS", tipo: "MOTOWIN", prefix: "MOTO-", key: "MOTOWIN ZONAS" }
      ];

      var foundSecs = [];
      for (var sIdx = 0; sIdx < secDefs.length; sIdx++) {
        var pos = fullText.indexOf(secDefs[sIdx].name);
        if (pos !== -1) foundSecs.push({ def: secDefs[sIdx], start: pos });
      }
      foundSecs.sort(function(a, b) { return a.start - b.start; });

      for (var i = 0; i < foundSecs.length; i++) {
        var cur = foundSecs[i];
        var startIdx = cur.start;
        var endIdx = (i + 1 < foundSecs.length) ? foundSecs[i + 1].start : fullText.length;
        var secText = fullText.substring(startIdx, endIdx);
        var lines = secText.split(/\r?\n/).map(function(l) { return l.trim(); }).filter(Boolean);
        var processedZones = {};

        for (var j = 0; j < lines.length; j++) {
          var line = lines[j];
          var lU = line.toUpperCase();
          if (lU.startsWith("SUBTOTAL") || lU.includes("TRAMO HORARIO") || lU.includes("RECORD COUNT") || (lU.includes("ZONA") && lU.includes("DISTRITO")) || lU === cur.def.name) continue;

          var zMatch = line.match(/\b(SUR\s*\d+|NORTE\s*\d+|ESTE\s*\d+|CENTRO\s*\d+|OESTE\s*\d+)\b/i);
          if (!zMatch) continue;

          var z = zMatch[1].toUpperCase().replace(/\s+/g, " ");
          if (processedZones[z]) continue;
          processedZones[z] = true;

          var afterZ = line.substring(line.indexOf(zMatch[0]) + zMatch[0].length).trim();
          var numMatch = afterZ.match(/(\d[\d\s]*)$/);
          var rawDist = afterZ;
          var cnt = 1;
          if (numMatch) {
            rawDist = afterZ.substring(0, afterZ.length - numMatch[0].length).trim();
            var nums = numMatch[0].trim().split(/\s+/).map(function(n) { return parseInt(n, 10); }).filter(function(n) { return !isNaN(n); });
            cnt = nums.length > 0 ? nums[nums.length - 1] : 1;
          }
          if (cnt <= 0 || isNaN(cnt)) cnt = 1;

          var dist = cleanDist(rawDist);
          var fj = "16:00-20:00";
          if (secText.includes("16:00")) fj = "16:00-20:00";
          else if (secText.includes("12:00")) fj = "12:00-15:59";
          else if (secText.includes("08:00")) fj = "08:00-11:59";

          for (var k = 0; k < cnt; k++) {
            o.push({
              ticket: cur.def.prefix + z.replace(/\s+/g, "") + (cnt > 1 ? ("-" + (k + 1)) : ""),
              distrito: dist,
              direccion: dist + " (" + z + ")",
              zona_nodo: z,
              franja_horaria: fj,
              motivo: cur.def.tipo + " CRM",
              vehiculo_tipo: cur.def.tipo,
              tarjeta: cur.def.key
            });
          }
        }
      }

      var prefCount = o.filter(function(ord) { return ord.tarjeta === "AVERIAS PREFERENTE"; }).length;
      var altoCount = o.filter(function(ord) { return ord.tarjeta === "AVERIAS ALTO VALOR"; }).length;
      var motoCount = o.filter(function(ord) { return ord.tarjeta === "MOTOWIN ZONAS"; }).length;
      var totCount = o.length;

      var surOrders = o.filter(function(ord) {
        var zU = (ord.zona_nodo || "").toUpperCase();
        var dU = (ord.distrito || "").toUpperCase();
        return zU.includes("SUR") || dU.includes("CHORRILLOS") || dU.includes("VILLA MARIA") || dU.includes("SURCO") || dU.includes("MIRAFLORES") || dU.includes("SALVADOR") || dU.includes("LURIN") || dU.includes("PACHACAMAC");
      });
      var sur = surOrders.length;

      var payloadObj = {
        url: location.href,
        cookie: c,
        x_rap_xsrf_token: x,
        domOrders: o,
        cardsSummary: { preferente: prefCount, altoValor: altoCount, motowin: motoCount, total: totCount },
        timestamp: new Date().toISOString()
      };
      var payloadStr = JSON.stringify(payloadObj);

      // 2. Envío simultáneo / redundante: Localhost + Hosting
      var endpoints = [
        "http://localhost:3000/api/looker/sync-browser",
        "https://api.corporacioncespedes.com/api/looker/sync-browser"
      ];

      endpoints.forEach(function(url) {
        // Intento 1: fetch POST con JSON
        try {
          fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payloadStr,
            mode: "cors"
          }).catch(function() {
            // Intento 2 (Fallback si hay bloqueo CORS): sendBeacon
            try {
              var blob = new Blob([payloadStr], { type: "application/json" });
              navigator.sendBeacon(url, blob);
            } catch(e) {}
          });
        } catch(e) {}
      });

      // Intento 3 (Fallback clásico Formulario oculto en iFrame)
      try {
        var ifr = document.getElementById("ces_ifr");
        if (!ifr) {
          ifr = document.createElement("iframe");
          ifr.id = "ces_ifr";
          ifr.name = "ces_ifr";
          ifr.style.display = "none";
          document.body.appendChild(ifr);
        }
        var f = document.createElement("form");
        f.method = "POST";
        f.action = "http://localhost:3000/api/looker/sync-browser";
        f.target = "ces_ifr";
        var inp = document.createElement("input");
        inp.type = "hidden";
        inp.name = "payload";
        inp.value = payloadStr;
        f.appendChild(inp);
        document.body.appendChild(f);
        f.submit();
        setTimeout(function() { f.remove(); }, 1500);
      } catch(e) {}

      return { sur: sur, tot: totCount, pref: prefCount, alto: altoCount, moto: motoCount };
    } catch (err) {
      console.error("Error en sync:", err);
      return null;
    }
  }

  function auto() {
    try {
      var btns = Array.from(document.querySelectorAll('button, div[role="button"]'));
      var rB = btns.find(function(b) { return (b.innerText || "").trim().toLowerCase() === "restablecer"; });
      if (rB) rB.click();
    } catch(e) {}

    setTimeout(function() {
      var res = sync();
      var badge = document.getElementById("ces_badge");
      if (!badge) {
        badge = document.createElement("div");
        badge.id = "ces_badge";
        badge.style.cssText = "position:fixed;top:16px;right:16px;z-index:999999999;background:#0f172a;color:#f8fafc;padding:12px 18px;border-radius:12px;font-family:system-ui,-apple-system,sans-serif;font-size:12px;box-shadow:0 10px 30px rgba(0,0,0,0.4);border:2px solid #38bdf8;font-weight:bold;line-height:1.4;";
        document.body.appendChild(badge);
      }

      if (res && res.tot !== null && res.tot !== undefined) {
        if (res.tot > 0) {
          var surTag = res.sur > 0 
            ? '<span style="color:#fecaca;background:rgba(220,38,38,0.5);padding:2px 7px;border-radius:6px;margin-left:4px;">🚨 Sur: ' + res.sur + '</span>'
            : '<span style="color:#bbf7d0;">Sur: 0</span>';

          badge.style.borderColor = "#10b981";
          badge.innerHTML = "✅ <b>Céspedes Sincronizado</b> (" + surTag + " | Total: " + res.tot + ")<br>" +
            "<span style='font-size:11px;font-weight:normal;color:#94a3b8;'>Pref: " + res.pref + " | Alto: " + res.alto + " | Moto: " + res.moto + "</span><br>" +
            "<span style='font-size:10px;font-weight:normal;color:#38bdf8;'>🔄 Auto-Sync cada 2.5 min</span>";
        } else {
          badge.style.borderColor = "#10b981";
          badge.innerHTML = "✅ <b>Céspedes Sincronizado</b> (0 Averías activas - Al día)<br>" +
            "<span style='font-size:10px;font-weight:normal;color:#38bdf8;'>🔄 Auto-Sync cada 2.5 min</span>";
        }
      } else {
        badge.style.borderColor = "#f59e0b";
        badge.innerHTML = "⚠️ <b>Looker Detectado</b> (Leyendo página...)<br><span style='font-size:10px;font-weight:normal;color:#cbd5e1;'>Reintentando en 10 seg...</span>";
      }
    }, 1500);
  }

  if (window._cesInt) clearInterval(window._cesInt);
  auto();
  window._cesInt = setInterval(auto, 150000);
})();
