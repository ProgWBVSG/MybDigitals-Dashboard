// Biblioteca de ganchos y frameworks de guionismo.
//
// Datos estáticos (no van a la base): son el marco de referencia que se consulta
// mientras se escribe. Cada gancho trae la plantilla, cuándo usarlo y un ejemplo
// aplicado al rubro de MYB para que se entienda el molde, no para copiarlo.

// ─── LAS 3 CAPAS DEL HOOK ───
// El 85% mira sin sonido: si las tres capas no dicen lo mismo, la primera se pierde.
export const HOOK_LAYERS = [
  { key: 'verbal', label: 'Verbal', icon: '🗣️', what: 'Lo que decís en los primeros 3 segundos.', rule: 'Una sola idea. Sin preámbulo, sin "hola chicos".' },
  { key: 'visual', label: 'Visual', icon: '👁️', what: 'Lo que se ve antes de que se procese el audio.', rule: 'Tiene que frenar el scroll por sí solo. Movimiento, contraste o algo fuera de lugar.' },
  { key: 'texto', label: 'Texto en pantalla', icon: '📝', what: 'Lo que se lee sin sonido.', rule: 'Máximo 6-8 palabras. Debe decir lo MISMO que el verbal, no complementarlo.' },
] as const;

// ─── FÓRMULAS DE HOOK VERBAL ───
export interface HookFormula {
  key: string; label: string; template: string; when: string; example: string;
  driver: 'dolor' | 'ganancia' | 'curiosidad';
}

export const HOOK_FORMULAS: HookFormula[] = [
  { key: 'secreto', label: 'Secreto / Revelación', driver: 'curiosidad',
    template: 'Nadie te dice que [verdad incómoda] — y por eso [consecuencia].',
    when: 'Cuando tenés información que el nicho asume mal. Funciona en audiencia consciente del problema.',
    example: 'Nadie te dice que el algoritmo no mira los likes — y por eso seguís optimizando lo que no importa.' },
  { key: 'contrarian', label: 'Contrarian', driver: 'curiosidad',
    template: 'Todos dicen [creencia común]. Están equivocados, y te muestro por qué.',
    when: 'Genera comentarios porque fuerza a tomar posición. Necesitás poder defenderlo con datos.',
    example: 'Todos dicen que hay que postear todos los días. Es la razón por la que tu cuenta no crece.' },
  { key: 'error', label: 'Error / Advertencia', driver: 'dolor',
    template: 'Si [hacés X], estás [perdiendo Y] sin darte cuenta.',
    when: 'Nivel de consciencia bajo: el que mira no sabe que tiene el problema.',
    example: 'Si respondés los DM a mano, estás perdiendo entre 10 y 15 horas por mes sin darte cuenta.' },
  { key: 'costo', label: 'Costo oculto', driver: 'dolor',
    template: '¿Sabés cuánto te cuesta [problema que parece gratis]?',
    when: 'Para pasar de inconsciente a consciente del problema. Muy fuerte con números.',
    example: '¿Sabés cuánto te cuesta cada consulta que contestás dos veces?' },
  { key: 'caso', label: 'Case study', driver: 'ganancia',
    template: '[Sujeto] pasó de [antes] a [después] en [tiempo]. Así lo hizo.',
    when: 'Prueba social concreta. Necesitás el número real, si no suena inventado.',
    example: 'Una cafetería de Córdoba bajó de 40 a 8 horas de atención por mes. Te muestro el sistema.' },
  { key: 'lista', label: 'Lista / Listicle', driver: 'ganancia',
    template: '[N] [cosas] que [beneficio], y la [N] casi nadie la usa.',
    when: 'Alta tasa de guardados. El número tiene que ser chico (3-5) para que se pueda cumplir.',
    example: '3 herramientas gratis para escribir hooks, y la tercera casi nadie la usa.' },
  { key: 'comparacion', label: 'Comparación', driver: 'curiosidad',
    template: '[A] vs [B]: la diferencia que cambia todo.',
    when: 'Cuando el nicho ya evalúa opciones (nivel solución/producto).',
    example: 'Contenido de valor vs contenido de venta: por qué necesitás los dos y en qué proporción.' },
  { key: 'pregunta', label: 'Pregunta directa', driver: 'curiosidad',
    template: '¿Por qué [situación frustrante] aunque [hacés todo bien]?',
    when: 'Cuando el dolor es específico y reconocible. Evitá preguntas de sí/no.',
    example: '¿Por qué tus reels no despegan aunque el contenido esté bueno?' },
  { key: 'escenario', label: 'Escenario / Hipotético', driver: 'ganancia',
    template: 'Imaginate que [situación deseada]. Es más cerca de lo que pensás.',
    when: 'Para audiencia que ya quiere el resultado pero no cree que sea posible.',
    example: 'Imaginate abrir Instagram y tener 12 consultas esperando. Sin haber contestado ninguna.' },
  { key: 'ranking', label: 'Ranking', driver: 'curiosidad',
    template: 'De peor a mejor: [N] formas de [hacer algo].',
    when: 'Retiene bien porque genera expectativa por el primer puesto.',
    example: 'De peor a mejor: 5 formas de conseguir clientes con Instagram.' },
  { key: 'autoridad', label: 'Autoridad / Prueba', driver: 'ganancia',
    template: 'Después de [experiencia cuantificada], esto es lo único que importa.',
    when: 'Requiere credencial real. Sin número específico suena vacío.',
    example: 'Después de auditar 40 cuentas de pymes, esto es lo único que movió la aguja.' },
  { key: 'personal', label: 'Experiencia personal', driver: 'curiosidad',
    template: 'Cometí [error] y me costó [consecuencia]. No lo repitas.',
    when: 'Construye confianza rápido. El error tiene que ser real y específico.',
    example: 'Gasté tres meses haciendo contenido que nadie compartía. El problema era uno solo.' },
  { key: 'negativo', label: 'Negativo / Prohibición', driver: 'dolor',
    template: 'No [hagas X] hasta que [condición].',
    when: 'Corta el scroll por interrupción de patrón. Usar poco, se gasta.',
    example: 'No inviertas un peso en anuncios hasta que tengas esto resuelto.' },
];

