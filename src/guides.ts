// ─── BASE DE CONOCIMIENTO: ficha por paso del onboarding ───
// Guía consultiva para usar en reuniones reales. Se muestra al abrir un paso.

export interface PhaseGuide {
  que: string;     // Qué es la fase
  porque: string;  // Por qué importa
  cuando: string;  // Cuándo se hace
}

// Intro por fase (clave = nombre de la fase del playbook)
export const PHASE_GUIDES: Record<string, PhaseGuide> = {
  'Cierre & Pago': {
    que: 'El momento en que un prospecto se convierte en cliente: se acuerda el alcance, se firma el espíritu del trabajo y entra la seña.',
    porque: 'Filtra curiosos, financia el arranque y deja por escrito qué se hace y qué no. Sin esto, no hay proyecto.',
    cuando: 'Apenas el cliente dice "sí", antes de tocar una sola herramienta.',
  },
  'Setup & Organización': {
    que: 'Armar la infraestructura del proyecto: carpetas, canal de comunicación, acuerdo y accesos.',
    porque: 'Un proyecto ordenado desde el día 1 transmite profesionalismo y evita el caos que hace perder tiempo y confianza.',
    cuando: 'Inmediatamente después de cobrar la seña.',
  },
  'Discovery & Brief': {
    que: 'La fase de descubrimiento: entender el negocio, su público, sus dolores y su marca a fondo.',
    porque: 'Es la materia prima de TODO lo que sigue. Un mal brief = una web genérica. Acá se gana o se pierde el proyecto.',
    cuando: 'En la llamada de kickoff y los días siguientes, antes de diseñar.',
  },
  'Diseño': {
    que: 'Traducir la estrategia del brief en una dirección visual y una maqueta aprobada.',
    porque: 'El diseño es lo primero que ve el cliente y su público; define la percepción de valor de toda la marca.',
    cuando: 'Una vez que el brief está completo y hay material visual.',
  },
  'Desarrollo': {
    que: 'Construir la web real: frontend, backend, funciones, seguridad e integraciones.',
    porque: 'Es donde el diseño cobra vida y funciona de verdad. La calidad técnica sostiene todo lo demás.',
    cuando: 'Con el diseño aprobado por el cliente.',
  },
  'SEO & AEO': {
    que: 'Optimizar la web para que la encuentren: en buscadores (SEO) y en las IAs que recomiendan (AEO/GEO).',
    porque: 'Una web hermosa que nadie encuentra no sirve. El AEO es el diferencial que casi nadie ofrece hoy.',
    cuando: 'Antes del lanzamiento, con el contenido real cargado.',
  },
  'Lanzamiento': {
    que: 'Poner la web en vivo en su dominio, con analítica y un control de calidad final.',
    porque: 'Es el momento de mayor exposición; un detalle roto en producción daña la confianza recién ganada.',
    cuando: 'Cuando todo está aprobado y probado.',
  },
  'Cierre & Retención': {
    que: 'Cerrar bien el proyecto y abrir la relación a largo plazo: entrega, cobro final, testimonio y seguimiento.',
    porque: 'Acá nace el ingreso recurrente y los referidos. Un cierre profesional convierte un cliente en un fan.',
    cuando: 'Al entregar y durante los 30 días siguientes.',
  },
};

export interface StepGuide {
  que: string;            // Qué es
  como: string;           // Cómo se consigue / se hace
  preguntas?: string[];   // Preguntas para la reunión
  dolor?: string;         // El dolor (pain point) del cliente
  identificar?: string;   // Cómo identificarlo / técnica de descubrimiento
  solucion?: string;      // Cómo se soluciona con nuestro servicio
  listo: string[];        // Checklist: la etapa está OK cuando…
}

