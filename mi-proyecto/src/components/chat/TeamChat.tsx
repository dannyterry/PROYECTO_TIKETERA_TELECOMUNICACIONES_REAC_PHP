import React, { useState, useEffect, useRef } from "react";
import { API_URL } from "../../config/api";
import {
  MessageSquare,
  Send,
  X,
  Users,
  Radio,
  Minimize2,
  Maximize2,
  ChevronDown,
  Sparkles,
  Search,
  Lock,
  User,
} from "lucide-react";

interface ChatMessage {
  id_mensaje: number;
  id_emisor: number;
  emisor_nombre: string;
  emisor_rol: string | null;
  emisor_area: string | null;
  id_receptor: number | null;
  receptor_nombre: string | null;
  mensaje: string;
  fecha_envio: string;
}

interface OnlineUser {
  id_usuario: number;
  nombre_completo: string;
  rol_nombre: string;
  area: string;
  distrito?: string | null;
  distrito_conexion?: string | null;
  esta_online: number;
  ultimo_acceso: string | null;
}

interface TeamChatProps {
  userId?: string;
  userName?: string;
  userRol?: string;
  rolNombre?: string;
}

export const TeamChat: React.FC<TeamChatProps> = ({ userId, userName, userRol, rolNombre }) => {
  // 🔒 Permisos: Chat Grupal (Canal 24/7) solo para Administración (1), RRHH (5) y Almacén (3)
  // Gestión (4) puede chatear de forma INDIVIDUAL y directa con cualquier usuario 1 a 1.
  const canUseGroupChat =
    userRol === "1" ||
    userRol === "3" ||
    userRol === "5" ||
    (rolNombre &&
      (rolNombre.toUpperCase().includes("ADMIN") ||
       rolNombre.toUpperCase().includes("RECURSO") ||
       rolNombre.toUpperCase().includes("RRHH") ||
       rolNombre.toUpperCase().includes("ALMACEN") ||
       rolNombre.toUpperCase().includes("LOGISTICA")));

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  // Tab activo: 'general' o id del usuario para chat privado
  const [activeTab, setActiveTab] = useState<"general" | number>(() => (canUseGroupChat ? "general" : 0));
  const [targetUser, setTargetUser] = useState<OnlineUser | null>(null);

  const [usuariosOnline, setUsuariosOnline] = useState<OnlineUser[]>([]);
  const [mensajes, setMensajes] = useState<ChatMessage[]>([]);
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);

  // 🟢 Sistema de Mensajes No Leídos (Alerta Verde Resaltante)
  const [noLeidosPorUsuario, setNoLeidosPorUsuario] = useState<Record<number, number>>({});
  const [totalNoLeidos, setTotalNoLeidos] = useState<number>(0);
  const [ultimoEmisorNotificacion, setUltimoEmisorNotificacion] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Autoscroll
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 🛡️ Abrir chat con validación de auto-chat (Early return si es el mismo usuario logueado)
  const handleAbrirChat = (user: OnlineUser) => {
    if (!user || !user.id_usuario) return;
    const currentUid = userId || (typeof window !== "undefined" && window.self === window.top ? "59" : "");
    if (String(user.id_usuario) === String(currentUid)) return;

    setActiveTab(user.id_usuario);
    setTargetUser(user);
    setIsOpen(true);
    setIsMinimized(false);

    // Limpiar contador local de este usuario
    const cantNoLeidos = noLeidosPorUsuario[user.id_usuario] || 0;
    if (cantNoLeidos > 0) {
      setNoLeidosPorUsuario((prev) => {
        const next = { ...prev };
        delete next[user.id_usuario];
        return next;
      });
      setTotalNoLeidos((prev) => Math.max(0, prev - cantNoLeidos));
    }
  };

  // 1. Cargar usuarios online periódicamente (cada 15s)
  useEffect(() => {
    const fetchOnline = () => {
      if (document.hidden) return;
      fetch(`${API_URL}/api/auditoria/usuarios-online`)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setUsuariosOnline(data);
            if (!canUseGroupChat && !targetUser && data.length > 0) {
              const currentUid = userId || (typeof window !== "undefined" && window.self === window.top ? "59" : "");
              const otro = data.find((u) => String(u.id_usuario) !== String(currentUid));
              if (otro) {
                setTargetUser(otro);
                setActiveTab(otro.id_usuario);
              }
            }
          }
        })
        .catch(() => {});
    };
    fetchOnline();
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchOnline();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [canUseGroupChat, userId]);

  // 🔔 1.1 Polling continuo de mensajes no leídos (cada 30s con validación de visibilidad)
  useEffect(() => {
    const fetchNoLeidos = () => {
      if (document.hidden) return;
      const currentUid = userId || (typeof window !== "undefined" && window.self === window.top ? "59" : "");
      if (!currentUid) return;

      fetch(`${API_URL}/api/chat/noleidos?id_usuario=${currentUid}`)
        .then((r) => r.json())
        .then((data) => {
          if (data && typeof data.total === "number") {
            setTotalNoLeidos(data.total);
            setNoLeidosPorUsuario(data.por_usuario || {});
          }
        })
        .catch(() => {});
    };

    fetchNoLeidos();
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchNoLeidos();
      }
    }, 30000); // Consulta cada 30 segundos
    return () => clearInterval(interval);
  }, [userId]);

  // 2. Cargar mensajes del canal o chat privado activo (cada 5s si está abierto)
  useEffect(() => {
    if (!isOpen || isMinimized) return;
    if (!activeTab && activeTab !== 0) return;

    const fetchMensajes = () => {
      if (document.hidden) return;
      const conUsuarioParam = activeTab === "general" ? "general" : activeTab;
      if (conUsuarioParam === 0) return;

      const url = `${API_URL}/api/chat/mensajes?id_usuario=${userId || 0}&con_usuario=${conUsuarioParam}&limit=100`;

      fetch(url)
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setMensajes(data);
          }
        })
        .catch(() => {});
    };

    fetchMensajes();
    const interval = setInterval(() => {
      if (!document.hidden) {
        fetchMensajes();
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [isOpen, isMinimized, activeTab, userId]);

  useEffect(() => {
    scrollToBottom();
  }, [mensajes]);

  // 3. Enviar mensaje
  const handleEnviar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!nuevoMensaje.trim() || enviando) return;

    // Si es gestión y está en general, no permitir
    if (activeTab === "general" && !canUseGroupChat) {
      alert("El canal grupal general está reservado para Administración, RRHH y Almacén. Por favor selecciona un usuario para enviarle un mensaje directo.");
      return;
    }

    const msgTexto = nuevoMensaje.trim();
    setNuevoMensaje("");
    setEnviando(true);

    try {
      const payload = {
        id_emisor: userId ? Number(userId) : 0,
        emisor_nombre: userName || "Personal",
        emisor_rol: rolNombre || "Gestión",
        emisor_area: "Operaciones",
        id_receptor: activeTab === "general" ? null : (activeTab as number),
        receptor_nombre: targetUser ? targetUser.nombre_completo : null,
        mensaje: msgTexto,
      };

      const res = await fetch(`${API_URL}/api/chat/enviar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json());

      if (res.success) {
        // Optimistic UI push
        setMensajes((prev) => [
          ...prev,
          {
            id_mensaje: res.id_mensaje || Date.now(),
            id_emisor: Number(userId) || 0,
            emisor_nombre: userName || "Tú",
            emisor_rol: rolNombre || "Gestión",
            emisor_area: "Operaciones",
            id_receptor: activeTab === "general" ? null : (activeTab as number),
            receptor_nombre: targetUser ? targetUser.nombre_completo : null,
            mensaje: msgTexto,
            fecha_envio: new Date().toISOString(),
          },
        ]);
        scrollToBottom();
      }
    } catch (err) {
      console.error("Error al enviar mensaje:", err);
    } finally {
      setEnviando(false);
    }
  };

  const totalOnline = usuariosOnline.filter((u) => u.esta_online === 1).length;

  return (
    <>
      {/* ─────────────────────────────────────────────────────────────
          1. BARRA SUPERIOR DE PERSONAL ONLINE Y ACCESO A CHAT DIRECTO
      ───────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 w-full bg-slate-900/95 backdrop-blur-md border-b border-slate-700/60 px-4 py-2 flex items-center gap-2 shadow-md overflow-x-auto scrollbar-none">
        
        {/* Indicador de Conectados */}
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 shrink-0 pr-1">
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span className="text-white font-black">{totalOnline}</span> En línea:
        </span>

        {/* 📢 Botón Chat Grupal (Canal 24/7) - Solo para Admin, RRHH y Almacén, junto a los nombres */}
        {canUseGroupChat && (
          <button
            onClick={() => {
              setActiveTab("general");
              setTargetUser(null);
              setIsOpen(true);
              setIsMinimized(false);
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-xl font-black text-xs transition-all shrink-0 cursor-pointer shadow-xs border ${
              isOpen && activeTab === "general"
                ? "bg-indigo-600 text-white border-indigo-400 shadow-indigo-500/30"
                : "bg-gradient-to-r from-indigo-600/90 to-purple-600/90 hover:from-indigo-500 hover:to-purple-500 text-white border-indigo-500/40"
            }`}
            title="Abrir Canal Grupal 24/7 de Equipo"
          >
            <MessageSquare size={13} className="animate-bounce" />
            <span>Canal Grupal</span>
            <span className="bg-white/20 px-1.5 py-0.2 rounded-md text-[9px] font-mono">24/7</span>
          </button>
        )}

        {/* Avatares de Personal en Línea (Hacer clic abre el chat individual de una vez) */}
        {usuariosOnline.map((user) => {
          const isOnline = user.esta_online === 1;
          const isMe = String(user.id_usuario) === String(userId);
          const isCurrentActive = isOpen && activeTab === user.id_usuario;
          const cantNoLeidos = noLeidosPorUsuario[user.id_usuario] || 0;
          const hasUnread = cantNoLeidos > 0 && !isMe;

          return (
            <button
              key={user.id_usuario}
              onClick={() => {
                if (!isMe) {
                  handleAbrirChat(user);
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                hasUnread
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white font-black border-emerald-300 ring-4 ring-emerald-400/80 shadow-lg shadow-emerald-500/50 animate-bounce scale-105"
                  : isCurrentActive
                  ? "bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-600/30"
                  : isOnline
                  ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border-emerald-500/40 shadow-xs"
                  : "bg-slate-900/60 text-slate-400 border-slate-800 opacity-60"
              }`}
              title={
                hasUnread
                  ? `¡${user.nombre_completo} te envió ${cantNoLeidos} mensaje(s)! Haz clic para leer.`
                  : isMe
                  ? "Tu usuario (Conectado)"
                  : `Click para chatear en privado con ${user.nombre_completo}`
              }
            >
              <span className="relative flex h-2 w-2">
                {(isOnline || hasUnread) && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    hasUnread ? "bg-white" : isOnline ? "bg-emerald-500" : "bg-slate-500"
                  }`}
                ></span>
              </span>
              <span className="truncate max-w-[120px]">{user.nombre_completo.split(" ")[0]}</span>
              {hasUnread ? (
                <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white text-emerald-800 font-black shadow-xs animate-pulse">
                  📩 {cantNoLeidos} {cantNoLeidos === 1 ? "nuevo" : "nuevos"}
                </span>
              ) : (
                <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                  {user.rol_nombre || "Personal"}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. VENTANA FLOTANTE DE CHAT INTERACTIVO (SLACK / WHATSAPP STYLE)
      ───────────────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className={`fixed bottom-4 right-4 z-50 w-96 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-3xl shadow-2xl flex flex-col transition-all duration-300 ${
            isMinimized ? "h-14 overflow-hidden" : "h-[500px]"
          }`}
        >
          {/* Header del Chat */}
          <div className="flex items-center justify-between p-3.5 border-b border-slate-700/60 bg-slate-800/80 rounded-t-3xl">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-md">
                <MessageSquare size={16} />
              </div>
              <div>
                <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                  {activeTab === "general" ? "📢 Canal General de Equipo" : `💬 ${targetUser?.nombre_completo || "Chat Directo"}`}
                </h3>
                <p className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  {activeTab === "general" ? `${totalOnline} Conectados (Canal Grupal)` : `Mensaje Directo (${targetUser?.rol_nombre || "Personal"})`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-all cursor-pointer"
                title={isMinimized ? "Maximizar" : "Minimizar"}
              >
                {isMinimized ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-700 transition-all cursor-pointer"
                title="Cerrar"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Barra de pestañas (General vs Privado) */}
              <div className="flex items-center gap-1 p-2 bg-slate-950/60 border-b border-slate-800 text-xs overflow-x-auto scrollbar-none">
                {/* Pestaña General: Solo habilitada para Admin, RRHH y Almacén */}
                {canUseGroupChat && (
                  <button
                    onClick={() => {
                      setActiveTab("general");
                      setTargetUser(null);
                    }}
                    className={`px-3 py-1 rounded-xl font-bold text-xs transition-all cursor-pointer shrink-0 ${
                      activeTab === "general"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    }`}
                  >
                    📢 General
                  </button>
                )}

                {/* Si es Gestión o tiene chat individual activo */}
                {targetUser ? (
                  <button
                    onClick={() => setActiveTab(targetUser.id_usuario)}
                    className="px-3 py-1 rounded-xl font-bold text-xs bg-purple-600 text-white shadow-xs flex items-center gap-1 shrink-0"
                  >
                    <span>🔒 {targetUser.nombre_completo.split(" ")[0]}</span>
                    {canUseGroupChat && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTab("general");
                          setTargetUser(null);
                        }}
                        className="hover:text-red-300 ml-1 cursor-pointer font-black"
                      >
                        ×
                      </span>
                    )}
                  </button>
                ) : !canUseGroupChat && (
                  <span className="text-[11px] text-slate-400 font-bold px-2">Selecciona un usuario:</span>
                )}

                {/* Lista rápida de usuarios para chat 1 a 1 */}
                {!canUseGroupChat && (
                  <div className="flex items-center gap-1 ml-auto">
                    <select
                      value={targetUser?.id_usuario || ""}
                      onChange={(e) => {
                        const sel = usuariosOnline.find((u) => String(u.id_usuario) === e.target.value);
                        if (sel) {
                          handleAbrirChat(sel);
                        }
                      }}
                      className="bg-slate-800 text-white text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-700 focus:outline-none cursor-pointer"
                    >
                      {usuariosOnline
                        .filter((u) => String(u.id_usuario) !== String(userId))
                        .map((u) => (
                          <option key={u.id_usuario} value={u.id_usuario}>
                            {u.nombre_completo.split(" ")[0]} ({u.rol_nombre || "Personal"})
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Área de Mensajes */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2.5 text-xs">
                {mensajes.length === 0 ? (
                  <div className="py-16 text-center text-slate-500 text-xs space-y-1">
                    <Sparkles className="w-6 h-6 mx-auto text-indigo-400/50" />
                    <p>No hay mensajes en esta conversación.</p>
                    <p className="text-[10px] text-slate-600">
                      {activeTab === "general"
                        ? "¡Escribe en el canal grupal de equipo!"
                        : `¡Escribe un mensaje directo a ${targetUser?.nombre_completo || "este usuario"}!`}
                    </p>
                  </div>
                ) : (
                  mensajes.map((msg) => {
                    const isMe = String(msg.id_emisor) === String(userId) || msg.emisor_nombre === userName;
                    const hora = msg.fecha_envio
                        ? msg.fecha_envio.split("T")[1]?.substring(0, 5) || msg.fecha_envio.substring(11, 16)
                      : "";

                    return (
                      <div
                        key={msg.id_mensaje}
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"} space-y-0.5`}
                      >
                        {!isMe && (
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold px-1">
                            <span className="text-white font-black">{msg.emisor_nombre}</span>
                            {msg.emisor_rol && (
                              <span className="px-1 py-0.2 rounded bg-slate-800 text-indigo-300 font-mono text-[9px]">
                                {msg.emisor_rol}
                              </span>
                            )}
                          </div>
                        )}

                        <div
                          className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs break-words shadow-sm ${
                            isMe
                              ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-br-xs"
                              : "bg-slate-800 text-slate-200 border border-slate-700/60 rounded-bl-xs"
                          }`}
                        >
                          <p className="leading-relaxed">{msg.mensaje}</p>
                          <span
                            className={`block text-[9px] text-right mt-1 font-mono ${
                              isMe ? "text-indigo-200/80" : "text-slate-400"
                            }`}
                          >
                            {hora}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Caja de Entrada de Texto */}
              <form
                onSubmit={handleEnviar}
                className="p-2.5 bg-slate-800/80 border-t border-slate-700/60 flex items-center gap-2 rounded-b-3xl"
              >
                <input
                  type="text"
                  placeholder={
                    activeTab === "general"
                      ? "Mensaje al equipo..."
                      : `Mensaje a ${targetUser?.nombre_completo?.split(" ")[0] || "usuario"}...`
                  }
                  value={nuevoMensaje}
                  onChange={(e) => setNuevoMensaje(e.target.value)}
                  className="flex-1 bg-slate-900 text-white text-xs px-3.5 py-2 rounded-2xl border border-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                />

                <button
                  type="submit"
                  disabled={!nuevoMensaje.trim() || enviando}
                  className="p-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 active:scale-95 rounded-2xl text-white shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
                  title="Enviar mensaje (Enter)"
                >
                  <Send size={14} className={enviando ? "animate-spin" : ""} />
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          3. 🟢 ALERTA FLOTANTE VERDE RADIANTE (CUANDO ALGUIEN TE ESCRIBE)
      ───────────────────────────────────────────────────────────── */}
      {totalNoLeidos > 0 && (!isOpen || isMinimized) && (
        <div
          onClick={() => {
            const currentUid = userId || (typeof window !== "undefined" && window.self === window.top ? "59" : "");
            const primerEmisorId = Object.keys(noLeidosPorUsuario).find(
              (k) => (noLeidosPorUsuario[Number(k)] || 0) > 0 && String(k) !== String(currentUid)
            );
            if (primerEmisorId) {
              const u = usuariosOnline.find((usr) => usr.id_usuario === Number(primerEmisorId));
              if (u) {
                handleAbrirChat(u);
                return;
              }
            }
            setIsOpen(true);
            setIsMinimized(false);
          }}
          className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-emerald-500 via-green-500 to-emerald-600 hover:from-emerald-600 hover:to-green-700 text-white px-5 py-3.5 rounded-3xl shadow-2xl shadow-emerald-500/60 border-2 border-emerald-300 flex items-center gap-3.5 cursor-pointer animate-bounce ring-4 ring-emerald-400/70 transition-all select-none scale-105"
        >
          <div className="relative">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center border border-white/40">
              <MessageSquare className="w-5 h-5 text-white animate-pulse" />
            </div>
            <span className="absolute -top-1.5 -right-1.5 bg-white text-emerald-800 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md animate-ping">
              {totalNoLeidos}
            </span>
            <span className="absolute -top-1.5 -right-1.5 bg-white text-emerald-800 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-md">
              {totalNoLeidos}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white animate-ping"></span>
              <p className="text-xs font-black uppercase tracking-wider text-white">¡Tienes un nuevo mensaje!</p>
            </div>
            <p className="text-[11px] font-bold text-emerald-100 mt-0.5">
              {ultimoEmisorNotificacion ? `Mensaje de ${ultimoEmisorNotificacion}` : "Haz clic aquí para responder al instante"}
            </p>
          </div>
        </div>
      )}
    </>
  );
};