// ─── MECÁNICAS DE HOOK VISUAL ───
export const VISUAL_HOOKS: { category: string; items: string[] }[] = [
  { category: 'Movimiento del sujeto', items: [
    'Entrás caminando hacia la cámara', 'Te acercás muy rápido al lente', 'Girás de espaldas a cámara',
    'Señalás algo fuera de plano', 'Arrancás en medio de una acción (no desde el reposo)',
    'Cambio brusco de postura al decir el hook',
  ]},
  { category: 'Gráficos y overlays', items: [
    'Número gigante en pantalla', 'Flecha que apunta al dato', 'Tachado sobre la creencia falsa',
    'Contador que sube o baja', 'Antes/después dividido en pantalla', 'Círculo rojo marcando el detalle',
  ]},
  { category: 'Selección visual', items: [
    'Objeto inesperado en la mano', 'Pantalla del celu/compu mostrando el problema real',
    'Papel escrito a mano', 'Locación que no corresponde al tema', 'Captura de un DM o comentario real',
  ]},
  { category: 'Interrupción de patrón', items: [
    'Arrancar a mitad de frase', 'Silencio de medio segundo antes del hook',
    'Mirar a cámara sin hablar', 'Zoom brusco', 'Cortar el plano en el segundo 1',
  ]},
  { category: 'Efectos y transiciones', items: [
    'Corte seco cada 2 segundos', 'Zoom progresivo durante todo el hook',
    'Cambio de color/filtro al revelar el punto', 'Texto que aparece palabra por palabra',
  ]},
];

