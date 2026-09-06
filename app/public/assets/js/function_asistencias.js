// app/public/assets/js/function_asistencias.js
// Visualización de asistencias por tarjetas, filtro por fecha (por defecto hoy).
// SOLO LECTURA: las asistencias se generan automáticamente desde la FOTO DOMICILIO
// de las órdenes; no se permite crear, editar ni eliminar manualmente.

$(document).ready(function () {
    "use strict";

    const url_listar = "recursos_humanos/asistencias/listar";

    const $fecha = $("#filtro_fecha");
    const $contenedor = $("#contenedor-asistencias");
    const $lblFecha = $("#lbl_fecha_mostrada");
    const $btnHoy = $("#btn_hoy");
    const $btnConsultar = $("#btn_consultar");

    // ── Utilidades ────────────────────────────────────────────────────────
    function fechaEsp(fecha) {
        if (!fecha) return "";
        const p = String(fecha).split(" ")[0].split("-");
        return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : fecha;
    }

    function horaCorta(h) {
        if (!h || h === "00:00:00" || h === "00:00") return "—";
        return String(h).substring(0, 5);
    }

    function iniciales(nombre, apellido) {
        return ((nombre ? nombre[0] : "") + (apellido ? apellido[0] : "")).toUpperCase() || "?";
    }

    function colorAvatar(estado) {
        const map = {
            "Asistio": "bg-success",
            "Tardanza": "bg-warning",
            "Falta": "bg-danger"
        };
        return map[estado] || "bg-secondary";
    }

    function badgeTipo(tipo) {
        const esAuto = String(tipo).toLowerCase() === "automatico";
        return esAuto
            ? '<span class="badge bg-info-lighten text-info border">Automática</span>'
            : '<span class="badge bg-secondary-lighten text-secondary border">Manual</span>';
    }

    // ── Cargar asistencias de la fecha seleccionada ───────────────────────
    function cargarAsistencias(fecha) {
        const f = fecha || $fecha.val() || "";
        $contenedor.html(
            '<div class="col-12 text-center text-muted py-5">' +
            '<i class="mdi mdi-loading mdi-spin font-24"></i>' +
            '<p class="mt-2 mb-0">Cargando asistencias...</p></div>'
        );

        fetch(base_url + url_listar, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ fecha: f })
        })
            .then(function (r) { return r.json(); })
            .then(function (res) {
                const data = (res && res.data) || [];
                renderResumen(data);
                renderTarjetas(data);
                $lblFecha.text(fechaEsp(res.fecha || f));
            })
            .catch(function () {
                $contenedor.html(
                    '<div class="col-12 text-center text-muted py-5">' +
                    '<p class="mb-0">No se pudo cargar la información.</p></div>'
                );
            });
    }

    // ── Resumen ───────────────────────────────────────────────────────────
    function renderResumen(data) {
        let total = 0, asistio = 0, tardanza = 0, falta = 0;
        data.forEach(function (r) {
            total++;
            if (r.estado === "Asistio") asistio++;
            else if (r.estado === "Tardanza") tardanza++;
            else if (r.estado === "Falta") falta++;
        });
        $("#sum_total").text(total);
        $("#sum_asistio").text(asistio);
        $("#sum_tardanza").text(tardanza);
        $("#sum_falta").text(falta);
    }

    // ── Tarjetas ──────────────────────────────────────────────────────────
    function renderTarjetas(data) {
        if (!data.length) {
            $contenedor.html(
                '<div class="col-12 text-center text-muted py-5">' +
                '<i class="mdi mdi-calendar-remove font-28"></i>' +
                '<p class="mt-2 mb-0">No hay asistencias registradas para esta fecha.</p></div>'
            );
            return;
        }

        let html = "";
        data.forEach(function (row) {
            const nombre = row.nombre_trabajador || "";
            const apellido = row.apellido_trabajador || "";

            const observacion = row.observacion
                ? `<div class="small text-muted text-truncate mt-2" title="${row.observacion}">
                       <i class="mdi mdi-comment-text-outline me-1"></i>${row.observacion}
                   </div>`
                : "";

            html += `
            <div class="col-xl-3 col-md-6">
                <div class="card border shadow-sm mb-0 h-100">
                    <div class="card-body">
                        <div class="d-flex align-items-center gap-3">
                            <div class="avatar rounded-circle ${colorAvatar(row.estado)} text-white d-flex align-items-center justify-content-center fw-bold" style="width:46px;height:46px;font-size:1.1rem;">
                                ${iniciales(nombre, apellido)}
                            </div>
                            <div class="min-w-0">
                                <h6 class="mb-0 text-truncate" style="max-width:180px;">${nombre} ${apellido}</h6>
                                <small class="text-muted">${row.rol_trabajador || "Técnico"}</small>
                            </div>
                            <div class="ms-auto">
                                ${renderEstadoAsistencia(row.estado)}
                            </div>
                        </div>

                        <hr class="my-3">

                        <div class="row text-center">
                            <div class="col-4">
                                <div class="text-muted small text-uppercase">Programada</div>
                                <div class="fw-semibold">${horaCorta(row.hora_programada)}</div>
                            </div>
                            <div class="col-4">
                                <div class="text-muted small text-uppercase">Entrada</div>
                                <div class="fw-semibold ${row.estado === "Tardanza" ? "text-warning" : ""}">${horaCorta(row.hora_entrada)}</div>
                            </div>
                            <div class="col-4">
                                <div class="text-muted small text-uppercase">Min. tarde</div>
                                <div class="fw-semibold ${row.minutos_tarde > 0 ? "text-warning" : ""}">${row.minutos_tarde || 0}</div>
                            </div>
                        </div>

                        ${observacion}

                        <div class="mt-3">
                            ${badgeTipo(row.tipo)}
                        </div>
                    </div>
                </div>
            </div>`;
        });

        $contenedor.html(html);
    }

    // ── Eventos de filtro ─────────────────────────────────────────────────
    $fecha.on("change", function () {
        cargarAsistencias($(this).val());
    });
    $btnConsultar.on("click", function () {
        cargarAsistencias($fecha.val());
    });
    $btnHoy.on("click", function () {
        const hoy = new Date();
        const hoyStr = hoy.getFullYear() + "-" +
            String(hoy.getMonth() + 1).padStart(2, "0") + "-" +
            String(hoy.getDate()).padStart(2, "0");
        $fecha.val(hoyStr);
        cargarAsistencias(hoyStr);
    });

    // ── Carga inicial: HOY ────────────────────────────────────────────────
    cargarAsistencias($fecha.val());
});
