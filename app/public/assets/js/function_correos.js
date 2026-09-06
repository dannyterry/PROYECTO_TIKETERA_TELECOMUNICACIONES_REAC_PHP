// app/public/assets/js/function_correos.js
// Módulo de envío de correos: config SMTP + reportes PDF a técnicos.

$(document).ready(function () {
    "use strict";

    const $mes        = $("#correo_mes");
    const $tbody      = $("#correo_tbody_tecnicos");
    const $cardRes    = $("#correo_card_resultado");
    const $resultado  = $("#correo_resultado");
    const $lblEstado  = $("#correo_lbl_estado");

    function post(url, body) {
        return fetch(base_url + url, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body
        }).then(function (r) { return r.json(); });
    }

    function tecnicosSeleccionados() {
        const ids = [];
        $tbody.find(".correo_ck:checked").each(function () {
            ids.push($(this).val());
        });
        return ids;
    }

    function mostrarResultado(res) {
        if (!res) return;

        if (!res.success && !res.resultado) {
            alertError(res.mensaje || "No se pudo completar la operación.");
            return;
        }

        let filas = "";
        (res.resultado || []).forEach(function (r) {
            const ok = r.estado === "ok";
            filas += `
            <tr>
                <td>${r.tecnico}</td>
                <td>${r.email}</td>
                <td class="text-center">${r.ordenes}</td>
                <td>
                    <span class="badge ${ok ? "bg-success" : "bg-danger"}">${ok ? "Enviado" : "Error"}</span>
                </td>
                <td class="text-muted small">${r.mensaje}</td>
            </tr>`;
        });

        const total = (res.enviados || 0) + (res.fallidos || 0);
        $resultado.html(`
            <div class="mb-2">
                <span class="badge bg-light text-dark border me-1">Período: ${res.periodo || ""}</span>
                <span class="badge bg-success me-1">Enviados: ${res.enviados || 0}</span>
                <span class="badge bg-danger">Fallidos: ${res.fallidos || 0}</span>
            </div>
            <div class="table-responsive">
                <table class="table table-sm table-hover mb-0">
                    <thead class="table-light">
                        <tr>
                            <th>Técnico</th>
                            <th>Correo</th>
                            <th class="text-center">Órdenes</th>
                            <th>Estado</th>
                            <th>Detalle</th>
                        </tr>
                    </thead>
                    <tbody>${filas || '<tr><td colspan="5" class="text-center text-muted">Sin datos</td></tr>'}</tbody>
                </table>
            </div>`);
        $cardRes.removeClass("d-none");

        if (res.enviados > 0 && res.fallidos === 0) {
            alertCorrecto("Correos enviados (" + total + " técnico(s)).", 2000);
        } else if (res.fallidos > 0) {
            alertError("Hubo " + res.fallidos + " fallo(s) al enviar.");
        }
    }

    function actualizarLinksPreview() {
        const mes = $mes.val() || new Date().toISOString().slice(0, 7);
        $tbody.find("a").each(function () {
            const href = $(this).attr("href") || "";
            const tipo = href.indexOf("tipo=m") !== -1 ? "m" : "d";
            const id = (href.match(/id=(\d+)/) || [])[1];
            const nuevo = base_url + "correos/previsualizar?id=" + id + "&tipo=" + tipo + "&mes=" + mes;
            $(this).attr("href", nuevo);
        });
    }

    // ── Guardar configuración SMTP ────────────────────────────────────────
    $("#correo_btn_guardar_config").on("click", function () {
        const claves = [];
        const valores = [];
        $("[data-clave]").each(function () {
            claves.push($(this).data("clave"));
            valores.push($(this).val() || "");
        });

        const body = new URLSearchParams();
        claves.forEach(function (c, i) {
            body.append("clave[]", c);
            body.append("valor[]", valores[i]);
        });

        alertActualizar("Guardando configuración...");

        post("correos/guardar_config", body)
            .then(function (res) {
                if (res && res.success) {
                    Swal.close();
                    alertCorrecto(res.mensaje || "Configuración guardada.");
                } else {
                    Swal.close();
                    alertError(res.mensaje || "No se pudo guardar.");
                }
            })
            .catch(function () {
                Swal.close();
                alertError("Error de conexión al guardar.");
            });
    });

    // ── Mostrar/ocultar clave ─────────────────────────────────────────────
    $("#correo_btn_ver_clave").on("click", function () {
        const input = $("#cfg_EMAIL_PASSWORD");
        const tipo = input.attr("type") === "password" ? "text" : "password";
        input.attr("type", tipo);
        $(this).find("i").toggleClass("mdi-eye-outline mdi-eye-off-outline");
    });

    // ── Enviar correo de prueba ───────────────────────────────────────────
    $("#correo_btn_prueba").on("click", function () {
        const email = $("#cfg_EMAIL_PRUEBA").val().trim();
        if (!email) {
            alertWarning("Ingresa un correo de prueba en la configuración.");
            return;
        }
        alertActualizar("Enviando correo de prueba...");
        post("correos/enviar_prueba", new URLSearchParams({ email: email }))
            .then(function (res) {
                Swal.close();
                if (res && res.success) {
                    alertCorrecto(res.mensaje || "Correo de prueba enviado.");
                    $lblEstado.removeClass("text-muted bg-light border").addClass("bg-success text-white").text("Configuración verificada");
                } else {
                    alertError(res.mensaje || "No se pudo enviar la prueba.");
                    $lblEstado.removeClass("text-muted bg-light border").addClass("bg-danger text-white").text("Error de envío");
                }
            })
            .catch(function () {
                Swal.close();
                alertError("Error de conexión al enviar la prueba.");
            });
    });

    // ── Envío de reportes ─────────────────────────────────────────────────
    function mostrarProgresoEnvio(titulo) {
        Swal.fire({
            title: titulo,
            html: `
                <div class="text-start">
                    <p id="correo_progreso_mensaje" class="mb-2 text-muted small">Preparando envío...</p>
                    <div class="progress" style="height: 18px;">
                        <div id="correo_progreso_barra"
                            class="progress-bar progress-bar-striped progress-bar-animated"
                            role="progressbar"
                            style="width: 0%">0%</div>
                    </div>
                </div>
            `,
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            heightAuto: false
        });
    }

    // Consulta el avance real del envío en el backend y actualiza la barra
    function consultarProgresoEnvio() {
        $.ajax({
            url: base_url + "correos/progreso_envio",
            type: "GET",
            dataType: "json",
            success: function (progreso) {
                const barra = document.getElementById("correo_progreso_barra");
                const mensaje = document.getElementById("correo_progreso_mensaje");
                if (!barra || !mensaje) return;

                const total = progreso.total || 0;
                const actual = progreso.actual || 0;
                const porcentaje = total > 0 ? Math.min(100, Math.round((actual / total) * 100)) : 0;

                barra.style.width = porcentaje + "%";
                barra.textContent = porcentaje + "%";
                if (progreso.mensaje) {
                    mensaje.textContent = progreso.mensaje;
                }
            }
        });
    }

    function enviar(url, body, titulo) {
        const ids = tecnicosSeleccionados();
        if (!ids.length) {
            alertWarning("Selecciona al menos un técnico para enviar.");
            return;
        }
        ids.forEach(function (id) { body.append("tecnicos[]", id); });

        mostrarProgresoEnvio(titulo);
        const intervalo = setInterval(consultarProgresoEnvio, 1200);

        post(url, body)
            .then(function (res) {
                clearInterval(intervalo);
                Swal.close();
                mostrarResultado(res);
            })
            .catch(function () {
                clearInterval(intervalo);
                Swal.close();
                alertError("Error de conexión al enviar.");
            });
    }

    $("#correo_btn_diario").on("click", function () {
        enviar("correos/enviar_diario", new URLSearchParams(), "Enviando reporte DIARIO...");
    });

    $("#correo_btn_mensual").on("click", function () {
        enviar("correos/enviar_mensual", new URLSearchParams({ mes: $mes.val() || "" }), "Enviando reporte MENSUAL...");
    });

    // ── Seleccionar todos / ninguno ───────────────────────────────────────
    $("#correo_check_todos").on("change", function () {
        $tbody.find(".correo_ck").prop("checked", $(this).is(":checked"));
    });
    $("#correo_btn_todos").on("click", function () {
        const total = $tbody.find(".correo_ck").length;
        const marcados = $tbody.find(".correo_ck:checked").length;
        const nuevo = !(total > 0 && marcados === total);
        $tbody.find(".correo_ck").prop("checked", nuevo);
        $("#correo_check_todos").prop("checked", nuevo);
    });
    $tbody.on("change", ".correo_ck", function () {
        const total = $tbody.find(".correo_ck").length;
        const marcados = $tbody.find(".correo_ck:checked").length;
        $("#correo_check_todos").prop("checked", total > 0 && marcados === total);
    });

    // ── Actualizar mes en los links de preview ────────────────────────────
    $mes.on("change", actualizarLinksPreview);
});