// ─── NIVELES DE SOFISTICACIÓN DE MERCADO (Eugene Schwartz) ───
// Define cuánto hay que trabajar el ángulo: cuanto más gastado el mercado, más
// abajo estás y menos alcanza con prometer el resultado.
export const SOPHISTICATION = [
  { level: 1, label: 'Ser el primero', claim: 'La promesa directa alcanza.', signal: 'Nadie más lo ofrece en tu mercado.', angle: 'Decí qué hace, sin adornos.' },
  { level: 2, label: 'Expandir la promesa', claim: 'Más grande, más rápido, mejor.', signal: 'Aparecieron competidores con la misma promesa.', angle: 'Amplificá el resultado, poné número.' },
  { level: 3, label: 'Mecanismo único', claim: 'El CÓMO importa más que el qué.', signal: 'Las promesas ya están gastadas, nadie las cree.', angle: 'Nombrá tu método. Dale nombre propio al proceso.' },
  { level: 4, label: 'Mecanismo expandido', claim: 'El mecanismo nuevo o mejorado.', signal: 'Copiaron tu mecanismo.', angle: 'Actualizá o especificá: qué tiene el tuyo que el copiado no.' },
  { level: 5, label: 'Identificación', claim: 'Quién sos vos, no qué vendés.', signal: 'Todo está gastado. Solo queda la identidad.', angle: 'Hablale a la identidad del que mira: "para los que ya probaron todo".' },
] as const;

// ─── LÓGICA DOLOR → GANANCIA ───
// Regla base: el dolor mueve al que NO sabe que tiene un problema; la ganancia
// mueve al que ya está buscando solución.
export const DRIVER_LOGIC = [
  { desire: 'Hacer más dinero',
    dolor: ['Gastar presupuesto sin saber en qué se fue', 'Perder clientes por no responder a tiempo', 'Usar tácticas que la plataforma ya penaliza'],
    ganancia: ['Un sistema que convierte inversión en retorno medible', 'Resultados que se pueden mostrar con números', 'Previsibilidad en vez de meses buenos y malos'] },
  { desire: 'Ahorrar tiempo',
    dolor: ['Rehacer el mismo proceso con cada cliente', 'Depender de tutoriales que caducan', 'Contestar la misma pregunta veinte veces'],
    ganancia: ['Un proceso que se repite sin pensarlo', 'Automatizar lo que no necesita tu criterio', 'Recuperar las horas que se van en lo operativo'] },
  { desire: 'Ser reconocido',
    dolor: ['Competir por precio con cualquiera', 'Que pidan descuento antes de escuchar la propuesta', 'Ser una opción más, sin diferencia clara'],
    ganancia: ['Que te busquen por nombre', 'Cobrar sin justificar el precio', 'Ser la primera opción del rubro'] },
] as const;

