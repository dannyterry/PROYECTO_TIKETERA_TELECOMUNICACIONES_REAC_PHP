'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { upload } = require('../middleware/upload');
const { requireAuth, signToken } = require('../middleware/requireAuth');
const { uploadFileToS3, uploadBufferToS3, getS3ObjectStream, checkS3ObjectExists, getS3SignedUrl } = require('../services/s3Service');
const path = require('path');
const fs = require('fs');


// ─── RUTAS MÓDULO: EMPLEADOS ───────────────────────────────────────

router.get(['/empleados', '/'], async (req, res) => {
  try {
    if (cacheEmpleados.data && Date.now() - cacheEmpleados.timestamp < 10000) {
      return res.json(cacheEmpleados.data);
    }

    // APLICAMOS UN LEFT JOIN PARA TRAER EL NOMBRE DEL ROL
    const [usuarios] = await pool.query(`
      SELECT u.*, r.nombre AS nombre_rol 
      FROM usuarios u 
      LEFT JOIN roles r ON u.id_rol = r.id_rol 
      ORDER BY u.id_usuario DESC
    `);
    
    const [hijos] = await pool.query(`SELECT * FROM usuario_hijos`);
    const usuariosConHijos = usuarios.map((user) => {
      const { password, ...safeUser } = user;
      return {
        ...safeUser,
        password: user.password_plano || user.documento || "123456",
        hijos: hijos.filter((h) => h.id_usuario === user.id_usuario),
      };
    });
    
    cacheEmpleados = { data: usuariosConHijos, timestamp: Date.now() };
    res.json(usuariosConHijos);
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

router.post(['/empleados', '/'], upload, async (req, res) => {
  const connection = await pool.getConnection(); 
  try {
    await connection.beginTransaction(); 
    const d = req.body;
    const dateOrNull = (val) => (val && val !== "") ? val : null;
    let cn = null, ca1 = null, ca2 = null, cfn = null;

    if (d.derechohabientes) {
      try {
        const f = JSON.parse(d.derechohabientes);
        if (f.esposa) { cn = f.esposa.nombres || null; ca1 = f.esposa.primerApellido || null; ca2 = f.esposa.segundoApellido || null; cfn = dateOrNull(f.esposa.nacimiento); }
      } catch(e) {}
    }

    // ATRAPAMOS LOS ARCHIVOS DE MULTER
    const getFile = (field) => req.files && req.files[field] ? req.files[field][0].filename : null;
    const foto = getFile('foto_personal');
    const docDelantera = getFile('doc_delantera');
    const docTrasera = getFile('doc_trasera');
    const breveteDelantera = getFile('brevete_delantera');
    const breveteTrasera = getFile('brevete_trasera');
    const revTecFrontal = getFile('revision_tecnica_frontal');
    const revTecPosterior = getFile('revision_tecnica_posterior');
    const tarjPropFrontal = getFile('tarjeta_propiedad_frontal');
    const tarjPropPosterior = getFile('tarjeta_propiedad_posterior');
    const reciboPdf = getFile('recibo_servicio_pdf');
    const cv = getFile('cv_pdf');
    const certPdf = getFile('certificado_pdf');
    const otroDoc = getFile('otro_documento_pdf');
    const dniPdf = getFile('dni_pdf') || docDelantera;
    const licenciaPdf = getFile('licencia_pdf') || breveteDelantera;

    const emailOrNull = (val) => (val && typeof val === 'string' && val.trim() !== "") ? val.trim() : null;

    const passPlano = (d.password && d.password.trim() !== "") ? d.password.trim() : (d.dni ? String(d.dni).trim() : "123456");
    const passHash = await hashPassword(passPlano);

    const [r] = await connection.query(`
      INSERT INTO usuarios (
        id_rol, tipo_documento, documento, ruc, sunat_estado, sunat_condicion, sunat_actividad, nombres, apellidos, primer_apellido, segundo_apellido, email, usuario, password, password_plano, estado, telefono, fecha_ingreso, fecha_nacimiento, sexo, estado_civil, pais_nacimiento, direccion, distrito, sueldo, numero_emergencia, banco, cuenta_bancaria, cci, area, tipo_servicio, opcion_personal, subcontrata_codigo, cuadrilla, regimen_pensionario, tipo_comision_afp, cuspp, vencimiento_sctr, vencimiento_emo, categoria_licencia, numero_brevete, emision_brevete, fecha_vencimiento_brevete, numero_revision_tecnica, emision_revision_tecnica, vencimiento_revision_tecnica, numero_soat, emision_soat, vencimiento_soat, talla_polo, talla_pantalon, talla_calzado, ultimo_empleo_1, ultimo_empleo_2, ultimo_empleo_3, emergencia_nombre, emergencia_parentesco, emergencia_telefono_2, emergencia_direccion, conyuge_nombres, conyuge_apellido1, conyuge_apellido2, conyuge_fecha_nacimiento,
        foto_personal, doc_delantera, doc_trasera, brevete_delantera, brevete_trasera, revision_tecnica_frontal, revision_tecnica_posterior, tarjeta_propiedad_frontal, tarjeta_propiedad_posterior, recibo_servicio_pdf, cv_pdf, certificado_pdf, otro_documento_pdf, dni_pdf, licencia_pdf
      ) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      d.id_rol || null, d.tipoDocumento || "DNI", d.dni || "", d.ruc || "", d.estadoContribuyente || "", d.condicionContribuyente || "", d.actividadEconomica || "",
      d.nombres || "", d.apellidos || `${d.primerApellido || ""} ${d.segundoApellido || ""}`.trim(), d.primerApellido || "", d.segundoApellido || "", emailOrNull(d.correo), d.usuario || "", passHash, passPlano,
      d.estado || "Activo", d.telefono || "", dateOrNull(d.fechaIngreso), dateOrNull(d.fechaNacimiento), d.sexo || null, d.estadoCivil || null, d.paisNacimiento || "Perú", d.direccion || "", d.distrito || "",d.sueldo || null,
      d.telefonoEmergencia || "", d.banco || "", d.cuenta || "", d.cci || "", d.area || "", d.tipo_servicio || null, d.opcionPersonal || "", d.subcontrata_codigo || d.subcontrataCodigo || null, d.cuadrilla || "",
      d.regimenPensionario || "", d.tipoComision || "", d.cuspp || "", dateOrNull(d.sctrVencimiento), dateOrNull(d.emoVencimiento),
      d.licencia || "Sin Licencia", d.numeroBrevete || "", dateOrNull(d.fechaEmisionLicencia), dateOrNull(d.fechaVencimientoLicencia),
      d.numeroRevisionTecnica || d.numero_revision_tecnica || "", dateOrNull(d.fechaEmisionRevisionTecnica || d.emision_revision_tecnica), dateOrNull(d.fechaVencimientoRevisionTecnica || d.vencimiento_revision_tecnica),
      d.numeroSoat || d.numero_soat || "", dateOrNull(d.fechaEmisionSoat || d.emision_soat), dateOrNull(d.fechaVencimientoSoat || d.vencimiento_soat),
      d.tallaPolo || "", d.tallaPantalon || "", d.tallaCalzado || "", d.ultimoEmpleo1 || "", d.ultimoEmpleo2 || "", d.ultimoEmpleo3 || "",
      d.contactoEmergencia || "", d.parentesco || "", d.telefonoAlternativo || "", d.direccionEmergencia || "", cn, ca1, ca2, cfn,
      foto, docDelantera, docTrasera, breveteDelantera, breveteTrasera, revTecFrontal, revTecPosterior, tarjPropFrontal, tarjPropPosterior, reciboPdf, cv, certPdf, otroDoc, dniPdf, licenciaPdf
    ]);

    if (d.derechohabientes) {
      try {
        const f = JSON.parse(d.derechohabientes);
        if (f.hijos && Array.isArray(f.hijos)) {
          for (let h of f.hijos) {
            if (h.nombres) await connection.query(`INSERT INTO usuario_hijos (id_usuario, nombres, apellido1, apellido2, fecha_nacimiento) VALUES (?, ?, ?, ?, ?)`, [r.insertId, h.nombres, h.primerApellido, h.segundoApellido, dateOrNull(h.nacimiento)]);
          }
        }
      } catch(e) {}
    }

    // Vincular automáticamente en la tabla trabajadores con sincronización de estado (Activo vs Inactivo)
    const estadoTrabajador = (d.estado === "Activo") ? "Activo" : "Inactivo";
    await connection.query(
      `INSERT INTO trabajadores (id_trabajador, id_usuario, id_horario, fecha_ingreso, estado) VALUES (?, ?, 1, COALESCE(?, CURDATE()), ?) ON DUPLICATE KEY UPDATE estado = ?`,
      [r.insertId, r.insertId, dateOrNull(d.fechaIngreso), estadoTrabajador, estadoTrabajador]
    );

    cacheEmpleados.data = null;
    await connection.commit(); 
    res.status(201).json({ message: "Empleado creado" });
  } catch (error) { 
    await connection.rollback(); 
    console.error(error); 
    res.status(500).json({ error: error.message }); 
  } finally { 
    connection.release(); 
  }
});

router.put(['/empleados/:id', '/:id'], upload, async (req, res) => {
  const { id } = req.params; const d = req.body;
  const connection = await pool.getConnection(); 
  
  try {
    const dateOrNull = (val) => (val && val !== "") ? val : null;
    const emailOrNull = (val) => (val && typeof val === 'string' && val.trim() !== "") ? val.trim() : null;
    let cn = null, ca1 = null, ca2 = null, cfn = null;

    // 🚀 1. OBTENEMOS EL ESTADO ANTERIOR DE LA BASE DE DATOS
    const [usuarioActual] = await connection.query("SELECT estado FROM usuarios WHERE id_usuario = ?", [id]);
    const estadoAnterior = usuarioActual.length > 0 ? usuarioActual[0].estado : null;

    if (d.derechohabientes) {
      try {
        const f = typeof d.derechohabientes === 'string' ? JSON.parse(d.derechohabientes) : d.derechohabientes;
        if (f.esposa) { cn = f.esposa.nombres || null; ca1 = f.esposa.primerApellido || null; ca2 = f.esposa.segundoApellido || null; cfn = dateOrNull(f.esposa.nacimiento); }
      } catch(e) {}
    }

    let q = `UPDATE usuarios SET id_rol=?, tipo_documento=?, documento=?, ruc=?, sunat_estado=?, sunat_condicion=?, sunat_actividad=?, nombres=?, apellidos=?, primer_apellido=?, segundo_apellido=?, email=?, usuario=?, estado=?, telefono=?, fecha_ingreso=?, fecha_nacimiento=?, sexo=?, estado_civil=?, pais_nacimiento=?, direccion=?, distrito=?, sueldo=?, numero_emergencia=?, banco=?, cuenta_bancaria=?, cci=?, area=?, tipo_servicio=?, opcion_personal=?, subcontrata_codigo=?, cuadrilla=?, regimen_pensionario=?, tipo_comision_afp=?, cuspp=?, vencimiento_sctr=?, vencimiento_emo=?, categoria_licencia=?, numero_brevete=?, emision_brevete=?, fecha_vencimiento_brevete=?, numero_revision_tecnica=?, emision_revision_tecnica=?, vencimiento_revision_tecnica=?, numero_soat=?, emision_soat=?, vencimiento_soat=?, talla_polo=?, talla_pantalon=?, talla_calzado=?, ultimo_empleo_1=?, ultimo_empleo_2=?, ultimo_empleo_3=?, emergencia_nombre=?, emergencia_parentesco=?, emergencia_telefono_2=?, emergencia_direccion=?, conyuge_nombres=?, conyuge_apellido1=?, conyuge_apellido2=?, conyuge_fecha_nacimiento=?`;
    const v = [
      d.id_rol||null, d.tipoDocumento||"DNI", d.dni||"", d.ruc||"", d.estadoContribuyente||"", d.condicionContribuyente||"", d.actividadEconomica||"", 
      d.nombres||"", d.apellidos||`${d.primerApellido || ""} ${d.segundoApellido || ""}`.trim(), d.primerApellido||"", d.segundoApellido||"", 
      emailOrNull(d.correo), d.usuario||"", d.estado||"Activo", d.telefono||"", dateOrNull(d.fechaIngreso), dateOrNull(d.fechaNacimiento), 
      d.sexo||null, d.estadoCivil||null, d.paisNacimiento||"Perú", d.direccion||"", d.distrito||"", d.sueldo || null, d.telefonoEmergencia||"", 
      d.banco||"", d.cuenta||"", d.cci||"", d.area||"", d.tipo_servicio||null, d.opcionPersonal||"", d.subcontrata_codigo || d.subcontrataCodigo || null, d.cuadrilla||"", 
      d.regimenPensionario||"", d.tipoComision||"", d.cuspp||"", dateOrNull(d.sctrVencimiento), dateOrNull(d.emoVencimiento), 
      d.licencia||"Sin Licencia", d.numeroBrevete||"", dateOrNull(d.fechaEmisionLicencia), dateOrNull(d.fechaVencimientoLicencia), 
      d.numeroRevisionTecnica || d.numero_revision_tecnica || "", dateOrNull(d.fechaEmisionRevisionTecnica || d.emision_revision_tecnica), dateOrNull(d.fechaVencimientoRevisionTecnica || d.vencimiento_revision_tecnica),
      d.numeroSoat || d.numero_soat || "", dateOrNull(d.fechaEmisionSoat || d.emision_soat), dateOrNull(d.fechaVencimientoSoat || d.vencimiento_soat),
      d.tallaPolo||"", d.tallaPantalon||"", d.tallaCalzado||"", d.ultimoEmpleo1||"", d.ultimoEmpleo2||"", d.ultimoEmpleo3||"", 
      d.contactoEmergencia||"", d.parentesco||"", d.telefonoAlternativo||"", d.direccionEmergencia||"", cn, ca1, ca2, cfn
    ];
    
    if (d.password && d.password.trim() !== "") { 
      q += `, password=?, password_plano=?`; 
      v.push(await hashPassword(d.password.trim()), d.password.trim()); 
    }

    const getFile = (field) => req.files && req.files[field] ? req.files[field][0].filename : null;
    
    if (getFile('foto_personal')) { q += `, foto_personal=?`; v.push(getFile('foto_personal')); }
    if (getFile('doc_delantera')) { q += `, doc_delantera=?`; v.push(getFile('doc_delantera')); }
    if (getFile('doc_trasera')) { q += `, doc_trasera=?`; v.push(getFile('doc_trasera')); }
    if (getFile('brevete_delantera')) { q += `, brevete_delantera=?`; v.push(getFile('brevete_delantera')); }
    if (getFile('brevete_trasera')) { q += `, brevete_trasera=?`; v.push(getFile('brevete_trasera')); }
    if (getFile('revision_tecnica_frontal')) { q += `, revision_tecnica_frontal=?`; v.push(getFile('revision_tecnica_frontal')); }
    if (getFile('revision_tecnica_posterior')) { q += `, revision_tecnica_posterior=?`; v.push(getFile('revision_tecnica_posterior')); }
    if (getFile('tarjeta_propiedad_frontal')) { q += `, tarjeta_propiedad_frontal=?`; v.push(getFile('tarjeta_propiedad_frontal')); }
    if (getFile('tarjeta_propiedad_posterior')) { q += `, tarjeta_propiedad_posterior=?`; v.push(getFile('tarjeta_propiedad_posterior')); }
    if (getFile('recibo_servicio_pdf')) { q += `, recibo_servicio_pdf=?`; v.push(getFile('recibo_servicio_pdf')); }
    if (getFile('cv_pdf')) { q += `, cv_pdf=?`; v.push(getFile('cv_pdf')); }
    if (getFile('certificado_pdf')) { q += `, certificado_pdf=?`; v.push(getFile('certificado_pdf')); }
    if (getFile('otro_documento_pdf')) { q += `, otro_documento_pdf=?`; v.push(getFile('otro_documento_pdf')); }
    if (getFile('dni_pdf')) { q += `, dni_pdf=?`; v.push(getFile('dni_pdf')); }
    if (getFile('licencia_pdf')) { q += `, licencia_pdf=?`; v.push(getFile('licencia_pdf')); }

    q += ` WHERE id_usuario=?`; v.push(id);
    await connection.query(q, v);

    // LÓGICA DE HIJOS
    if (d.derechohabientes) {
      try {
        const f = typeof d.derechohabientes === 'string' ? JSON.parse(d.derechohabientes) : d.derechohabientes;
        if (f.hijos && Array.isArray(f.hijos)) {
          await connection.query(`DELETE FROM usuario_hijos WHERE id_usuario = ?`, [id]);
          for (let h of f.hijos) {
            if (h.nombres) await connection.query(`INSERT INTO usuario_hijos (id_usuario, nombres, apellido1, apellido2, fecha_nacimiento) VALUES (?, ?, ?, ?, ?)`, [id, h.nombres, h.primerApellido, h.segundoApellido, dateOrNull(h.nacimiento)]);
          }
        }
      } catch(e) {}
    }

    // 🚀 2. SINCRONIZACIÓN AUTOMÁTICA EN LA TABLA TRABAJADORES
    // Si el usuario está 'Activo' -> trabajador 'Activo'.
    // Si está en cualquier otro estado (Inactivo, Vacaciones, Descanso Médico, Cesado) -> trabajador 'Inactivo'
    const nuevoEstado = d.estado || "Activo";
    const estadoTrabajador = (nuevoEstado === "Activo") ? "Activo" : "Inactivo";

    await connection.query(
      `INSERT INTO trabajadores (id_trabajador, id_usuario, id_horario, fecha_ingreso, estado) 
       VALUES (?, ?, 1, COALESCE(?, CURDATE()), ?) 
       ON DUPLICATE KEY UPDATE estado = ?`,
      [id, id, dateOrNull(d.fechaIngreso), estadoTrabajador, estadoTrabajador]
    );

    // 🚀 3. SI EL ESTADO CAMBIÓ, LO GUARDAMOS EN EL HISTORIAL (¡Incluso los reingresos a Activo!)
    if (nuevoEstado !== estadoAnterior) {
      await connection.query(
        `INSERT INTO historial_estados (id_usuario, estado_cambiado, fecha_inicio, fecha_fin, observacion) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          id, 
          nuevoEstado, 
          dateOrNull(d.estadoFechaInicio), 
          dateOrNull(d.estadoFechaFin), 
          d.estadoObservacion || (nuevoEstado === "Activo" ? "Retorno a actividades" : null)
        ]
      );
    }

    cacheEmpleados.data = null;
    res.json({ message: "Usuario actualizado" });
  } catch (error) { 
    console.error(error);
    res.status(500).json({ error: error.message }); 
  } finally {
    connection.release();
  }
});

router.patch(['/empleados/:id/estado', '/:id/estado'], async (req, res) => {
  const { id } = req.params;
  const { estado, estadoFechaInicio, estadoFechaFin, estadoObservacion } = req.body;
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const dateOrNull = (val) => (val && val !== "") ? val : null;
    const [usuarioActual] = await connection.query("SELECT estado FROM usuarios WHERE id_usuario = ?", [id]);
    if (usuarioActual.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: "Empleado no encontrado" });
    }

    const estadoAnterior = usuarioActual[0].estado;
    const nuevoEstado = estado || "Activo";

    // 1. Actualizar estado en usuarios
    if (nuevoEstado === "Cesado" && estadoFechaFin) {
      await connection.query("UPDATE usuarios SET estado = ?, fecha_salida = ? WHERE id_usuario = ?", [nuevoEstado, dateOrNull(estadoFechaFin), id]);
    } else if (nuevoEstado === "Activo") {
      await connection.query("UPDATE usuarios SET estado = ?, fecha_salida = NULL WHERE id_usuario = ?", [nuevoEstado, id]);
    } else {
      await connection.query("UPDATE usuarios SET estado = ? WHERE id_usuario = ?", [nuevoEstado, id]);
    }

    // 2. Sincronizar automáticamente en trabajadores (Activo vs Inactivo)
    const estadoTrabajador = (nuevoEstado === "Activo") ? "Activo" : "Inactivo";
    await connection.query(
      `INSERT INTO trabajadores (id_trabajador, id_usuario, id_horario, fecha_ingreso, estado) 
       VALUES (?, ?, 1, CURDATE(), ?) 
       ON DUPLICATE KEY UPDATE estado = ?`,
      [id, id, estadoTrabajador, estadoTrabajador]
    );

    // 3. Registrar en historial_estados SOLO si el estado cambió (evita historiales duplicados innecesarios)
    if (nuevoEstado !== estadoAnterior) {
      await connection.query(
        `INSERT INTO historial_estados (id_usuario, estado_cambiado, fecha_inicio, fecha_fin, observacion) 
         VALUES (?, ?, ?, ?, ?)`,
        [
          id, 
          nuevoEstado, 
          dateOrNull(estadoFechaInicio), 
          dateOrNull(estadoFechaFin), 
          estadoObservacion || (nuevoEstado === "Activo" ? "Retorno a actividades" : `Cambio a ${nuevoEstado}`)
        ]
      );
    }

    await connection.commit();
    cacheEmpleados.data = null;
    res.json({ success: true, message: `Estado actualizado a ${nuevoEstado}`, estado: nuevoEstado, id_usuario: id });
  } catch (error) {
    await connection.rollback();
    console.error("Error al actualizar estado rápido:", error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

router.get(['/empleados/:id/historial', '/:id/historial'], async (req, res) => {
  try {
    const { id } = req.params;
    // Traemos el historial ordenado desde el evento más reciente al más antiguo
    const [historial] = await pool.query(
      "SELECT * FROM historial_estados WHERE id_usuario = ? ORDER BY fecha_registro DESC", 
      [id]
    );
    res.json(historial);
  } catch (error) { 
    res.status(500).json({ error: error.message }); 
  }
});

router.post(['/empleados/actualizar-sctr-masivo', '/actualizar-sctr-masivo'], async (req, res) => {
  const { ids, vencimiento_sctr } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Debe seleccionar al menos un empleado." });
  }
  if (!vencimiento_sctr) {
    return res.status(400).json({ error: "Debe ingresar una fecha de vencimiento válida." });
  }

  const cleanIds = ids.map(id => Number(id)).filter(id => !isNaN(id) && id > 0);
  if (cleanIds.length === 0) {
    return res.status(400).json({ error: "IDs inválidos." });
  }

  const connection = await pool.getConnection();
  try {
    await connection.query(
      "UPDATE usuarios SET vencimiento_sctr = ? WHERE id_usuario IN (?)",
      [vencimiento_sctr, cleanIds]
    );

    if (cacheEmpleados) {
      cacheEmpleados.data = null;
    }

    res.json({
      success: true,
      message: `SCTR actualizado correctamente para ${cleanIds.length} empleado(s).`,
      total: cleanIds.length,
      vencimiento_sctr
    });
  } catch (err) {
    console.error("Error al actualizar SCTR masivo:", err);
    res.status(500).json({ error: "Error en el servidor al actualizar SCTR masivo." });
  } finally {
    connection.release();
  }
});

router.post(['/empleados/:id/reset-password', '/:id/reset-password'], async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body || {};
    const [rows] = await pool.query("SELECT id_usuario, documento, usuario FROM usuarios WHERE id_usuario = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ error: "Empleado no encontrado" });
    const user = rows[0];
    const newPass = (password && String(password).trim() !== "") ? String(password).trim() : (user.documento ? String(user.documento).trim() : (user.usuario || "123456"));
    const hashed = await hashPassword(newPass);
    await pool.query("UPDATE usuarios SET password = ?, password_plano = ? WHERE id_usuario = ?", [hashed, newPass, id]);
    cacheEmpleados.data = null;
    res.json({ success: true, password: newPass, message: `Contraseña restablecida exitosamente a: ${newPass}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, estado } = req.body;
    await pool.query(
      "UPDATE roles SET nombre = COALESCE(?, nombre), descripcion = COALESCE(?, descripcion), estado = COALESCE(?, estado) WHERE id_rol = ?",
      [nombre?.trim()?.toUpperCase() || null, descripcion !== undefined ? descripcion?.trim() : null, estado || null, id]
    );
    res.json({ success: true, message: "Rol actualizado con éxito." });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE roles SET estado = 'Inactivo' WHERE id_rol = ?", [id]);
    res.json({ success: true, message: "Rol desactivado con éxito." });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, estado } = req.body;
    await pool.query(
      "UPDATE areas SET nombre = COALESCE(?, nombre), estado = COALESCE(?, estado) WHERE id_area = ?",
      [nombre?.trim() || null, estado || null, id]
    );
    res.json({ success: true, message: "Área actualizada con éxito." });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("UPDATE areas SET estado = 'Inactivo' WHERE id_area = ?", [id]);
    res.json({ success: true, message: "Área desactivada con éxito." });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/resumen', async (req, res) => {
  try {
    const [roles] = await pool.query(`
      SELECT 
        r.id_rol, 
        r.nombre AS nombre_rol, 
        r.estado,
        COUNT(rp.id_permiso) AS total_permisos,
        GROUP_CONCAT(DISTINCT SUBSTRING_INDEX(p.clave, '.', 1) ORDER BY SUBSTRING_INDEX(p.clave, '.', 1) SEPARATOR ',') AS modulos_activos
      FROM roles r
      LEFT JOIN roles_permisos rp ON rp.id_rol = r.id_rol
      LEFT JOIN permisos p ON p.id_permiso = rp.id_permiso AND p.estado = 'Activo'
      GROUP BY r.id_rol
      ORDER BY r.id_rol ASC
    `);

    const [todosPermisos] = await pool.query("SELECT id_permiso, nombre, clave, modulo, estado FROM permisos WHERE estado = 'Activo'");

    res.json({ success: true, roles, permisos: todosPermisos });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get('/rol/:id_rol', async (req, res) => {
  try {
    const { id_rol } = req.params;
    let rows;
    if (Number(id_rol) === 1) {
      const [allRows] = await pool.query(`
        SELECT id_permiso, clave, nombre, modulo
        FROM permisos
        WHERE estado = 'Activo'
      `);
      rows = allRows;
    } else {
      const [permRows] = await pool.query(`
        SELECT p.id_permiso, p.clave, p.nombre, p.modulo
        FROM permisos p
        JOIN roles_permisos rp ON rp.id_permiso = p.id_permiso
        WHERE rp.id_rol = ? AND p.estado = 'Activo'
      `, [id_rol]);
      rows = permRows;
    }
    res.json({ success: true, claves: rows.map(r => r.clave), permisos: rows });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.post('/guardar', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const { id_rol, claves } = req.body;
    if (!id_rol) return res.status(400).json({ error: "id_rol es requerido." });

    const clavesArr = Array.isArray(claves) ? claves : (typeof claves === 'string' ? JSON.parse(claves || '[]') : []);

    // 1. Eliminar permisos anteriores del rol
    await connection.query("DELETE FROM roles_permisos WHERE id_rol = ?", [id_rol]);

    // 2. Insertar cada permiso
    for (const clv of clavesArr) {
      const cleanClave = String(clv).trim();
      if (!cleanClave || !cleanClave.includes('.')) continue;

      const [modulo, accion] = cleanClave.split('.');
      const nombre = `${accion.charAt(0).toUpperCase() + accion.slice(1)} ${modulo.charAt(0).toUpperCase() + modulo.slice(1)}`;

      let [perm] = await connection.query("SELECT id_permiso FROM permisos WHERE clave = ?", [cleanClave]);
      let idPermiso;
      if (perm.length > 0) {
        idPermiso = perm[0].id_permiso;
      } else {
        const [ins] = await connection.query(
          "INSERT INTO permisos (nombre, clave, modulo, estado) VALUES (?, ?, ?, 'Activo')",
          [nombre, cleanClave, modulo]
        );
        idPermiso = ins.insertId;
      }

      await connection.query(
        "INSERT IGNORE INTO roles_permisos (id_rol, id_permiso) VALUES (?, ?)",
        [id_rol, idPermiso]
      );
    }

    await connection.commit();
    res.json({ success: true, message: "Permisos del rol actualizados con éxito." });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

router.delete('/rol/:id_rol', async (req, res) => {
  try {
    const { id_rol } = req.params;
    await pool.query("DELETE FROM roles_permisos WHERE id_rol = ?", [id_rol]);
    res.json({ success: true, message: "Permisos eliminados del rol." });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

router.get(['/reemplazos', '/cuadrillas/reemplazos'], async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id_reemplazo, codigo_cuadrilla, id_tecnico_titular, nombre_titular, id_tecnico_reemplazo, nombre_reemplazo, id_tecnico_reemplazo_t2, nombre_reemplazo_t2, activo, fecha_creacion, fecha_actualizacion FROM cuadrilla_reemplazos WHERE activo = 1 ORDER BY codigo_cuadrilla ASC"
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error("Error al obtener reemplazos de cuadrillas:", error.message);
    res.status(500).json({ success: false, error: error.message, data: [] });
  }
});

router.post(['/reemplazo', '/cuadrillas/reemplazo'], async (req, res) => {
  try {
    const {
      codigo_cuadrilla,
      id_tecnico_reemplazo,
      nombre_reemplazo,
      id_tecnico_reemplazo_t2,
      nombre_reemplazo_t2,
      id_tecnico_titular,
      nombre_titular,
      actualizar_ordenes = true
    } = req.body || {};

    if (!codigo_cuadrilla || !codigo_cuadrilla.trim()) {
      return res.status(400).json({ success: false, message: "El código de cuadrilla es obligatorio" });
    }

    const cleanCodigo = codigo_cuadrilla.trim().toUpperCase();

    // Guardar / Actualizar en tabla cuadrilla_reemplazos
    await pool.query(
      `INSERT INTO cuadrilla_reemplazos 
        (codigo_cuadrilla, id_tecnico_titular, nombre_titular, id_tecnico_reemplazo, nombre_reemplazo, id_tecnico_reemplazo_t2, nombre_reemplazo_t2, activo, fecha_actualizacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE
        id_tecnico_titular = COALESCE(VALUES(id_tecnico_titular), id_tecnico_titular),
        nombre_titular = COALESCE(VALUES(nombre_titular), nombre_titular),
        id_tecnico_reemplazo = VALUES(id_tecnico_reemplazo),
        nombre_reemplazo = VALUES(nombre_reemplazo),
        id_tecnico_reemplazo_t2 = VALUES(id_tecnico_reemplazo_t2),
        nombre_reemplazo_t2 = VALUES(nombre_reemplazo_t2),
        activo = 1,
        fecha_actualizacion = NOW()`,
      [
        cleanCodigo,
        id_tecnico_titular || null,
        nombre_titular || null,
        id_tecnico_reemplazo || null,
        nombre_reemplazo || null,
        id_tecnico_reemplazo_t2 || null,
        nombre_reemplazo_t2 || null
      ]
    );

    let affectedOrdersCount = 0;
    if (actualizar_ordenes) {
      const fullTechName = (nombre_reemplazo_t2 && nombre_reemplazo_t2.trim())
        ? `${nombre_reemplazo} / ${nombre_reemplazo_t2}`
        : nombre_reemplazo;

      const [upRes] = await pool.query(
        `UPDATE ordenes 
         SET 
           cuadrilla_origen_fenix = COALESCE(cuadrilla_origen_fenix, cuadrilla),
           id_tecnico = ?,
           id_tecnico_reemplazo = ?,
           tecnico_asignado = ?,
           asignacion_manual = 1,
           fecha_asignacion_manual = NOW()
         WHERE (UPPER(cuadrilla) LIKE ? OR UPPER(cuadrilla_origen_fenix) LIKE ?)
           AND (
             DATE(fecha_visita) >= CURDATE() 
             OR (fecha_visita IS NULL AND DATE(fecha_solicitud) >= CURDATE())
             OR (fecha_visita IS NULL AND fecha_solicitud IS NULL)
           )
           AND UPPER(COALESCE(estado, '')) NOT IN ('FINALIZADA', 'LIQUIDADA')`,
        [
          id_tecnico_reemplazo || null,
          id_tecnico_reemplazo_t2 || null,
          fullTechName || null,
          `%${cleanCodigo}%`,
          `%${cleanCodigo}%`
        ]
      );
      affectedOrdersCount = upRes.affectedRows || 0;
    }

    res.json({
      success: true,
      message: `Cuadrilla ${cleanCodigo} configurada con reemplazo: ${nombre_reemplazo}. Persistente para futuras órdenes Fénix.`,
      codigo_cuadrilla: cleanCodigo,
      id_tecnico_reemplazo,
      nombre_reemplazo,
      affectedOrders: affectedOrdersCount
    });
  } catch (error) {
    console.error("Error al registrar reemplazo de cuadrilla:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete(['/reemplazo/:codigo', '/cuadrillas/reemplazo/:codigo'], async (req, res) => {
  try {
    const { codigo } = req.params;
    const cleanCodigo = decodeURIComponent(codigo || '').trim().toUpperCase();
    const targetFecha = (req.query.fecha || req.body?.fecha || '').toString().trim();

    // 1. Desactivar reemplazo persistente
    await pool.query(
      "UPDATE cuadrilla_reemplazos SET activo = 0 WHERE UPPER(codigo_cuadrilla) = ?",
      [cleanCodigo]
    );

    // 2. Si se especificó una fecha (por ejemplo al filtrar un día anterior), se resetea esa fecha específica.
    // Si no se pasó fecha, por defecto se resetean órdenes de HOY o futuras que no estén finalizadas/liquidadas.
    if (targetFecha && /^\d{4}-\d{2}-\d{2}$/.test(targetFecha)) {
      await pool.query(
        `UPDATE ordenes 
         SET asignacion_manual = 0, fecha_asignacion_manual = NULL, id_tecnico_reemplazo = NULL
         WHERE (UPPER(cuadrilla) LIKE ? OR UPPER(cuadrilla_origen_fenix) LIKE ?)
           AND (
             DATE(fecha_visita) = ? 
             OR (fecha_visita IS NULL AND DATE(fecha_solicitud) = ?)
           )`,
        [`%${cleanCodigo}%`, `%${cleanCodigo}%`, targetFecha, targetFecha]
      );
    } else {
      await pool.query(
        `UPDATE ordenes 
         SET asignacion_manual = 0, fecha_asignacion_manual = NULL, id_tecnico_reemplazo = NULL
         WHERE (UPPER(cuadrilla) LIKE ? OR UPPER(cuadrilla_origen_fenix) LIKE ?)
           AND (
             DATE(fecha_visita) >= CURDATE() 
             OR (fecha_visita IS NULL AND DATE(fecha_solicitud) >= CURDATE())
             OR (fecha_visita IS NULL AND fecha_solicitud IS NULL)
           )
           AND UPPER(COALESCE(estado, '')) NOT IN ('FINALIZADA', 'LIQUIDADA')`,
        [`%${cleanCodigo}%`, `%${cleanCodigo}%`]
      );
    }

    res.json({
      success: true,
      message: `Reemplazo de la cuadrilla ${cleanCodigo} desactivado y restaurado a origen Fénix.`
    });
  } catch (error) {
    console.error("Error al restaurar cuadrilla:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;