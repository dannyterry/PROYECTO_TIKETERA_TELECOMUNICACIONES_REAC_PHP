const lookerService = require('../looker_alert_service');

const sampleOrders = [
  {
    ticket: "MOTO-SUR2-1",
    distrito: "Villa Maria del Triunfo",
    direccion: "Villa Maria del Triunfo (SUR 2)",
    zona_nodo: "SUR 2",
    franja_horaria: "12:00-15:59",
    motivo: "MOTOWIN CRM",
    tarjeta: "MOTOWIN ZONAS"
  },
  {
    ticket: "MOTO-SUR2-2",
    distrito: "Villa Maria del Triunfo",
    direccion: "Villa Maria del Triunfo (SUR 2)",
    zona_nodo: "SUR 2",
    franja_horaria: "12:00-15:59",
    motivo: "MOTOWIN CRM",
    tarjeta: "MOTOWIN ZONAS"
  },
  {
    ticket: "MOTO-SUR2-3",
    distrito: "Villa Maria del Triunfo",
    direccion: "Villa Maria del Triunfo (SUR 2)",
    zona_nodo: "SUR 2",
    franja_horaria: "12:00-15:59",
    motivo: "MOTOWIN CRM",
    tarjeta: "MOTOWIN ZONAS"
  },
  {
    ticket: "MOTO-SUR2-4",
    distrito: "Villa Maria del Triunfo",
    direccion: "Villa Maria del Triunfo (SUR 2)",
    zona_nodo: "SUR 2",
    franja_horaria: "12:00-15:59",
    motivo: "MOTOWIN CRM",
    tarjeta: "MOTOWIN ZONAS"
  },
  {
    ticket: "MOTO-SUR2-5",
    distrito: "Villa Maria del Triunfo",
    direccion: "Villa Maria del Triunfo (SUR 2)",
    zona_nodo: "SUR 2",
    franja_horaria: "12:00-15:59",
    motivo: "MOTOWIN CRM",
    tarjeta: "MOTOWIN ZONAS"
  },
  {
    ticket: "MOTO-SUR4-1",
    distrito: "Villa Maria del Triunfo",
    direccion: "Villa Maria del Triunfo (SUR 4)",
    zona_nodo: "SUR 4",
    franja_horaria: "12:00-15:59",
    motivo: "MOTOWIN CRM",
    tarjeta: "MOTOWIN ZONAS"
  }
];

const res = lookerService.processCardsAndAlerts(sampleOrders);
console.log('Resultado tarjetas MOTOWIN:', JSON.stringify(res.cards['MOTOWIN ZONAS'], null, 2));
console.log('Alertas Sur:', res.alertasSur.length);