// ─── FORMATOS NARRATIVOS ───
export const NARRATIVES: { key: string; label: string; kind: 'educativo' | 'storytelling'; steps: string[] }[] = [
  { key: 'error_comun', label: 'Error común', kind: 'educativo', steps: ['Nombrar el error', 'Por qué todos lo cometen', 'Qué consecuencia tiene', 'La corrección concreta', 'Ejemplo aplicado'] },
  { key: 'listicle', label: 'Lista numerada', kind: 'educativo', steps: ['Prometer el número', 'Ítem 1 con valor real', 'Ítem 2', 'Ítem 3 (el más fuerte al final)', 'CTA sobre el recurso completo'] },
  { key: 'como_hacer', label: 'Cómo hacer X', kind: 'educativo', steps: ['El resultado que se logra', 'Paso 1', 'Paso 2', 'Paso 3', 'El error a evitar en el proceso'] },
  { key: 'mito', label: 'Mito vs realidad', kind: 'educativo', steps: ['Enunciar el mito', 'Por qué se cree', 'El dato que lo desarma', 'Qué es cierto en su lugar'] },
  { key: 'comparacion', label: 'Comparación A vs B', kind: 'educativo', steps: ['Presentar las dos opciones', 'Criterio de comparación', 'Dónde gana A', 'Dónde gana B', 'Cuál elegir según el caso'] },
  { key: 'desglose', label: 'Desglose de un caso', kind: 'educativo', steps: ['El resultado logrado', 'Punto de partida', 'La decisión clave', 'Qué se puede replicar'] },
  { key: 'antes_despues', label: 'Antes / Después', kind: 'storytelling', steps: ['Cómo era', 'El momento de quiebre', 'Qué cambió', 'Cómo es ahora', 'Qué le sirve al que mira'] },
  { key: 'fracaso', label: 'Fracaso y aprendizaje', kind: 'storytelling', steps: ['El intento', 'El fracaso concreto', 'Qué costó', 'La lección', 'Cómo se aplica'] },
  { key: 'dia_en_vida', label: 'Un día en la vida', kind: 'storytelling', steps: ['Arranca la escena', 'La tensión del día', 'El punto de valor escondido en la rutina', 'Cierre que conecta con el que mira'] },
  { key: 'confesion', label: 'Confesión', kind: 'storytelling', steps: ['Admitir algo incómodo', 'Por qué lo hacías', 'Qué te hizo cambiar', 'La versión correcta'] },
];

// ─── CTAs ───
export const CTAS: { category: 'seguir' | 'interaccion' | 'leads'; label: string; text: string; when: string }[] = [
  { category: 'seguir', label: 'Seguir por continuidad', text: 'Seguime que mañana subo la segunda parte.', when: 'Cuando el tema da para serie.' },
  { category: 'seguir', label: 'Seguir por identidad', text: 'Si te sirvió, acá hago esto todas las semanas.', when: 'Cierre suave, no interrumpe.' },
  { category: 'interaccion', label: 'Pregunta binaria', text: '¿Vos de qué lado estás? Contame abajo.', when: 'Cuando el tema divide opiniones.' },
  { category: 'interaccion', label: 'Pedir el caso propio', text: 'Contame en qué te trabás y lo respondo.', when: 'Genera comentarios largos y alimenta ideas.' },
  { category: 'interaccion', label: 'Guardar para después', text: 'Guardalo, lo vas a necesitar cuando te pase.', when: 'Sube la tasa de guardados directamente.' },
  { category: 'leads', label: 'Palabra clave a DM', text: 'Comentá "[PALABRA]" y te lo mando por privado.', when: 'El más efectivo para leads. Una sola palabra, en mayúscula.' },
  { category: 'leads', label: 'DM directo', text: 'Mandame DM con "[PALABRA]" y lo vemos.', when: 'Cuando querés conversación, no descarga.' },
  { category: 'leads', label: 'Recurso en bio', text: 'El link está en la bio.', when: 'El más débil de los tres. Usalo solo si ya te siguen.' },
];

// ─── CHECKLIST DE PRODUCCIÓN ───
export const PRODUCTION_CHECKS = [
  { phase: 'Guion', items: ['El hook dice una sola idea', 'Las 3 capas dicen lo mismo', 'Hay re-hook en el segundo 3-7', 'El valor llega antes del segundo 12', 'El punto central se explica dos veces', 'Hay un solo CTA'] },
  { phase: 'Grabación', items: ['Audio limpio (sin eco ni viento)', 'Encuadre vertical 9:16', 'Cara iluminada de frente', 'Tomas cortas grabadas por separado', 'Al menos 2 variantes del hook'] },
  { phase: 'Edición', items: ['Corte en el primer segundo', 'Texto en pantalla en el hook', 'Subtítulos en todo el video', 'Sin silencios muertos', 'Loop: el final conecta con el inicio'] },
  { phase: 'Publicación', items: ['Copy con el gancho repetido', 'Hashtags del nicho (no genéricos)', 'Portada legible en la grilla', 'Publicado en horario de la audiencia'] },
];