export const STEP_GUIDES: Record<string, StepGuide> = {
  // ───── FASE 0 — Cierre & Pago ─────
  'Recibir seña del 50%': {
    que: 'La seña inicial (50%) que formaliza el arranque. Filtra curiosos de clientes reales y financia el inicio del trabajo.',
    como: 'Enviar medio de pago claro (alias/transferencia/USDT) junto al Acuerdo. No se abre Drive ni se diseña nada hasta confirmar el pago.',
    preguntas: [
      '¿Con qué método te queda más cómodo pagar la seña (transferencia, USDT, otro)?',
      '¿Hay alguien más que tenga que aprobar la inversión antes de avanzar?',
      '¿Tenés una fecha objetivo de lanzamiento? (define la urgencia)',
    ],
    dolor: 'Miedo a pagar y "que no pase nada" o a contratar a alguien que desaparezca.',
    identificar: 'Frases como "¿y si no me gusta?", pedir garantías, demorar el pago. Escuchá la objeción real detrás del precio.',
    solucion: 'Acuerdo de buena fe claro + proceso por etapas con aprobación en cada una. La seña compra previsibilidad, no una promesa.',
    listo: ['Seña del 50% acreditada', 'Cliente confirmó el alcance del Acuerdo', 'Fecha de arranque definida'],
  },
  'Registrar el proyecto en el CRM': {
    que: 'Dar de alta al cliente y el servicio en la sección Clientes con valor, moneda y estado.',
    como: 'Cargar nombre, contacto, el servicio vendido, monto y % cobrado. Queda todo trazado para métricas y cobros.',
    listo: ['Cliente creado en el CRM', 'Servicio con monto y moneda cargado', 'Seña reflejada como cobrada'],
  },
  'Agendar llamada de kickoff': {
    que: 'Reunión de arranque para alinear expectativas, plazos y completar el Brief en vivo. Marca el tono profesional del proyecto.',
    como: 'Agendá 45-60 min por videollamada. Mandá agenda previa. Objetivo: salir con el Brief lleno y un cronograma acordado.',
    preguntas: [
      'Contame tu negocio con tus palabras, como se lo explicarías a un amigo.',
      '¿Cómo sería el éxito de esta web para vos en 90 días? (objetivo medible)',
      '¿Quiénes participan de las decisiones y quién aprueba lo final? (stakeholders)',
      '¿Qué te frustró de experiencias o webs anteriores?',
      '¿Cómo podríamos arruinar este proyecto? (revela riesgos y recursos faltantes)',
    ],
    dolor: 'No saber por dónde empezar y miedo a un proceso desordenado o que se eternice.',
    identificar: 'Respuestas vagas sobre objetivos, varios "jefes" sin un decisor claro, expectativas no dichas.',
    solucion: 'Una llamada estructurada con agenda y un proceso por fases visible (el mapa) le da control y confianza desde el día 1.',
    listo: ['Brief completado en la llamada', 'Decisor y plazos acordados', 'Próximos pasos claros para ambas partes'],
  },

  // ───── FASE 1 — Setup & Organización ─────
  'Crear carpeta raíz en Google Drive': {
    que: 'La estructura de carpetas del cliente: "01 Fotos y Videos" (sube el cliente) y "02 Documentación".',
    como: 'Se crea automático desde el botón del dashboard. Compartir el link con el cliente para que cargue su material.',
    listo: ['Carpeta del cliente creada', 'Subcarpetas 01 y 02 presentes', 'Link compartido con el cliente'],
  },
  'Crear grupo de WhatsApp': {
    que: 'Canal único de comunicación con el cliente para centralizar todo y evitar mensajes dispersos.',
    como: 'Crear el grupo, sumar al cliente y a tu socio, pegar el link de invitación en el slot. Fijar un mensaje con links clave.',
    listo: ['Grupo creado con cliente y equipo', 'Link guardado en el dashboard', 'Mensaje de bienvenida enviado'],
  },
  'Enviar Acuerdo de buena fe': {
    que: 'Documento que define alcance, qué incluye/qué no, responsabilidades y pagos. Evita malentendidos.',
    como: 'Generar el Acuerdo desde el dashboard (botón Generar), revisarlo y enviarlo. Pedir confirmación por escrito.',
    dolor: 'Miedo a "letra chica" o a que después le cobren cosas que creía incluidas.',
    identificar: 'Preguntas sobre qué pasa si pide cambios, costos ocultos, mantenimiento.',
    solucion: 'El Acuerdo lista explícitamente "lo que NO incluye" y cómo se cotizan los extras: transparencia total.',
    listo: ['Acuerdo enviado', 'Cliente confirmó lectura y conformidad', 'Dudas de alcance resueltas'],
  },
  'Solicitar accesos y credenciales': {
    que: 'Recolectar los accesos necesarios (dominio, redes, hosting, etc.) para poder trabajar sin frenos.',
    como: 'Pedir solo lo necesario, guardarlo en el documento de Credenciales. Recomendá un gestor de contraseñas para lo sensible.',
    preguntas: [
      '¿Ya tenés dominio comprado? ¿A nombre de quién y en qué proveedor?',
      '¿Tenés accesos a tus redes y a tu hosting actual?',
      '¿Quién maneja hoy esos accesos dentro de tu equipo?',
    ],
    dolor: 'Inseguridad al compartir contraseñas; o directamente no saber dónde están sus accesos.',
    identificar: 'Demoras en pasar accesos, "se lo tengo que pedir a alguien", desconocimiento de su propio dominio.',
    solucion: 'Pedir lo mínimo, explicar para qué sirve cada acceso y ofrecer gestionarlo de forma segura.',
    listo: ['Accesos críticos recibidos', 'Guardados de forma segura', 'Titularidad del dominio confirmada'],
  },

  // ───── FASE 2 — Discovery & Brief ─────
  'Completar el Brief de marca': {
    que: 'El documento rector de la marca: posicionamiento, público, tono, diferenciales. Alimenta el copy, el diseño y a la IA.',
    como: 'Cargar en el dashboard lo que salió de la reunión (sección Datos del cliente) y generar el Brief. Un buen brief = un buen proyecto.',
    preguntas: [
      '¿Qué problema concreto le resolvés a tu cliente?',
      '¿Por qué te eligen a vos y no a la competencia? (3-5 diferenciales)',
      '¿Qué acción tiene que hacer alguien que entra a la web? (comprar, agendar, escribir)',
      '¿Qué webs te gustan y por qué? ¿Cuáles odiás?',
      '¿Qué NO querés que transmita tu marca?',
    ],
    dolor: 'Su presencia digital no refleja lo bueno que es su servicio; se ve "uno más" o genérico.',
    identificar: 'Usá la cadena de "por qué" (5 Whys) para llegar a la raíz. Cuantificá: "¿cuántas consultas perdés por mes por esto?".',
    solucion: 'El Brief ordena y jerarquiza su autoridad real en un activo digital; el copy y el diseño salen de ahí, no de la nada.',
    listo: ['Brief generado y revisado', 'Diferenciales y público claros', 'Objetivo medible definido'],
  },
  'Armar la Base de conocimiento IA': {
    que: 'Las reglas para que el contenido generado con IA suene a la marca y NO a "IA genérica".',
    como: 'Definir tono, palabras que sí/no usa, do/don\'ts y datos duros. Se usa al construir el copy y la web con Claude Code.',
    dolor: 'Miedo a quedar como "hecho con ChatGPT", impersonal o igual a todos.',
    identificar: 'Comentarios sobre webs que "se notan genéricas" o frustración con contenido sin personalidad.',
    solucion: 'Una base de tono + ejemplos reales hace que cada texto suene a ellos y no a una plantilla.',
    listo: ['Tono y do/don\'ts definidos', 'Lista de palabras a usar/evitar', 'Datos duros de la marca cargados'],
  },
  'Recolectar fotos, videos y logos': {
    que: 'El material visual real del cliente: fotos propias, video, logo en alta. La materia prima del diseño.',
    como: 'El cliente sube todo a "01 Fotos y Videos". Si no tiene material de calidad, definir alternativa (banco curado o producción aparte).',
    dolor: 'No tiene fotos buenas y le da vergüenza/inseguridad; teme que la web se vea pobre.',
    identificar: 'Manda pocas fotos, de baja calidad o de stock. Demora en subir material.',
    solucion: 'Guiarlo sobre qué fotos sacar (o recomendar un fotógrafo); usar lo real siempre que se pueda para autenticidad.',
    listo: ['Logo en alta recibido', 'Fotos/videos suficientes y de calidad', 'Material organizado en Drive'],
  },

  // ───── FASE 3 — Diseño ─────
  'Cliente envía referencias de diseño': {
    que: 'Webs/estilos que le gustan al cliente, como norte visual del diseño.',
    como: 'Pedir 2-3 referencias y preguntar QUÉ le gusta de cada una (no copiar, inspirarse). Acordar la dirección visual.',
    preguntas: [
      '¿Qué webs te encantan y qué te gusta puntualmente de cada una?',
      '¿Preferís algo minimalista y elegante o más vivo y audaz?',
      '¿Hay algún estilo o color que NO quieras ver sí o sí?',
    ],
    dolor: '"No sé explicar lo que quiero, pero lo reconozco cuando lo veo."',
    identificar: 'Referencias contradictorias o muy genéricas; le cuesta verbalizar el gusto.',
    solucion: 'Traducir sus referencias en una dirección visual concreta (paleta + tipografía + estilo) y validarla antes de maquetar.',
    listo: ['2-3 referencias recibidas', 'Dirección visual acordada', 'Paleta y tipografía validadas'],
  },
  'Construir el diseño': {
    que: 'El diseño a medida de la web, tomando la dirección visual y el brief.',
    como: 'Pasar el brief + referencias a Claude Code para una base parecida y a medida; iterar sobre eso, no desde cero.',
    listo: ['Diseño base de todas las secciones', 'Responsive (móvil) contemplado', 'Coherente con el brief'],
  },
  'Revisión de diseño con el cliente': {
    que: 'Mostrar el diseño y aplicar correcciones (hasta 2 rondas, según el Acuerdo).',
    como: 'Presentar en vivo, explicar las decisiones, anotar feedback concreto. Cerrar cada ronda con aprobación escrita.',
    preguntas: [
      '¿Esto representa cómo querés que te vean? ¿Qué ajustarías?',
      '¿El mensaje principal se entiende en los primeros 5 segundos?',
      '¿Falta algo importante que tu cliente necesite ver?',
    ],
    dolor: 'Miedo a que el resultado no sea lo que imaginaba y a quedar "pegado" sin poder cambiarlo.',
    identificar: 'Feedback vago ("no sé, no me cierra"). Pedí concreción: qué, dónde, por qué.',
    solucion: 'Rondas de revisión pautadas y aprobación por etapa: control sin que el proyecto se vuelva infinito.',
    listo: ['Diseño presentado', 'Feedback aplicado', 'Aprobación escrita para desarrollar'],
  },

  // ───── FASE 4 — Desarrollo ─────
  'Desarrollo frontend': {
    que: 'Maquetar la web responsive, fiel al diseño aprobado, con buenas animaciones.',
    como: 'Construir mobile-first, componentes limpios, performance cuidada. Contenido de prueba hasta cargar el real.',
    listo: ['Todas las secciones maquetadas', 'Responsive impecable', 'Animaciones sutiles funcionando'],
  },
  'Desarrollo backend (funciones + seguridad)': {
    que: 'La lógica: formularios, envíos, validaciones y seguridad de los datos.',
    como: 'Implementar formularios con validación y notificación, proteger datos y endpoints. Probar casos de error.',
    listo: ['Formularios funcionando y notificando', 'Validaciones y seguridad OK', 'Sin datos sensibles expuestos'],
  },
  'Integración email marketing / base de datos': {
    que: 'Conectar la web con la herramienta del cliente (Supabase, MailerLite, etc.) si la necesita.',
    como: 'Definir a dónde van los leads y automatizar (alta a lista, email de bienvenida). Solo si está en el alcance.',
    preguntas: [
      '¿Querés que los contactos se guarden y/o entren a una lista de emails?',
      '¿Ya usás alguna herramienta de email marketing o arrancamos de cero?',
    ],
    listo: ['Destino de leads definido', 'Integración probada de punta a punta', 'Email/automatización funcionando'],
  },

  // ───── FASE 5 — SEO & AEO ─────
  'SEO técnico': {
    que: 'Optimización para buscadores: meta tags, Open Graph, sitemap, robots, performance.',
    como: 'Cargar metadata por página, sitemap.xml, datos estructurados, optimizar Core Web Vitals.',
    listo: ['Meta tags y OG por página', 'Sitemap y robots OK', 'Core Web Vitals en verde'],
  },
  'AEO/GEO — que las IAs la recomienden': {
    que: 'Optimización para que ChatGPT, Perplexity y Google AI puedan citar y recomendar la web. El diferencial de MYB.',
    como: 'Crear llms.txt, escribir "answer blocks" (regla 50 palabras), FAQ + HowTo schema, JSON-LD, permitir crawlers de IA.',
    dolor: 'El cliente no sabe que las IAs ya derivan clientes y que su web es invisible para ellas.',
    identificar: 'Nadie de la competencia lo ofrece. Mostrale buscando su rubro en ChatGPT/Perplexity qué aparece (y qué no).',
    solucion: 'Dejar la web lista para ser citada por IAs: una ventaja que hoy casi nadie en Córdoba ofrece.',
    listo: ['llms.txt publicado', 'FAQ/HowTo schema + JSON-LD', 'Contenido en bloques de respuesta'],
  },
  'Test de velocidad y accesibilidad': {
    que: 'Verificar que la web carga rápido y es usable por todos.',
    como: 'Correr Lighthouse/PageSpeed, corregir lo que baje el puntaje (imágenes, fuentes, contraste, foco).',
    listo: ['Lighthouse > 90 en performance', 'Accesibilidad básica OK', 'Probada en 3G/móvil'],
  },

  // ───── FASE 6 — Lanzamiento ─────
  'Comprar / configurar el dominio': {
    que: 'Registrar o conectar el dominio del cliente y apuntar el DNS.',
    como: 'Idealmente a nombre del cliente. Configurar DNS, esperar propagación, verificar SSL.',
    listo: ['Dominio activo a nombre del cliente', 'DNS apuntado', 'SSL (HTTPS) funcionando'],
  },
  'Setup de analítica': {
    que: 'Medir visitas y conversiones desde el día 1 (GA4 o Plausible).',
    como: 'Instalar el tag, configurar el evento de conversión (formulario/WhatsApp) y verificar que registra.',
    listo: ['Analítica instalada', 'Evento de conversión configurado', 'Datos llegando correctamente'],
  },
  'Deploy a producción': {
    que: 'Publicar la web en el dominio final, lista para el público.',
    como: 'Deploy, revisar variables/entorno, confirmar que todo carga en el dominio real.',
    listo: ['Web en vivo en el dominio', 'Sin errores de consola', 'Formularios probados en producción'],
  },
  'QA final en producción': {
    que: 'Revisión final en el sitio real, en móvil y desktop.',
    como: 'Checklist: links, formularios, velocidad, ortografía, metadatos, favicon. Probar en varios navegadores.',
    listo: ['Todo funciona en móvil y desktop', 'Sin links rotos ni typos', 'Formularios llegan a destino'],
  },

  // ───── FASE 7 — Cierre & Retención ─────
  'Grabar video walkthrough (Loom)': {
    que: 'Un video corto mostrando la entrega y cómo usar/editar la web. Eleva la percepción de profesionalismo.',
    como: 'Grabar 3-5 min recorriendo la web y el panel/CMS. Compartir el link junto a la guía de uso.',
    listo: ['Video grabado y compartido', 'Cubre cómo editar contenido', 'Cliente confirmó que lo vio'],
  },
  'Entregar guía de uso / admin': {
    que: 'Documento para que el cliente use lo entregado sin depender de nosotros.',
    como: 'Completar la Guía de uso (accesos, cómo editar, FAQ, soporte) y entregarla.',
    listo: ['Guía entregada', 'Accesos finales traspasados', 'Cliente sabe cómo editar lo básico'],
  },
  'Cobrar el 50% restante': {
    que: 'El pago final, contra entrega / antes del lanzamiento definitivo.',
    como: 'Presentar el resultado, confirmar conformidad y cobrar el saldo. Recién ahí se traspasa propiedad total.',
    preguntas: [
      '¿Estás conforme con la entrega para cerrar el proyecto?',
      '¿Querés que hablemos de un plan de mantenimiento mensual?',
    ],
    dolor: 'Dudas de último momento o querer "una cosita más" antes de pagar.',
    identificar: 'Demora el pago final o suma pedidos fuera de alcance.',
    solucion: 'Mostrar el valor entregado vs. el Acuerdo; los extras se cotizan aparte (con transparencia, no fricción).',
    listo: ['50% final cobrado', 'Conformidad del cliente', 'Propiedad/accesos traspasados'],
  },
  'Enviar documento de Feedback': {
    que: 'Pedir feedback estructurado para mejorar y para conseguir el testimonio.',
    como: 'Enviar el documento de Feedback (encuesta corta). Leerlo y agradecer; usar lo bueno como testimonio.',
    preguntas: [
      'Del 1 al 10, ¿qué tan conforme quedaste? ¿Qué le falta para ser un 10?',
      '¿Qué fue lo que más te gustó del proceso?',
      '¿A quién conocés que necesite algo parecido? (referido)',
    ],
    dolor: 'El cliente no sabe si "molesta" pidiendo cambios o si el soporte termina acá.',
    identificar: 'Silencio post-entrega o dudas sobre qué pasa "de ahora en más".',
    solucion: 'El feedback abre la puerta a soporte/mantenimiento y deja la relación abierta, no cerrada.',
    listo: ['Feedback recibido', 'Puntos de mejora anotados', 'Pedido de referido hecho'],
  },
  'Pedir testimonio': {
    que: 'El activo de marketing más poderoso: la voz real de un cliente conforme.',
    como: 'Pedirlo en el momento de mayor satisfacción (post-entrega). Ideal en video; si no, texto + permiso de uso.',
    preguntas: [
      '¿Grabarías 30 seg contando cómo fue trabajar con nosotros?',
      '¿Te parece si uso tu testimonio y logo en nuestras redes y web?',
    ],
    dolor: 'Le da pereza o no sabe qué decir.',
    identificar: 'Dice "sí, después te paso" y no llega.',
    solucion: 'Darle un mini-guion de 3 preguntas y facilitarle todo: cuanto más fácil, más probable.',
    listo: ['Testimonio obtenido (texto o video)', 'Permiso de uso confirmado', 'Guardado para marketing'],
  },
  'Check-in a 30 días': {
    que: 'Contacto al mes para ver resultados y abrir mantenimiento/mejoras. Donde nace el ingreso recurrente.',
    como: 'Escribir/llamar, revisar métricas (visitas, consultas), proponer mejoras o un plan mensual.',
    preguntas: [
      '¿Cómo viene funcionando la web? ¿Llegaron consultas?',
      '¿Querés que la mantengamos optimizada y actualizada todos los meses?',
    ],
    dolor: 'Después del lanzamiento la web "queda quieta" y pierde efectividad.',
    identificar: 'No mira las métricas, no actualiza nada, no sabe si le sirve.',
    solucion: 'Un plan de mantenimiento mensual: optimización continua = resultados sostenidos y un cliente que no se va.',
    listo: ['Check-in realizado', 'Métricas revisadas con el cliente', 'Propuesta de mantenimiento ofrecida'],
  },
};
