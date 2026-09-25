// ==UserScript==
// @name         Sincronizador Automático Looker Studio - Corporación Céspedes
// @namespace    https://corporacioncespedes.com/
// @version      1.0
// @description  Extrae órdenes en tiempo real de Looker Studio y las sincroniza automáticamente cada 30 segundos con la API corporativa.
// @author       Corporación Céspedes
// @match        https://lookerstudio.google.com/*
// @match        https://datastudio.google.com/*
// @grant        GM_xmlhttpRequest
// @connect      api.corporacioncespedes.com
// @connect      localhost
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const API_URL = 'https://api.corporacioncespedes.com/api/looker/sincronizar-directo';
    const API_KEY = 'CESPEDES_SEC_2026_KEY';
    const INTERVALO_SYNC_MS = 30000; // Cada 30 segundos
    const RETRASO_INICIAL_MS = 5000;  // 5s para que renderice Looker

    // Lista de distritos del Cono Sur para normalización y alertas
    const DISTRITOS_SUR = [
        'CHORRILLOS', 'VILLA EL SALVADOR', 'VILLA MARIA DEL TRIUNFO', 'LURIN',
        'SAN JUAN DE MIRAFLORES', 'SANTIAGO DE SURCO', 'SURCO', 'PACHACAMAC',
        'SAN BARTOLO', 'PUNTA HERMOSA', 'PUNTA NEGRA', 'PUCUSANA', 'SANTA MARIA DEL MAR'
    ];

    // --- 🎨 1. CREAR BADGE FLOTANTE DE ESTADO (UI MODERNA) ---
    function crearBadgeUI() {
        if (document.getElementById('cespedes-sync-badge')) return;

        const badge = document.createElement('div');
        badge.id = 'cespedes-sync-badge';
        badge.style.cssText = `
            position: fixed;
            top: 14px;
            right: 180px;
            z-index: 999999;
            background: rgba(15, 23, 42, 0.92);
            color: #ffffff;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.15);
            border-radius: 10px;
            padding: 8px 14px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            gap: 10px;
            user-select: none;
            transition: all 0.3s ease;
        `;

        badge.innerHTML = `
            <div id="cespedes-status-dot" style="width: 10px; height: 10px; border-radius: 50%; background: #eab308; box-shadow: 0 0 8px #eab308; animation: pulse 1.5s infinite;"></div>
            <div>
                <div style="font-weight: 700; color: #38bdf8; font-size: 11px; letter-spacing: 0.5px;">SYNC CÉSPEDES</div>
                <div id="cespedes-status-text" style="font-size: 11px; color: #cbd5e1;">Iniciando (esperando 5s)...</div>
            </div>
            <div id="cespedes-badge-counts" style="display: none; border-left: 1px solid rgba(255,255,255,0.2); padding-left: 8px; margin-left: 4px; font-size: 11px;">
                <div>📦 <span id="cespedes-total-ord" style="font-weight: 700; color: #4ade80;">0</span> ord</div>
                <div>🚨 Sur: <span id="cespedes-sur-ord" style="font-weight: 700; color: #f87171;">0</span></div>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0% { opacity: 1; transform: scale(1); }
                50% { opacity: 0.4; transform: scale(0.9); }
                100% { opacity: 1; transform: scale(1); }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(badge);
    }

    function actualizarBadge(estado, mensaje, counts = null) {
        const dot = document.getElementById('cespedes-status-dot');
        const text = document.getElementById('cespedes-status-text');
        const countsBox = document.getElementById('cespedes-badge-counts');
        const totalSpan = document.getElementById('cespedes-total-ord');
        const surSpan = document.getElementById('cespedes-sur-ord');

        if (!dot || !text) return;

        text.textContent = mensaje;

        if (estado === 'loading') {
            dot.style.background = '#eab308';
            dot.style.boxShadow = '0 0 8px #eab308';
        } else if (estado === 'success') {
            dot.style.background = '#22c55e';
            dot.style.boxShadow = '0 0 8px #22c55e';
        } else if (estado === 'error') {
            dot.style.background = '#ef4444';
            dot.style.boxShadow = '0 0 8px #ef4444';
        }

        if (counts && countsBox && totalSpan && surSpan) {
            countsBox.style.display = 'block';
            totalSpan.textContent = counts.total || 0;
            surSpan.textContent = counts.sur || 0;
        }
    }

    // --- 🔍 2. EXTRACCIÓN Y PARSING DEL DOM DE LOOKER STUDIO ---
    function extraerDatosLooker() {
        const fullText = document.body.innerText || "";
        const lines = fullText.split("\n").map(l => l.trim()).filter(Boolean);

        const orders = [];
        let tarjetaActual = 'AVERIAS PREFERENTE';
        let preferenteCount = 0;
        let altoValorCount = 0;
        let motowinCount = 0;
        let surCount = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // Detectar cabecera de tarjeta según la sección activa
            if (line.includes('AVERIAS PREFERENTE') || line.includes('PREFERENTE')) {
                tarjetaActual = 'AVERIAS PREFERENTE';
            } else if (line.includes('AVERIAS ALTO VALOR') || line.includes('ALTO VALOR')) {
                tarjetaActual = 'AVERIAS ALTO VALOR';
            } else if (line.includes('MOTOWIN') || line.includes('MOTO WIN')) {
                tarjetaActual = 'MOTOWIN ZONAS';
            }

            // Detección de Tickets numéricos o alfanuméricos de órdenes (ej: 3468676 o TIK-12345)
            const ticketMatch = line.match(/\b(3\d{6}|\d{7,8})\b/);
            if (ticketMatch) {
                const ticket = ticketMatch[1];
                
                // Mapeo de campos adyacentes dentro del bloque de texto
                const distrito = lines[i + 1] || '';
                const direccion = lines[i + 2] || '';
                const zona_nodo = lines[i + 3] || '';
                const franja_horaria = lines[i + 4] || '';
                const motivo = lines[i + 5] || '';

                const dUpper = distrito.toUpperCase();
                const zUpper = zona_nodo.toUpperCase();
                const esSur = zUpper.includes('SUR') || DISTRITOS_SUR.some(d => dUpper.includes(d) || zUpper.includes(d));

                if (esSur) surCount++;

                if (tarjetaActual === 'AVERIAS PREFERENTE') preferenteCount++;
                else if (tarjetaActual === 'AVERIAS ALTO VALOR') altoValorCount++;
                else if (tarjetaActual === 'MOTOWIN ZONAS') motowinCount++;

                orders.push({
                    ticket,
                    distrito,
                    direccion,
                    zona_nodo,
                    franja_horaria,
                    motivo,
                    vehiculo_tipo: tarjetaActual === 'MOTOWIN ZONAS' ? 'MOTO' : 'AUTO',
                    tarjeta: tarjetaActual,
                    es_sur: esSur
                });
            }
        }

        return {
            domOrders: orders,
            cardsSummary: {
                preferente: preferenteCount,
                altoValor: altoValorCount,
                motowin: motowinCount,
                total: orders.length,
                sur: surCount
            }
        };
    }

    // --- 🚀 3. ENVÍO DE DATOS MEDIANTE GM_xmlhttpRequest (SIN BLOQUEO CORS) ---
    function enviarDatosAlBackend(payload) {
        actualizarBadge('loading', 'Sincronizando...');

        GM_xmlhttpRequest({
            method: 'POST',
            url: API_URL,
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': API_KEY
            },
            data: JSON.stringify(payload),
            onload: function(response) {
                try {
                    const res = JSON.parse(response.responseText);
                    if (res.success) {
                        const timeStr = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                        actualizarBadge('success', `Sync OK (${timeStr})`, {
                            total: payload.cardsSummary.total,
                            sur: payload.cardsSummary.sur
                        });
                    } else {
                        actualizarBadge('error', res.message || 'Error en servidor');
                    }
                } catch (e) {
                    actualizarBadge('error', 'Error parseando respuesta');
                }
            },
            onerror: function(err) {
                console.error('Error enviando datos:', err);
                actualizarBadge('error', 'Error de red / API caída');
            }
        });
    }

    // --- ⏱️ 4. INICIALIZACIÓN Y BUCLE DE EJECUCIÓN ---
    function ejecutarSincronizacion() {
        const payload = extraerDatosLooker();
        if (payload.domOrders.length > 0) {
            enviarDatosAlBackend(payload);
        } else {
            actualizarBadge('loading', 'Buscando tablas...');
        }
    }

    window.addEventListener('load', () => {
        crearBadgeUI();
        setTimeout(() => {
            ejecutarSincronizacion();
            setInterval(ejecutarSincronizacion, INTERVALO_SYNC_MS);
        }, RETRASO_INICIAL_MS);
    });
})();
