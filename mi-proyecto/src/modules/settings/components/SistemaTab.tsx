import React, { useState, useEffect } from "react";
import {
  Sliders,
  Check,
  RotateCw,
  Eye,
  EyeOff,
  Building,
  KeyRound,
  Coins,
  Globe,
  AlertCircle,
} from "lucide-react";
import {
  ConfigItem,
  getConfiguracionSistema,
  saveConfiguracionSistema,
} from "../services/settingsService";
import { API_URL } from "../../../config/api";

export const SistemaTab: React.FC = () => {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [conectarGoogleLoading, setConectarGoogleLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [mostrarPassword, setMostrarPassword] = useState(false);

  // Valores de formulario
  const [nameEmpresa, setNameEmpresa] = useState("Cespedes");
  const [moneda, setMoneda] = useState("S/");
  const [trUser, setTrUser] = useState("");
  const [trPassword, setTrPassword] = useState("");
  const [trCodSus, setTrCodSus] = useState("");

  const cargarDatos = async () => {
    try {
      setLoading(true);
      const data = await getConfiguracionSistema();
      setConfigs(data || []);

      const map = new Map(data.map((c) => [c.clave, c.valor]));
      if (map.has("NAME_EMPRESA")) setNameEmpresa(map.get("NAME_EMPRESA") || "");
      if (map.has("MONEDA")) setMoneda(map.get("MONEDA") || "S/");
      if (map.has("TR_USER")) setTrUser(map.get("TR_USER") || "");
      if (map.has("TR_PASSWORD")) setTrPassword(map.get("TR_PASSWORD") || "");
      if (map.has("TR_COD_SUS")) setTrCodSus(map.get("TR_COD_SUS") || "");
    } catch (err: any) {
      console.error("Error al cargar configuración:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg("");
      setSuccessMsg("");

      await saveConfiguracionSistema({
        NAME_EMPRESA: nameEmpresa.trim(),
        MONEDA: moneda.trim(),
        TR_USER: trUser.trim(),
        TR_PASSWORD: trPassword.trim(),
        TR_COD_SUS: trCodSus.trim(),
      });

      setSuccessMsg("¡Configuración del sistema guardada con éxito!");
      setTimeout(() => setSuccessMsg(""), 3500);
      cargarDatos();
    } catch (err: any) {
      setErrorMsg(err.message || "Error al guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  const [lookerEstado, setLookerEstado] = useState<{
    activo: boolean;
    totalGeneral: number;
    totalAlertasSur: number;
    ultimaSincronizacion: string | null;
    appVersion: string;
  }>({
    activo: false,
    totalGeneral: 0,
    totalAlertasSur: 0,
    ultimaSincronizacion: null,
    appVersion: "20260823_0000",
  });
  const [loadingLooker, setLoadingLooker] = useState(false);
  const [copiadoBookmarklet, setCopiadoBookmarklet] = useState(false);
  const [modalManualAbierto, setModalManualAbierto] = useState(false);
  const [cookieManual, setCookieManual] = useState("");
  const [guardandoManual, setGuardandoManual] = useState(false);

  const cargarEstadoLooker = async () => {
    try {
      setLoadingLooker(true);
      const res = await fetch(`${API_URL}/api/looker/estado-sesion`);
      const data = await res.json();
      if (data.success) {
        setLookerEstado({
          activo: Boolean(data.activo),
          totalGeneral: data.totalGeneral || 0,
          totalAlertasSur: data.totalAlertasSur || 0,
          ultimaSincronizacion: data.ultimaSincronizacion || null,
          appVersion: data.appVersion || "20260823_0000",
        });
      }
    } catch (e) {
      console.error("Error al cargar estado de Looker:", e);
    } finally {
      setLoadingLooker(false);
    }
  };

  useEffect(() => {
    cargarEstadoLooker();
  }, []);

  const bookmarkletCode = `javascript:(function(){if(!location.hostname.includes("datastudio.google.com")&&!location.hostname.includes("lookerstudio.google.com")){alert("⚠️ Abre primero Google Looker Studio y haz clic aquí.");return;}function sync(){try{var c=document.cookie||"", xm=c.match(/RAP_XSRF_TOKEN=([^;]+)/), x=xm?xm[1]:"";var t=document.body.innerText||"";var pM=t.match(/AVER[IÍ]AS\\s*PREFERENTE[^\\d]*(\\d+)/i), pC=pM?parseInt(pM[1],10):0;var aM=t.match(/AVER[IÍ]AS\\s*ALTO\\s*VALOR[^\\d]*(\\d+)/i), aC=aM?parseInt(aM[1],10):0;var mM=t.match(/MOTOWIN\\s*ZONAS?[^\\d]*(\\d+)/i), mC=mM?parseInt(mM[1],10):0;var o=[];var rows=document.querySelectorAll('div[role="row"],tr,.lego-table-row');rows.forEach(function(r){var txt=(r.innerText||"").trim();var m=txt.match(/(AT-\\d+|VTEXT-\\d+|VT-\\d+|WN-\\d+|CPEXT-\\d+)/i);var cells=Array.from(r.children).map(function(cl){return (cl.innerText||"").trim();}).filter(Boolean);if(m&&cells.length>=2&&!txt.includes("Ticket")){o.push({ticket:m[1],distrito:cells[1]||"",direccion:cells[2]||"",zona_nodo:cells[3]||"",franja_horaria:cells[4]||"",motivo:cells[5]||"",vehiculo_tipo:cells[6]||""});}else if(cells.length>=2&&!txt.toUpperCase().includes("SUBTOTAL")&&!txt.toUpperCase().includes("ZONA")){var z=cells[0]||"", d=cells[1]||"", zU=z.toUpperCase();if(zU.includes("SUR")||zU.includes("NORTE")||zU.includes("ESTE")||zU.includes("CENTRO")){var cnt=parseInt(cells[cells.length-1],10)||1, fj=cells.length>=4?cells[2]:"16:00-20:00";for(var i=0;i<cnt;i++){o.push({ticket:"MOTOWIN-"+z.replace(/\\s+/g,"")+(cnt>1?("-"+(i+1)):""),distrito:d,direccion:d+" ("+z+")",zona_nodo:z,franja_horaria:fj,motivo:"MOTOWIN CRM",vehiculo_tipo:"MOTOWIN"});}}}});var sur=o.filter(function(ord){return (ord.zona_nodo||ord.distrito||"").toUpperCase().includes("SUR");}).length;var payload=JSON.stringify({url:location.href,cookie:c,x_rap_xsrf_token:x,domOrders:o,cardsSummary:{preferente:pC,altoValor:aC,motowin:mC,total:pC+aC+mC},timestamp:new Date().toISOString()});var ifr=document.getElementById("ces_ifr");if(!ifr){ifr=document.createElement("iframe");ifr.id="ces_ifr";ifr.name="ces_ifr";ifr.style.display="none";document.body.appendChild(ifr);}var f=document.createElement("form");f.method="POST";f.action="${API_URL}/api/looker/sync-browser";f.target="ces_ifr";var inp=document.createElement("input");inp.type="hidden";inp.name="payload";inp.value=payload;f.appendChild(inp);document.body.appendChild(f);f.submit();setTimeout(function(){f.remove();},2000);return {sur:sur,tot:pC+aC+mC};}catch(err){return null;}}function auto(){try{var btns=Array.from(document.querySelectorAll('button,div[role="button"]'));var rB=btns.find(function(b){return (b.innerText||"").trim().toLowerCase()==="restablecer";});if(rB)rB.click();}catch(e){}setTimeout(function(){var res=sync();if(res){var badge=document.getElementById("ces_badge");if(!badge){badge=document.createElement("div");badge.id="ces_badge";badge.style.cssText="position:fixed;top:16px;right:16px;z-index:999999999;background:rgb(6,78,59);color:rgb(236,253,245);padding:12px 18px;border-radius:12px;font-family:sans-serif;font-size:13px;box-shadow:0 8px 30px rgba(0,0,0,0.3);border:2px solid rgb(16,185,129);font-weight:bold;";document.body.appendChild(badge);}badge.innerHTML="✅ Sincronizado Céspedes (Sur: "+res.sur+" órdenes)<br><span style='font-size:11px;font-weight:normal;color:rgb(167,243,208);'>Auto-Sync activo cada 2.5 min</span>";}},2000);}if(window._cesInt)clearInterval(window._cesInt);auto();window._cesInt=setInterval(auto,150000);})();`;

  const handleCopiarBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletCode);
    setCopiadoBookmarklet(true);
    setTimeout(() => setCopiadoBookmarklet(false), 2500);
  };

  const handleGuardarManual = async () => {
    if (!cookieManual.trim()) return;
    try {
      setGuardandoManual(true);
      const res = await fetch(`${API_URL}/api/looker/sync-browser`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookie: cookieManual.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message || "¡Sesión guardada exitosamente!");
        setTimeout(() => setSuccessMsg(""), 3500);
        setModalManualAbierto(false);
        setCookieManual("");
        cargarEstadoLooker();
      } else {
        alert("Error: " + (data.error || "No se pudo guardar la sesión"));
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setGuardandoManual(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6 font-sans">
      <form onSubmit={handleGuardar} className="space-y-6">
        {successMsg && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl flex items-center gap-2 text-xs font-bold animate-fade-in">
            <Check size={18} className="text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-2xl flex items-center gap-2 text-xs font-bold animate-fade-in">
            <AlertCircle size={18} className="text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. Información General */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Building size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Parámetros de la Empresa</h3>
              <p className="text-xs text-slate-500">Datos generales de cabecera y moneda para comprobantes</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nombre de la Empresa / Razón Comercial
              </label>
              <input
                type="text"
                value={nameEmpresa}
                onChange={(e) => setNameEmpresa(e.target.value)}
                placeholder="ej. Céspedes Telecomunicaciones"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Símbolo de Moneda
              </label>
              <input
                type="text"
                value={moneda}
                onChange={(e) => setMoneda(e.target.value)}
                placeholder="S/ o $"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* 2. Conexión WIN & Credenciales */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Globe size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">Credenciales del Servicio WIN (Tiempo Real)</h3>
              <p className="text-xs text-slate-500">Acceso a la plataforma de averías e importación de órdenes</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Usuario WIN
              </label>
              <input
                type="text"
                value={trUser}
                onChange={(e) => setTrUser(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Contraseña WIN
              </label>
              <div className="relative">
                <input
                  type={mostrarPassword ? "text" : "password"}
                  value={trPassword}
                  onChange={(e) => setTrPassword(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {mostrarPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Código de Suscriptor
              </label>
              <input
                type="text"
                value={trCodSus}
                onChange={(e) => setTrCodSus(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* 3. Conexión Looker Studio (Marcador Inteligente 1 Clic - Compatible con Servidor Linux) */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <Globe size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-slate-900">Looker Studio / Google Analytics</h3>
                  {lookerEstado.activo ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Sesión Vinculada
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      Sin sesión vinculada
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Conexión segura y continua para alimentar las tarjetas y alertas de averías del módulo de Órdenes.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={cargarEstadoLooker}
                disabled={loadingLooker}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                title="Actualizar estado de conexión"
              >
                <RotateCw size={15} className={loadingLooker ? "animate-spin text-indigo-600" : ""} />
              </button>
              <button
                type="button"
                onClick={() => setModalManualAbierto(true)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Ingreso Manual
              </button>
            </div>
          </div>

          {/* Estado Informativo */}
          {lookerEstado.ultimaSincronizacion && (
            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="text-slate-600">
                Última sincronización: <strong className="text-slate-800 font-mono">{new Date(lookerEstado.ultimaSincronizacion).toLocaleString("es-PE")}</strong>
              </div>
              <div className="flex items-center gap-4 text-xs font-bold text-slate-700">
                <span>Versión: <strong className="font-mono text-slate-900">{lookerEstado.appVersion}</strong></span>
                {lookerEstado.totalGeneral > 0 && (
                  <span className="text-indigo-600">{lookerEstado.totalGeneral} averías detectadas</span>
                )}
              </div>
            </div>
          )}

          {/* Tarjeta Marcador 1-Clic */}
          <div className="bg-gradient-to-br from-indigo-50/70 via-sky-50/50 to-white rounded-2xl p-5 border border-indigo-100 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-black text-indigo-950">
                  ⚡ Auto-Sincronizador Continuo de Looker Studio
                </h4>
                <p className="text-xs text-indigo-900/80 mt-0.5">
                  Con 1 solo clic en la pestaña de Looker, activa el robot flotante que refresca Google y actualiza Céspedes en automático cada 2.5 minutos.
                </p>
              </div>

              {/* BOTÓN ARRASTRABLE DEL MARCADOR */}
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={bookmarkletCode}
                  onClick={(e) => {
                    e.preventDefault();
                    alert("👉 Arrastra este botón con tu ratón hasta la barra de marcadores de tu navegador Chrome (debajo de la barra de direcciones).");
                  }}
                  draggable
                  title="Arrastra este enlace a tu barra de marcadores de Chrome"
                  className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md shadow-indigo-600/25 transition-all cursor-grab active:cursor-grabbing"
                >
                  <span>⚡ Sincronizar Looker Céspedes</span>
                </a>

                <button
                  type="button"
                  onClick={handleCopiarBookmarklet}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    copiadoBookmarklet
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                  title="Copiar código del marcador al portapapeles"
                >
                  {copiadoBookmarklet ? (
                    <>
                      <Check size={14} />
                      <span>¡Copiado!</span>
                    </>
                  ) : (
                    <span>Copiar Código</span>
                  )}
                </button>
              </div>
            </div>

            {/* Pasos visuales súper claros */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="bg-white/80 rounded-xl p-3 border border-indigo-100/80">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-black inline-flex items-center justify-center mb-1.5">1</span>
                <p className="font-extrabold text-slate-800">Arrastra a Marcadores</p>
                <p className="text-slate-500 text-[11px] mt-0.5">Arrastra el botón azul a tu barra de favoritos de Chrome (sustituyendo el anterior).</p>
              </div>

              <div className="bg-white/80 rounded-xl p-3 border border-indigo-100/80">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-black inline-flex items-center justify-center mb-1.5">2</span>
                <p className="font-extrabold text-slate-800">Abre Looker Studio</p>
                <p className="text-slate-500 text-[11px] mt-0.5">En tu pestaña de Google Looker con tu cuenta abierta.</p>
              </div>

              <div className="bg-white/80 rounded-xl p-3 border border-indigo-100/80">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-black inline-flex items-center justify-center mb-1.5">3</span>
                <p className="font-extrabold text-slate-800">1 Clic y queda Automático</p>
                <p className="text-slate-500 text-[11px] mt-0.5">Verás un recuadro verde flotante que refresca Google y envía las órdenes del Sur en automático.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Botón Guardar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
          >
            {saving ? <RotateCw className="animate-spin" size={16} /> : <Check size={16} />}
            <span>Guardar Configuración</span>
          </button>
        </div>
      </form>

      {/* Modal de Ingreso Manual de Sesión / Cookies */}
      {modalManualAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-black text-slate-900">Ingreso Manual de Sesión Looker</h3>
              <button
                type="button"
                onClick={() => setModalManualAbierto(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Pega la cadena de cookies completa o el token extraído de tu navegador Google Chrome para guardar la sesión directamente en el servidor.
            </p>

            <textarea
              rows={5}
              value={cookieManual}
              onChange={(e) => setCookieManual(e.target.value)}
              placeholder="Pega aquí la cookie (ej: RAP_XSRF_TOKEN=...; SID=...; ...)"
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 focus:outline-none focus:border-indigo-500"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalManualAbierto(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleGuardarManual}
                disabled={guardandoManual || !cookieManual.trim()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all disabled:opacity-50"
              >
                {guardandoManual ? "Guardando..." : "Guardar y Vincular"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
