import type { FormDefinition } from "./types";

export const nom035Guia1: FormDefinition = {
  "key": "nom035_guia1",
  "norm": "NOM-035-STPS-2018",
  "title": "Guía de Referencia I",
  "subtitle": "Cuestionario para identificar a los trabajadores que fueron sujetos a acontecimientos traumáticos severos",
  "description": "Identifica a los trabajadores que han sido sujetos a acontecimientos traumáticos severos y que requieren valoración clínica.",
  "instructions": "Marque una “X” a la respuesta que se le indica",
  "scale": "yesno",
  "sections": [
    {
      "id": "s1",
      "title": "I.- Acontecimiento traumático severo",
      "instructions": "¿Ha presenciado o sufrido alguna vez, durante o con motivo del trabajo un acontecimiento como los siguientes:",
      "questions": [
        {
          "id": "g1_s1_1",
          "text": "Accidente que tenga como consecuencia la muerte, la pérdida de un miembro o una lesión grave?"
        },
        {
          "id": "g1_s1_2",
          "text": "Asaltos?"
        },
        {
          "id": "g1_s1_3",
          "text": "Actos violentos que derivaron en lesiones graves?"
        },
        {
          "id": "g1_s1_4",
          "text": "Secuestro?"
        },
        {
          "id": "g1_s1_5",
          "text": "Amenazas?, o"
        },
        {
          "id": "g1_s1_6",
          "text": "Cualquier otro que ponga en riesgo su vida o salud, y/o la de otras personas?"
        }
      ]
    },
    {
      "id": "s2",
      "title": "II.- Recuerdos persistentes sobre el acontecimiento (durante el último mes):",
      "showIf": {
        "anyYesInSection": "s1"
      },
      "questions": [
        {
          "id": "g1_s2_1",
          "text": "¿Ha tenido recuerdos recurrentes sobre el acontecimiento que le provocan malestares?"
        },
        {
          "id": "g1_s2_2",
          "text": "¿Ha tenido sueños de carácter recurrente sobre el acontecimiento, que le producen malestar?"
        }
      ]
    },
    {
      "id": "s3",
      "title": "III.- Esfuerzo por evitar circunstancias parecidas o asociadas al acontecimiento (durante el último mes):",
      "showIf": {
        "anyYesInSection": "s1"
      },
      "questions": [
        {
          "id": "g1_s3_1",
          "text": "¿Se ha esforzado por evitar todo tipo de sentimientos, conversaciones o situaciones que le puedan recordar el acontecimiento?"
        },
        {
          "id": "g1_s3_2",
          "text": "¿Se ha esforzado por evitar todo tipo de actividades, lugares o personas que motivan recuerdos del acontecimiento?"
        },
        {
          "id": "g1_s3_3",
          "text": "¿Ha tenido dificultad para recordar alguna parte importante del evento?"
        },
        {
          "id": "g1_s3_4",
          "text": "¿Ha disminuido su interés en sus actividades cotidianas?"
        },
        {
          "id": "g1_s3_5",
          "text": "¿Se ha sentido usted alejado o distante de los demás?"
        },
        {
          "id": "g1_s3_6",
          "text": "¿Ha notado que tiene dificultad para expresar sus sentimientos?"
        },
        {
          "id": "g1_s3_7",
          "text": "¿Ha tenido la impresión de que su vida se va a acortar, que va a morir antes que otras personas o que tiene un futuro limitado?"
        }
      ]
    },
    {
      "id": "s4",
      "title": "IV.- Afectación (durante el último mes):",
      "showIf": {
        "anyYesInSection": "s1"
      },
      "questions": [
        {
          "id": "g1_s4_1",
          "text": "¿Ha tenido usted dificultades para dormir?"
        },
        {
          "id": "g1_s4_2",
          "text": "¿Ha estado particularmente irritable o le han dado arranques de coraje?"
        },
        {
          "id": "g1_s4_3",
          "text": "¿Ha tenido dificultad para concentrarse?"
        },
        {
          "id": "g1_s4_4",
          "text": "¿Ha estado nervioso o constantemente en alerta?"
        },
        {
          "id": "g1_s4_5",
          "text": "¿Se ha sobresaltado fácilmente por cualquier cosa?"
        }
      ]
    }
  ],
  "clinicalRule": {
    "screeningSection": "s1",
    "thresholds": [
      {
        "sectionId": "s2",
        "minYes": 1
      },
      {
        "sectionId": "s3",
        "minYes": 3
      },
      {
        "sectionId": "s4",
        "minYes": 2
      }
    ]
  }
};
