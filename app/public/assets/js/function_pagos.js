// app/public/assets/js/function_pagos.js
// Reporte de pagos a técnicos: ingreso WIN, pago al técnico, material y ganancia.

$(document).ready(function () {
    "use strict";

    const url_resumen = "pagos/resumen";
    const url_detalle = "pagos/detalle";

    const $desde = $("#pago_desde");
    const $hasta = $("#pago_hasta");
    const $estado = $("#pago_estado");
    const $tabla = $("#tabla-pagos tbody");
    const $lblPeriodo = $("#pago_lbl_periodo");
    const $modal = $("#modalDetallePago");

    function hoy() {
        const d = new Date();
        return d.getFullYear() + "-" +
            String(d.getMonth() + 1).padStart(2, "0") + "-" +
            String(d.getDate()).padStart(2, "0");
    }

    function dinero(n) {
        return MONEDA + " " + Number(n || 0).toFixed(2);
    }

    function fechaEsp(f) {
        if (!f) return "";
        const p = String(f).split(" ")[0].split("-");
        return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : f;
    }

    function etiquetaPeriodo() {
        const d = $desde.val();
        const h = $hasta.val();
        if (d && h) return "Del " + fechaEsp(d) + " al " + fechaEsp(h);
        if (d) return "Desde " + fechaEsp(d);
        if (h) return "Hasta " + fechaEsp(h);
        return "Todo el historial";
    }

    function params() {
        return new URLSearchParams({
            desde: $desde.val() || "",
            hasta: $hasta.val() || "",
            estado: $estado.val() || ""
        });
    }

    function post(url, body) {
        return fetch(base_url + url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body
        }).then(function (r) { return r.json(); });
    }

    // ── Cargar resumen del periodo ────────────────────────────────────────
    function cargar() {
        const body = params();
        $tabla.html('<tr><td colspan="8" class="text-center text-muted py-4">Cargando...</td></tr>');

        post(url_resumen, body)
            .then(function (res) {
                if (!res || !res.success) {
                    alertError("No se pudo cargar la información.");
                    return;
                }
                renderTotales(res);
                renderTecnicos(res);
            })
            .catch(function () {
                alertError("No se pudo cargar la información.");
            });
    }

    function renderTotales(res) {
        const t = res.totales || {};
        $("#pago_sum_win").text(dinero(t.ingreso_win));
        $("#pago_sum_material").text(dinero(t.costo_material));
        $("#pago_sum_pago").text(dinero(t.pago_tecnicos));
        $("#pago_sum_ganancia").text(dinero(t.ganancia));
        $("#pago_sum_ordenes").text(t.num_ordenes || 0);
        $("#pago_sum_sin_precio").text(t.sin_precio || 0);
        $lblPeriodo.text(etiquetaPeriodo());
    }

    function renderTecnicos(res) {
        const tecnicos = res.tecnicos || [];

        if (!tecnicos.length) {
            $tabla.html('<tr><td colspan="8" class="text-center text-muted py-4">No hay órdenes finalizadas en el periodo.</td></tr>');
            return;
        }

        let rows = "";
        tecnicos.forEach(function (r) {
            rows += `
            <tr>
                <td class="fw-semibold">${r.tecnico}</td>
                <td>${r.num_ordenes}</td>
                <td>${r.sin_precio}</td>
                <td>${dinero(r.ingreso_win)}</td>
                <td>${dinero(r.costo_material)}</td>
                <td class="fw-semibold">${dinero(r.pago_tecnico)}</td>
                <td class="fw-semibold ${r.ganancia >= 0 ? "text-success" : "text-danger"}">${dinero(r.ganancia)}</td>
                <td>
                    <button class="btn btn-sm btn-info ver-detalle" data-id="${r.id_trabajador}">
                        <i class="mdi mdi-eye me-1"></i>Detalle
                    </button>
                </td>
            </tr>`;
        });

        $tabla.html(rows);
    }

    // ── Detalle por técnico ───────────────────────────────────────────────
    $tabla.on("click", ".ver-detalle", function () {
        const id = $(this).data("id");

        post(url_detalle + "/" + id, params())
            .then(function (res) {
                if (!res || !res.success) {
                    alertError("No se pudo cargar el detalle.");
                    return;
                }
                renderDetalle(res);
                $modal.modal("show");
            })
            .catch(function () {
                alertError("No se pudo cargar el detalle.");
            });
    });

    function renderDetalle(res) {
        const t = res.totales || {};

        $("#pago_detalle_titulo").text("Detalle de pagos — " + res.tecnico);

        let html = `
        <div class="row g-3 mb-3">
            <div class="col-md-3">
                <div class="card bg-primary-lighten mb-0"><div class="card-body py-2">
                    <small class="text-muted d-block">Ingreso WIN</small>
                    <span class="fw-bold">${dinero(t.ingreso_win)}</span>
                </div></div>
            </div>
            <div class="col-md-3">
                <div class="card bg-warning-lighten mb-0"><div class="card-body py-2">
                    <small class="text-muted d-block">Costo material</small>
                    <span class="fw-bold">${dinero(t.costo_material)}</span>
                </div></div>
            </div>
            <div class="col-md-3">
                <div class="card bg-danger-lighten mb-0"><div class="card-body py-2">
                    <small class="text-muted d-block">Pago al técnico</small>
                    <span class="fw-bold">${dinero(t.pago_tecnicos)}</span>
                </div></div>
            </div>
            <div class="col-md-3">
                <div class="card bg-success-lighten mb-0"><div class="card-body py-2">
                    <small class="text-muted d-block">Ganancia</small>
                    <span class="fw-bold ${t.ganancia >= 0 ? "text-success" : "text-danger"}">${dinero(t.ganancia)}</span>
                </div></div>
            </div>
        </div>
        <div class="table-responsive">
            <table class="table table-sm table-striped table-bordered mb-0">
                <thead>
                    <tr>
                        <th>N° Ticket</th>
                        <th>Fecha Visita</th>
                        <th>Tipo Trabajo</th>
                        <th>Motivo</th>
                        <th class="text-end">Ingreso WIN</th>
                        <th class="text-end">Pago Técnico</th>
                        <th class="text-end">Material</th>
                        <th class="text-end">Ganancia</th>
                    </tr>
                </thead>
                <tbody>`;

        (res.ordenes || []).forEach(function (o) {
            html += `
            <tr>
                <td>${o.numero || "—"}</td>
                <td>${fechaEsp(o.fecha_visita)}</td>
                <td>${o.tipo_trabajo || '<span class="text-muted">—</span>'}</td>
                <td>${o.motivo || '<span class="text-muted">—</span>'}</td>
                <td class="text-end">${dinero(o.precio_win)}</td>
                <td class="text-end">${dinero(o.pago_tecnico)}</td>
                <td class="text-end">${dinero(o.costo_material)}</td>
                <td class="text-end ${o.ganancia >= 0 ? "text-success" : "text-danger"}">${dinero(o.ganancia)}</td>
            </tr>`;
        });

        if (!(res.ordenes || []).length) {
            html += '<tr><td colspan="8" class="text-center text-muted">Sin órdenes en el periodo.</td></tr>';
        }

        html += `</tbody></table></div>`;

        $("#pago_detalle_body").html(html);
    }

    // ── Exportar a Excel (CSV) ────────────────────────────────────────────
    $("#pago_btn_excel").on("click", function () {
        const filas = [];
        filas.push(["REPORTE DE PAGOS A TÉCNICOS"]);
        filas.push(["Periodo", $lblPeriodo.text()]);
        filas.push([]);

        const cabeceras = [];
        $("#tabla-pagos thead th").each(function () {
            cabeceras.push($(this).text().trim());
        });
        filas.push(cabeceras);

        $("#tabla-pagos tbody tr").each(function () {
            const fila = [];
            $(this).find("td").each(function () {
                fila.push($(this).text().trim());
            });
            if (fila.length) filas.push(fila);
        });

        const csv = filas.map(function (f) {
            return f.map(function (c) {
                return '"' + String(c).replace(/"/g, '""') + '"';
            }).join(";");
        }).join("\n");

        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "pagos_tecnicos.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // ── Eventos ───────────────────────────────────────────────────────────
    $("#pago_btn_hoy").on("click", function () {
        const h = hoy();
        $desde.val(h);
        $hasta.val(h);
        cargar();
    });
    $("#pago_btn_consultar").on("click", cargar);
    $desde.on("change", cargar);
    $hasta.on("change", cargar);
    $estado.on("change", cargar);

    // ── Carga inicial: HOY ────────────────────────────────────────────────
    cargar();
});
