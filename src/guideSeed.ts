import type { GuideTopic } from './utils';

// Contenido inicial de la Guía. Se siembra una sola vez (cuando la tabla está vacía).
// Todo es editable desde la app; los videos se cargan pegando links de YouTube/Instagram.
type Seed = Omit<GuideTopic, 'id' | 'createdAt' | 'updatedAt'>;

export const GUIDE_SEED: Seed[] = [
  // ─── MARCA ───
  {
    category: 'marca', order: 0, emoji: '🧠', title: 'Brief de marca',
    summary: 'El documento que hace que entendamos (y que Claude Code entienda) la marca del cliente.',
    content: `## Qué es
El **brief** es la radiografía de la marca: qué hace, a quién le vende, qué la diferencia, su tono y sus objetivos. Es la base de TODO el proyecto.

## Por qué importa
Si el brief está bien hecho, cuando armamos la web con **Claude Code** la IA "entiende" la marca y no produce algo genérico. Un buen brief = una web a medida; un brief flojo = una web más.

## Qué tiene que tener
- **Qué hace** el negocio, hace cuánto, su historia.
- **Cliente ideal**: a quién le vende, perfil, zona.
- **Dolor y objetivo**: qué le duele hoy y qué quiere lograr.
- **Diferencial**: por qué elegirlo a él y no a la competencia.
- **Tono de voz**: cómo habla la marca (cercano, técnico, premium...).
- **Do / Don't**: qué SÍ y qué NO decir, para no sonar a IA.

## Cómo lo usamos
Lo cargamos en el **Discovery** del onboarding y se genera automático con IA. De ahí sale el contexto que le pasamos a Claude Code para construir.`,
    resources: [],
  },
  {
    category: 'marca', order: 1, emoji: '⚡', title: 'Diferenciador: AEO / GEO',
    summary: 'Nuestro caballito de batalla: webs optimizadas para que ChatGPT y Perplexity las recomienden.',
    content: `## La idea
**AEO (Answer Engine Optimization)** / **GEO (Generative Engine Optimization)** es optimizar la web para que los buscadores con IA (ChatGPT, Perplexity, Gemini) la **citen y recomienden**. Casi nadie en Córdoba lo ofrece todavía → es un argumento de venta potente.

## Qué incluye en la práctica
- \`llms.txt\` en la raíz del sitio.
- **Answer blocks**: respuestas claras y autocontenidas (regla de las ~50 palabras).
- **FAQ + HowTo schema** (datos estructurados / JSON-LD).
- Permitir el crawl de los bots de IA.
- Contenido que responde preguntas reales del cliente final.

## Cómo venderlo
"Tu web no solo va a estar en Google: va a estar preparada para que cuando alguien le pregunte a ChatGPT por tu rubro, te recomiende a vos."`,
    resources: [],
  },
  {
    category: 'marca', order: 2, emoji: '💎', title: 'Propuesta de valor',
    summary: 'Cómo comunicamos qué ofrecemos para que se entienda y se elija.',
    content: `## Estructura MYB
Portada → **Diagnóstico** (entendemos tu situación y tu dolor) → **Pilares** de la solución → una sección por pilar (beneficios concretos) → inversión → próximos pasos.

## Reglas
- Hablar de **beneficios concretos**, no de features.
- Basarse en los datos reales del cliente (no inventar).
- Tono experto, claro y cercano. Nada de promesas mágicas.
- Una idea por pantalla, con aire.

## En el dashboard
Se genera con IA desde la pestaña **Pre-venta** y se comparte con un link de 30 días que solo muestra la presentación.`,
    resources: [],
  },

  // ─── COMERCIAL ───
  {
    category: 'comercial', order: 0, emoji: '🎣', title: 'Pre-venta y calificación MINT',
    summary: 'Cómo calificar un prospecto antes de gastar tiempo en propuestas.',
    content: `## El pipeline
Prospección → Contacto → Agendado → Reunión → Calificación → Propuesta → Ganado/Perdido.

## MINT (calificación)
- **M**oney: ¿tiene presupuesto?
- **I**nfluence: ¿habla con quien decide?
- **N**eed: ¿tiene una necesidad real y urgente?
- **T**ime: ¿hay un plazo / urgencia?

Si MINT está flojo, no inviertas horas en una propuesta elaborada. Calificá primero.

## Reunión de discovery
Escuchá más de lo que hablás. Sacá el dolor real, el objetivo y el diferencial. Eso alimenta el brief y la propuesta.`,
    resources: [],
  },
  {
    category: 'comercial', order: 1, emoji: '📑', title: 'Cómo armar la propuesta',
    summary: 'De la reunión a una presentación que cierra.',
    content: `## Antes de generar
Cargá TODA la info en "Datos para la propuesta": qué hace, dolor, objetivo, servicio, diferencial. Si falta algo clave, el botón no se habilita (así no arma cualquier cosa).

## Diseño
Personalizá colores, logo y fotos de la marca del cliente. Sumá prueba social (métricas, testimonios) y, si podés, un video corto tuyo. La personalización es lo que hace que se sienta hecha para ÉL.

## Cierre
Botón "Quiero avanzar" → WhatsApp. Y seguí el tracking: el dashboard te dice si abrió la propuesta y cuántas veces.`,
    resources: [],
  },
  {
    category: 'comercial', order: 2, emoji: '🛡️', title: 'Manejo de objeciones',
    summary: 'Las objeciones más comunes y cómo responderlas.',
    content: `## Las clásicas
- **"Es caro"** → reencuadrá a inversión y retorno. ¿Cuánto vale un cliente nuevo para él? La web se paga sola.
- **"Lo tengo que pensar"** → ¿qué te falta para decidir? Sacá la duda real.
- **"Ya tengo Instagram"** → IG no es tuyo y no convierte como una web; es alquilar vs. tener tu casa.
- **"Lo hace mi sobrino más barato"** → diferenciá: estrategia, AEO, soporte, resultados — no es solo "una web".

## Regla
La objeción es información, no un "no". Preguntá para entender qué hay detrás.`,
    resources: [],
  },
  {
    category: 'comercial', order: 3, emoji: '🏷️', title: 'Pricing y paquetes',
    summary: 'Productizar: vender procesos con precio claro, no horas.',
    content: `## Idea
Cada servicio = un **paquete** con precio fijo, plazo y entregables claros. Vendés un resultado, no horas.

## Modalidad
50% al inicio, 50% contra entrega y aprobación. Registrá los hitos de pago en el onboarding para no perderlos de vista.

## Recurrencia
El verdadero ingreso está en el **mantenimiento/retainer** post-lanzamiento y el check-in a 30 días (upsell).`,
    resources: [],
  },

  // ─── ENTREGA ───
  {
    category: 'entrega', order: 0, emoji: '🚀', title: 'Onboarding Landing Page',
    summary: 'El playbook de 8 fases que se ejecuta igual de bien en cada cliente.',
    content: `## Las fases
1. **Cierre & Pago** (seña 50%)
2. **Setup & Organización** (carpetas Drive, grupo WhatsApp, accesos)
3. **Discovery & Brief**
4. **Diseño**
5. **Desarrollo** (frontend, backend, seguridad)
6. **SEO & AEO**
7. **Lanzamiento** (dominio, deploy, QA)
8. **Cierre & Retención** (feedback, 50% restante, testimonio, check-in 30 días)

## Clave
Nunca arrancar de cero, nunca perder un paso. Cada paso tiene fecha límite (config en ⚙️) para mantener el ritmo. Si depende del cliente, el sistema te avisa para reclamarle.`,
    resources: [],
  },
  {
    category: 'entrega', order: 1, emoji: '📁', title: 'Documentos del cliente',
    summary: 'Qué documentos creamos y para qué sirve cada uno.',
    content: `## Los docs (en Drive, automático)
- **Acuerdo de buena fe**: alcance, plazos, 50/50.
- **Brief de marca**: la base IA-ready.
- **Base de conocimiento IA**: tono, do/don'ts.
- **Guía de uso/admin**: para que el cliente maneje su web.
- **Feedback**, **Testimonios**, **Credenciales**.

## Credenciales
⚠️ No guardar contraseñas reales en texto plano. Usar un gestor y dejar el link.`,
    resources: [],
  },

  // ─── TÉCNICO ───
  {
    category: 'tecnico', order: 0, emoji: '🤖', title: 'Skills de Claude Code',
    summary: 'Qué skills usar y cuándo, para construir mejor y más rápido.',
    content: `## Qué son
Las **skills** son capacidades extra que se le instalan a Claude Code (diseño, documentos, etc.) para que haga mejor ciertas tareas.

## Las que más usamos
- **frontend-design**: para que el diseño no quede "templated" y tenga identidad propia.
- **responsive-design**: layouts que andan perfecto en mobile.
- **docx / pdf / pptx**: generar documentos y presentaciones.
- **marketing-strategy / meta-ads**: estrategia y campañas.

## Tip
Antes de pedirle algo grande, decile qué skill usar. Y siempre pasale el **brief** para que entienda la marca.`,
    resources: [],
  },
  {
    category: 'tecnico', order: 1, emoji: '🔗', title: 'n8n y automatizaciones',
    summary: 'Conectar apps y automatizar procesos sin código (nuestro buque insignia).',
    content: `## Qué es
**n8n** es una herramienta de automatización (tipo Zapier pero self-hosted y más potente/barata). Conecta apps con "nodos": cuando pasa X, hacé Y.

## Ideas de automatización para vender
- Nuevo lead del formulario → mensaje automático de WhatsApp + alta en CRM.
- Pago recibido → factura + mensaje de gracias.
- Consulta frecuente → respuesta con IA y derivación si es compleja.
- Recordatorios y seguimientos automáticos.

## Para arrancar
n8n cloud o self-hosted (Docker). Empezá por una automatización simple y de alto dolor del cliente.`,
    resources: [],
  },
  {
    category: 'tecnico', order: 2, emoji: '🧩', title: 'APIs: cuándo conviene',
    summary: 'Qué es una API y cuándo usarla en un proyecto.',
    content: `## Qué es
Una **API** es la forma en que dos sistemas se hablan. Ej: nuestra web le pide datos a Supabase, o le pide a Gemini que genere un texto.

## Cuándo usarla
- Generar contenido con IA (Gemini/Claude).
- Cobros (Mercado Pago).
- Mensajería (WhatsApp Cloud API — paga).
- Datos en vivo (cotización, stock, etc.).

## Ojo con los secrets
Las claves de API NUNCA van en el frontend (se ven). Van en el servidor / Edge Functions de Supabase como **secrets**.`,
    resources: [],
  },
  {
    category: 'tecnico', order: 3, emoji: '🔒', title: 'Seguridad (RLS, secrets, auth)',
    summary: 'Lo mínimo para que un proyecto no quede expuesto.',
    content: `## Las 3 reglas de oro
1. **Auth + RLS**: la base de datos tiene que rechazar todo pedido sin sesión válida. Sin RLS, cualquiera con la clave pública lee/borra todo.
2. **Secrets en el servidor**: claves de API, tokens y contraseñas van en Edge Functions / variables de entorno, nunca en el código del navegador.
3. **La seguridad vive en el servidor**: cualquier validación que mande el navegador se puede trucar. Lo que protege de verdad es el backend (RLS/policies).

## En nuestro propio dashboard
Login real + RLS por email + sesión persistente. Aprendido en carne propia: una llave en el frontend se saca en 10 segundos desde "Inspeccionar".`,
    resources: [],
  },
  {
    category: 'tecnico', order: 4, emoji: '🧰', title: 'Apps y herramientas clave',
    summary: 'El stack que usamos y a tener en cuenta.',
    content: `## Desarrollo
- **Claude Code** (construcción) · **Vercel** (deploy) · **Supabase** (base + auth + storage + edge functions) · **GitHub** (código).

## Diseño
- **Figma** (diseño) · **Canva** (gráficas rápidas).

## Automatización & IA
- **n8n** · **Gemini / Claude API** · **WhatsApp Cloud API**.

## Gestión
- Este **dashboard** (pre-venta, onboarding, clientes, historial, guía).
- **Google Drive** (documentos del cliente, automático).

## Marketing
- **Meta Ads Manager** · herramientas de SEO/AEO.`,
    resources: [],
  },

  // ─── CRECIMIENTO ───
  {
    category: 'crecimiento', order: 0, emoji: '🔎', title: 'AEO / SEO',
    summary: 'Que te encuentren en Google y te recomiende la IA.',
    content: `## SEO técnico (base)
Meta tags, sitemap, velocidad (Core Web Vitals), mobile, contenido útil.

## AEO (el plus)
Ver el tema "Diferenciador: AEO/GEO". Es lo que nos distingue.

## Contenido
Respondé las preguntas reales que hace tu cliente final. Eso sirve para Google Y para la IA.`,
    resources: [],
  },
  {
    category: 'crecimiento', order: 1, emoji: '📣', title: 'Meta Ads',
    summary: 'Captar clientes con anuncios en Instagram/Facebook.',
    content: `## Aprendizajes
- Para **alcance/ThruPlay** es barato; para **conversión** es más caro.
- Funnel que funciona: contenido → comentario → DM → venta.
- Empezá con presupuestos chicos, medí y escalá lo que funciona.

## Para MYB
Mostrá resultados reales (antes/después, webs, testimonios). La prueba social vende.`,
    resources: [],
  },
  {
    category: 'crecimiento', order: 2, emoji: '🎬', title: 'Contenido y captación',
    summary: 'Cómo generar demanda constante.',
    content: `## Pilares
- **Mostrá el proceso**: webs que hacés, automatizaciones, antes/después.
- **Educá**: tips de presencia digital / IA para Pymes.
- **Prueba social**: testimonios y casos.

## Constancia > perfección
Mejor publicar seguido y simple que esperar la pieza perfecta.`,
    resources: [],
  },

  // ─── FINANZAS ───
  {
    category: 'finanzas', order: 0, emoji: '🧾', title: 'Facturación y cobros',
    summary: 'Mantener el orden de la plata.',
    content: `## Modalidad
50% al inicio, 50% contra entrega. Registrá cada cobro en el **Historial** con monto, fecha y **foto del comprobante**.

## Orden
- Cargá los hitos de pago en el onboarding → te avisa si hay un cobro pendiente o vencido.
- Revisá el resumen "cobrado" en el Historial por período (últimos 15 días, mes, etc.).
- Separá lo de la agencia de lo personal.`,
    resources: [],
  },
];
