import type { FormDefinition } from "./types";

export const nom035Guia5: FormDefinition = {
  "key": "nom035_guia5",
  "norm": "NOM-035-STPS-2018",
  "title": "Guía de referencia V",
  "subtitle": "Datos del trabajador",
  "description": "Ficha de datos generales del trabajador; se llena después del cuestionario de factores de riesgo psicosocial.",
  "scale": "none",
  "sections": [
    {
      "id": "info",
      "title": "Información del trabajador",
      "questions": [
        {
          "id": "sexo",
          "text": "Sexo:",
          "kind": "choice",
          "options": [
            {
              "value": "Masculino",
              "label": "Masculino"
            },
            {
              "value": "Femenino",
              "label": "Femenino"
            }
          ]
        },
        {
          "id": "edad",
          "text": "Edad en años:",
          "kind": "choice",
          "options": [
            {
              "value": "15 - 19",
              "label": "15 - 19"
            },
            {
              "value": "20 - 24",
              "label": "20 - 24"
            },
            {
              "value": "25 - 29",
              "label": "25 - 29"
            },
            {
              "value": "30 - 34",
              "label": "30 - 34"
            },
            {
              "value": "35 - 39",
              "label": "35 - 39"
            },
            {
              "value": "40 - 44",
              "label": "40 - 44"
            },
            {
              "value": "45 - 49",
              "label": "45 - 49"
            },
            {
              "value": "50 - 54",
              "label": "50 - 54"
            },
            {
              "value": "55 - 59",
              "label": "55 - 59"
            },
            {
              "value": "60 - 64",
              "label": "60 - 64"
            },
            {
              "value": "65 - 69",
              "label": "65 - 69"
            },
            {
              "value": "70 o más",
              "label": "70 o más"
            }
          ]
        },
        {
          "id": "estado_civil",
          "text": "Estado civil:",
          "kind": "choice",
          "options": [
            {
              "value": "Casado",
              "label": "Casado"
            },
            {
              "value": "Soltero",
              "label": "Soltero"
            },
            {
              "value": "Unión libre",
              "label": "Unión libre"
            },
            {
              "value": "Divorciado",
              "label": "Divorciado"
            },
            {
              "value": "Viudo",
              "label": "Viudo"
            }
          ]
        },
        {
          "id": "nivel_estudios",
          "text": "Nivel de estudios:",
          "kind": "choice",
          "options": [
            {
              "value": "Sin formación",
              "label": "Sin formación"
            },
            {
              "value": "Primaria - Terminada",
              "label": "Primaria - Terminada"
            },
            {
              "value": "Primaria - Incompleta",
              "label": "Primaria - Incompleta"
            },
            {
              "value": "Secundaria - Terminada",
              "label": "Secundaria - Terminada"
            },
            {
              "value": "Secundaria - Incompleta",
              "label": "Secundaria - Incompleta"
            },
            {
              "value": "Preparatoria o Bachillerato - Terminada",
              "label": "Preparatoria o Bachillerato - Terminada"
            },
            {
              "value": "Preparatoria o Bachillerato - Incompleta",
              "label": "Preparatoria o Bachillerato - Incompleta"
            },
            {
              "value": "Técnico Superior - Terminada",
              "label": "Técnico Superior - Terminada"
            },
            {
              "value": "Técnico Superior - Incompleta",
              "label": "Técnico Superior - Incompleta"
            },
            {
              "value": "Licenciatura - Terminada",
              "label": "Licenciatura - Terminada"
            },
            {
              "value": "Licenciatura - Incompleta",
              "label": "Licenciatura - Incompleta"
            },
            {
              "value": "Maestría - Terminada",
              "label": "Maestría - Terminada"
            },
            {
              "value": "Maestría - Incompleta",
              "label": "Maestría - Incompleta"
            },
            {
              "value": "Doctorado - Terminada",
              "label": "Doctorado - Terminada"
            },
            {
              "value": "Doctorado - Incompleta",
              "label": "Doctorado - Incompleta"
            }
          ]
        }
      ]
    },
    {
      "id": "laborales",
      "title": "Datos laborales:",
      "questions": [
        {
          "id": "puesto",
          "text": "Ocupación/profesión/puesto:",
          "kind": "text"
        },
        {
          "id": "departamento",
          "text": "Departamento/Sección/Área:",
          "kind": "text"
        },
        {
          "id": "tipo_puesto",
          "text": "Tipo de puesto:",
          "kind": "choice",
          "options": [
            {
              "value": "Operativo",
              "label": "Operativo"
            },
            {
              "value": "Profesional o técnico",
              "label": "Profesional o técnico"
            },
            {
              "value": "Supervisor",
              "label": "Supervisor"
            },
            {
              "value": "Gerente",
              "label": "Gerente"
            }
          ]
        },
        {
          "id": "tipo_contratacion",
          "text": "Tipo de contratación:",
          "kind": "choice",
          "options": [
            {
              "value": "Por obra o proyecto",
              "label": "Por obra o proyecto"
            },
            {
              "value": "Por tiempo determinado (temporal)",
              "label": "Por tiempo determinado (temporal)"
            },
            {
              "value": "Tiempo indeterminado",
              "label": "Tiempo indeterminado"
            },
            {
              "value": "Honorarios",
              "label": "Honorarios"
            }
          ]
        },
        {
          "id": "tipo_personal",
          "text": "Tipo de personal:",
          "kind": "choice",
          "options": [
            {
              "value": "Sindicalizado",
              "label": "Sindicalizado"
            },
            {
              "value": "Confianza",
              "label": "Confianza"
            },
            {
              "value": "Ninguno",
              "label": "Ninguno"
            }
          ]
        },
        {
          "id": "tipo_jornada",
          "text": "Tipo de jornada de trabajo:",
          "kind": "choice",
          "options": [
            {
              "value": "Fijo nocturno (entre las 20:00 y 6:00 hrs)",
              "label": "Fijo nocturno (entre las 20:00 y 6:00 hrs)"
            },
            {
              "value": "Fijo diurno (entre las 6:00 y 20:00 hrs)",
              "label": "Fijo diurno (entre las 6:00 y 20:00 hrs)"
            },
            {
              "value": "Fijo mixto (combinación de nocturno y diurno)",
              "label": "Fijo mixto (combinación de nocturno y diurno)"
            }
          ]
        },
        {
          "id": "rotacion_turnos",
          "text": "Realiza rotación de turnos:",
          "kind": "choice",
          "options": [
            {
              "value": "Sí",
              "label": "Sí"
            },
            {
              "value": "No",
              "label": "No"
            }
          ]
        }
      ]
    },
    {
      "id": "experiencia",
      "title": "Experiencia (años):",
      "questions": [
        {
          "id": "tiempo_puesto",
          "text": "Tiempo en el puesto actual",
          "kind": "choice",
          "options": [
            {
              "value": "Menos de 6 meses",
              "label": "Menos de 6 meses"
            },
            {
              "value": "Entre 6 meses y 1 año",
              "label": "Entre 6 meses y 1 año"
            },
            {
              "value": "Entre 1 a 4 años",
              "label": "Entre 1 a 4 años"
            },
            {
              "value": "Entre 5 a 9 años",
              "label": "Entre 5 a 9 años"
            },
            {
              "value": "Entre 10 a 14 años",
              "label": "Entre 10 a 14 años"
            },
            {
              "value": "Entre 15 a 19 años",
              "label": "Entre 15 a 19 años"
            },
            {
              "value": "Entre 20 a 24 años",
              "label": "Entre 20 a 24 años"
            },
            {
              "value": "25 años o más",
              "label": "25 años o más"
            }
          ]
        },
        {
          "id": "tiempo_experiencia",
          "text": "Tiempo experiencia laboral",
          "kind": "choice",
          "options": [
            {
              "value": "Menos de 6 meses",
              "label": "Menos de 6 meses"
            },
            {
              "value": "Entre 6 meses y 1 año",
              "label": "Entre 6 meses y 1 año"
            },
            {
              "value": "Entre 1 a 4 años",
              "label": "Entre 1 a 4 años"
            },
            {
              "value": "Entre 5 a 9 años",
              "label": "Entre 5 a 9 años"
            },
            {
              "value": "Entre 10 a 14 años",
              "label": "Entre 10 a 14 años"
            },
            {
              "value": "Entre 15 a 19 años",
              "label": "Entre 15 a 19 años"
            },
            {
              "value": "Entre 20 a 24 años",
              "label": "Entre 20 a 24 años"
            },
            {
              "value": "25 años o más",
              "label": "25 años o más"
            }
          ]
        }
      ]
    }
  ]
};
