// ─── MOTOR DE PLAYBOOKS ───
// Cada servicio define su proceso: fases → pasos, hitos de pago y documentos
// con contenido base editable. Al crear un onboarding, el hook "materializa"
// este template en filas reales de Supabase para poder tildar y personalizar.

import type { ServiceType, StepOwner, DocType, Discovery } from './utils';

export interface PlaybookStep {
  phase: number;
  phaseName: string;
  title: string;
  description: string;
  owner: StepOwner;
  isOptional?: boolean;
}

export interface PlaybookPayment {
  label: string;
  percentage: number;
}

export interface PlaybookDoc {
  docType: DocType;
  title: string;
  content: string;
}

export interface Playbook {
  serviceType: ServiceType;
  steps: PlaybookStep[];
  payments: PlaybookPayment[];
  documents: PlaybookDoc[];
}

// ─── DOCUMENTOS BASE (plantillas editables) ───

const DOC_ACUERDO = `# ACUERDO DE SERVICIOS DIGITALES
## [Tipo de proyecto — ej: Desarrollo de Landing Page Profesional]
### [Cliente] × Agencia MYB Digitals

**Fecha de emisión:** Córdoba, [mes y año]
**Modalidad:** Acuerdo de trabajo y alcance de servicios
**Vigencia:** Desde el inicio hasta la entrega del proyecto

> El presente documento establece el alcance, las condiciones y los límites del trabajo acordado entre las partes. No constituye un contrato legal vinculante, sino un **acuerdo de buena fe** que define con claridad qué se hace, qué no se hace, cómo se trabaja y cuáles son las responsabilidades de cada parte. Su propósito es evitar malentendidos y garantizar que el proyecto se desarrolle con transparencia, orden y respeto mutuo.

## 1. Las Partes
**EL CLIENTE**
- Nombre comercial: [Nombre / Marca]
- Sector: [rubro]
- Ubicación: [ciudad, país · alcance]
- Contacto: [teléfono · email]
- Redes: [Instagram / LinkedIn]

**EL PROVEEDOR**
- Agencia MYB Digitals
- Contacto: digitalmatiybenja@gmail.com
- Representado por: Matías König y Benjamín Vidal

## 2. Objetivos del Acuerdo
MYB Digitals se compromete a diseñar, desarrollar y entregar [el proyecto] para [Cliente], orientado a [objetivo principal]. [Describir la brecha que cierra el proyecto entre la autoridad/realidad del cliente y su presencia digital actual, y para qué va a usar el entregable.] El alcance completo está detallado en las secciones siguientes.

## 3. Lo que SÍ incluye este acuerdo
**[Producto principal — ej: Landing Page Profesional]**
- Diseño responsivo optimizado para todos los dispositivos (móvil, tablet, desktop).
- Arquitectura de contenido profesional con las secciones acordadas en el brief.
- Copywriting completo a partir del brief estratégico — **pieza central del entregable**.
- Paleta y estética alineadas a la identidad de marca (ver brief).
- Velocidad de carga optimizada (Core Web Vitals en verde).

**Funcionalidades técnicas**
- Formulario de contacto con validación y notificaciones automáticas.
- [Calendario integrado / CMS de blog / otras según el proyecto].
- Botones de llamada a la acción estratégicos.

**SEO y posicionamiento (incluye AEO/GEO)**
- Metadata optimizada para [palabras clave del rubro].
- Schema markup JSON-LD (ProfessionalService / Person / según corresponda).
- **Optimización AEO/GEO:** archivo llms.txt y contenido en "bloques de respuesta" para que las IAs (ChatGPT, Perplexity, Google AI) puedan citar y recomendar la web.
- Google Analytics 4 + Google Search Console.
- Registro de dominio y configuración de hosting (incluido el primer año).
- Certificado SSL activo (HTTPS).

**Marco legal básico**
- Política de Privacidad y Términos y Condiciones adaptados al negocio.

## 4. Lo que NO incluye este acuerdo
**Contenido y producción**
- Fotografía/video profesional — los provee el Cliente o contrata por su cuenta.
- Creación de logotipo — se integra el logo que defina el Cliente (se puede cotizar aparte).

**Marketing y redes sociales**
- Gestión de redes, creación de contenido, publicidad paga (Ads) y email marketing.

**Funcionalidades avanzadas**
- Pasarela de pagos, e-learning, CRM completo, área de clientes con login, integraciones no acordadas, chatbot con IA (se cotizan aparte).

**Mantenimiento posterior**
- Actualizaciones de contenido post-entrega (las gestiona el Cliente vía CMS).
- Soporte indefinido (se puede acordar un plan mensual aparte).
- Renovación de hosting y dominio a partir del 2° año.

## 5. Responsabilidades del Cliente
- Proveer material real (fotos, textos base, credenciales, testimonios) con la calidad acordada.
- Validar contenidos y mensajes clave antes de la carga final.
- Dar feedback en un máximo de 5 días hábiles por etapa.
- Tomar las decisiones de contenido dentro de los plazos (las demoras afectan la entrega).
- Proveer los accesos necesarios (calendario, dominio, etc.).
- Abonar los costos de infraestructura a su nombre (MYB asesora, el titular es el Cliente).

## 6. Responsabilidades de MYB Digitals
- Desarrollar el proyecto conforme al brief estratégico de marca.
- Desarrollar el copywriting con foco en claridad y jerarquía del mensaje.
- Mantener comunicación activa y transparente durante todo el proyecto.
- Entregar el código fuente completo al finalizar (el Cliente es propietario del código).
- Probar en los principales navegadores y dispositivos antes de cada entrega.
- Respetar la confidencialidad del negocio.
- Optimizar para el objetivo principal de conversión.

## 7. Metodología y Proceso de Trabajo
El proyecto se estructura en etapas. Al finalizar cada una se hace una revisión conjunta y el Cliente aprueba antes de avanzar.

| # | Etapa | Entregable |
|---|-------|------------|
| 01 | Definición y diseño | Wireframes, paleta, estructura de contenido aprobada |
| 02 | Desarrollo frontend | Sitio funcionando con diseño y contenido de prueba |
| 03 | Integraciones técnicas | Formulario, calendario, CMS operativos |
| 04 | Carga de contenido real | Copywriting final, fotos, testimonios integrados |
| 05 | SEO y AEO | Analytics, Search Console, schema, llms.txt, velocidad |
| 06 | Revisión final y entrega | Sitio en producción, dominio activo, capacitación |

## 8. Inversión y Condiciones de Pago
- **Inversión total del proyecto:** $[monto] [moneda]
- **50% al inicio (seña) / 50% en la entrega final.**
- Los costos de infraestructura (dominio y hosting) están incluidos el primer año. A partir del 2° año los asume el Cliente.
- Cualquier funcionalidad adicional fuera de este acuerdo se presupuesta por separado y requiere aprobación escrita antes de iniciar.

## 9. Propiedad del Trabajo
- El código, los diseños y los entregables son propiedad del Cliente una vez abonado el 100%.
- MYB puede mostrar el proyecto en su portfolio, salvo indicación en contrario del Cliente.
- Los contenidos provistos por el Cliente son y siguen siendo de su propiedad.
- MYB no revende ni reutiliza código específico del negocio en proyectos de terceros.

## 10. Confidencialidad
Ambas partes mantienen la confidencialidad de toda información sensible compartida (estrategia, datos de clientes, facturación, metodologías, precios). Se mantiene durante la vigencia y por dos (2) años posteriores a la finalización.

## 11. Modificaciones de Alcance
Todo lo no especificado se considera fuera de alcance. Si el Cliente solicita algo nuevo: se evalúa el impacto en tiempo y costo, se emite un documento con el detalle, y el trabajo comienza solo una vez aprobado y abonado. Los ajustes menores dentro del mismo alcance no tienen costo, si se piden antes de la entrega de cada etapa.

## 12. Cancelación del Proyecto
Si el Cliente cancela el proyecto una vez iniciado: los pagos realizados no son reembolsables y se le entrega todo lo completado hasta la fecha. Si MYB Digitals no pudiera continuar por causas propias: devuelve los pagos del trabajo no realizado y entrega todo lo desarrollado.

## 13. Resolución de Diferencias
Ante cualquier diferencia, las partes la resuelven primero mediante diálogo directo. Si no hay acuerdo en diez (10) días, se podrá recurrir a un mediador neutral acordado por ambas partes. Ambas partes reconocen que este acuerdo fue redactado de buena fe.

## 14. Manifestación de Acuerdo
Ambas partes declaran haber leído, comprendido y aceptado el contenido íntegro del presente acuerdo, y que refleja fielmente lo conversado.

CLIENTE: _______________________  [Nombre y DNI]
PROVEEDOR: Agencia MYB Digitals — [DNI/CUIT]

Córdoba, Argentina — [mes y año]
Válido en formato digital con firma escaneada o manuscrita de ambas partes.

---
*Confidencial — Uso exclusivo de las partes firmantes*
`;

const DOC_BRIEF = `# BRIEF ESTRATÉGICO DE MARCA
## Arquitectura de Inteligencia de Marca
### [CLIENTE] — [bajada / rol / categoría]

**Preparado por:** MYB Digitals · **Fecha:** [fecha] · **Entregable:** [Landing Page + Estrategia de Marca]

> **Instrucciones de uso.** Este brief captura la inteligencia estratégica de la marca. Es el documento de referencia para todo lo que se construya a partir de acá: la web, el copywriting, la identidad visual y la comunicación. Sirve para (1) definir el posicionamiento, (2) **alimentar a la IA y al equipo de diseño/desarrollo que producen la web**, (3) garantizar coherencia de tono, mensaje y estética, y (4) ser la brújula de las decisiones de copy y diseño. El copywriting es la pieza central del entregable.

---

## ⚡ Resumen para la IA (leer primero)
> Bloque denso y factual para que una IA (o un nuevo integrante) entienda la marca en 30 segundos. Completar con datos reales, sin relleno.

- **Marca:** [nombre exacto]
- **Qué hace, en una frase:** [...]
- **Para quién:** [público objetivo en una línea]
- **Objetivo de la web:** [acción principal que debe lograr]
- **Diferencial único (USP):** [...]
- **Tono:** [3-4 adjetivos] · **Trato:** [vos / usted / tú]
- **Paleta:** [#hex principal, #hex secundario, neutros]
- **Evitar siempre:** [clichés / palabras / estéticas prohibidas]
- **Pruebas de autoridad:** [credenciales, números, casos reales]

---

## 1. Información General
- **Nombre de la marca:** [...]
- **Sector:** [...]
- **Ubicación y alcance:** [ciudad · país · LATAM · online/presencial]
- **Estado del negocio:** [idea / validación / en crecimiento / escalada]
- **Canales actuales:** [Instagram / WhatsApp / web / ...]
- **Contacto:** [teléfono · email]

**Cifras clave de la marca** (datos duros que dan autoridad)
- [+N] [qué representa — ej: clientes acompañados]
- [+N años] de trayectoria
- [certificación / premio / hito]

## 2. Brand Heart — El Corazón de la Marca
- **Propósito** (por qué existe más allá del dinero): [...]
- **Visión** (el futuro que quiere crear): [...]
- **Misión** (lo que hace hoy, todos los días): [...]
- **Valores irrenunciables** (3 a 5): [...]
- **Comportamientos que NO representan a la marca** (líneas rojas): [...]

## 3. Historia y Contexto
- **De dónde viene** (origen, recorrido, qué le da autoridad): [...]
- **Hitos que definen la trayectoria:** [...]
- **Logros a destacar en la web:** [...]

## 4. Servicios y Oferta
- **Servicio central:** [nombre + qué resuelve + para quién]
- **Otros servicios / áreas:** [...]
- **Modelo de ingresos:** [servicios / programas / recurrente / mixto]
- **Por qué este enfoque es diferente:** [...]

## 5. Público Objetivo
> Si hay varios segmentos, listarlos por separado para que cada uno se sienta identificado sin mezclar mensajes.

- **Segmento 1:** [quién es · qué busca · qué valora]
- **Segmento 2:** [...]
- **Dolores que la marca resuelve:** [frases en primera persona del cliente]
- **Deseos y aspiraciones:** [...]
- **Objeciones frecuentes (y su respuesta):** [...]

## 6. Análisis Competitivo
- **El terreno donde compite:** [cómo es el mercado]
- **Competidores directos:** [...]
- **Oportunidades (huecos del mercado):** [...]
- **Propuesta Única de Valor (USP):** [...]
- **Razones para creer (RTB):** [pruebas, método, resultados]

## 7. Identidad y Personalidad de Marca
- **Si la marca fuera una persona…** [descripción en prosa de su carácter]
- **Adjetivos que la definen:** [...]
- **Paleta de colores (con HEX):**
  - [#______] — [qué transmite]
  - [#______] — [qué transmite]
  - [#______] — neutro / fondo
  - [#______] — texto
- **Estética general:** [cálida/corporativa/minimalista; qué SÍ y qué NO]
- **Emociones que debe generar al primer contacto:** [confianza / cercanía / deseo / ...]

## 8. Tono y Estilo de Comunicación
- **Cómo habla la marca:** [...]
- **Lo que NO hace:** [...]
- **Escala de tono** (marcar):
  - Inspirador ●●●●○ Neutro
  - Cercano ●●●●○ Distante
  - Accesible ●●●●○ Técnico
  - Con autoridad ●●●●● Informal
- **Frases que SÍ representan la marca:** [3-5 ejemplos reales de copy]
- **Frases que NUNCA usaría:** [3-5 ejemplos a evitar]
- **Palabras que SÍ usamos:** [...]
- **Palabras que NO usamos:** [...]

## 9. Autoridad y Credenciales
- **Formación / certificaciones / trayectoria:** [...]
- **Comunidad / red / asociaciones:** [...]
- **Prueba social en la web** (de mayor a menor peso): autoridad objetiva (números, certificaciones) → testimonios reales (idealmente uno por segmento) → logos/menciones de respaldo.

## 10. Objetivos Estratégicos y Métricas
- **Objetivo de la web:** [...]
- **Objetivo de marketing principal:** [qué percepción debe generar al compartir el link]
- **Primeros 90 días (SMART):** [específico, medible, alcanzable, relevante, temporal]
- **KPIs prioritarios:** [consultas/mes, conversión visita→consulta, origen del tráfico, ...]
- **Qué significa "ganar" para esta marca:** [...]

## 11. Especificaciones de la Web
- **Función de la página:** [carta de presentación / captación / catálogo / ...]
- **Arquitectura de contenido sugerida** (secciones en orden):
  1. Hero: [propuesta de valor + respaldo + CTA]
  2. [Quién es / Sobre la marca]
  3. [Para quién / segmentos]
  4. [Servicios]
  5. [Autoridad / prueba social]
  6. [Testimonios]
  7. [Contacto + CTA]
- **Criterios de diseño:** mobile-first · velocidad crítica · estructura limpia y jerárquica · [referencia visual: ___]
- **CTAs principales:** [textos exactos — ej: "Agendá una primera conversación"]

## 12. Brief para Inteligencia Artificial (IA-Ready)
> Esta sección convierte el brief en un input directo para construir la web con Claude Code.

### 12.1 Rol de la IA
Actuás como [estratega senior + diseñador/desarrollador web] especializado en [rubro]. Combinás visión estratégica de negocio con ejecución de copy y diseño de alto nivel.

### 12.2 Framework COSTAR
| Campo | Definición |
|-------|------------|
| **Contexto** | [qué es la marca y qué necesita] |
| **Objetivo** | [qué debe lograr la web] |
| **Estilo** | [cómo se escribe/diseña] |
| **Tono** | [registro emocional] |
| **Audiencia** | [a quién le habla] |
| **Restricciones** | [qué evitar siempre] |

### 12.3 Prompt base para Claude Code (copiar y adaptar)
> Construí una [landing page] para [CLIENTE], [rubro]. Objetivo: [acción principal]. Público: [segmentos]. Tono: [adjetivos], trato de [vos/usted]. Paleta: [HEX]. Estética: [descripción], mobile-first, rápida y jerárquica. Secciones, en orden: [lista de la sección 11]. El copy debe sonar [tono] y apoyarse SIEMPRE en estas pruebas reales: [credenciales/números]. Prohibido: [clichés/palabras a evitar]. Incluí SEO técnico + AEO (llms.txt, FAQ y HowTo schema, bloques de respuesta) para que ChatGPT y Perplexity puedan recomendar la web. CTAs exactos: [textos].

## 13. Próximos Pasos
- [ ] Confirmar datos faltantes (email, CTA principal, cifras a destacar).
- [ ] Definir la web de referencia visual.
- [ ] Reunir testimonios reales (idealmente uno por segmento).
- [ ] Definir/validar logo y paleta.
- [ ] Desarrollar el copywriting completo.
- [ ] Maquetar mobile-first y publicar.

---
Firma del Cliente: _______________________   Fecha: ___ / ___ / _____
*Este brief debe revisarse cada 6 meses o ante cambios estratégicos importantes.*
`;

const DOC_KB_IA = `# Base de Conocimiento IA — _______________________

> Objetivo: que cualquier texto/diseño generado con IA suene a la marca y NO a "IA genérica".

## Tono de voz
- Personalidad de la marca: (cercana / experta / premium / juvenil / ...)
- Tratamiento: (vos / usted / tú)
- Ejemplo de frase que SÍ suena a la marca:
- Ejemplo de frase que NO queremos:

## Palabras / expresiones propias
- Usar:
- Evitar:

## Reglas anti-"IA genérica"
- Nada de "En el mundo digital de hoy...", "desata tu potencial", "lleva tu negocio al siguiente nivel".
- Frases cortas, concretas, con datos reales del cliente.
- Hablar de beneficios concretos, no adjetivos vacíos.
- Usar nombres reales, números reales, casos reales.

## Datos duros de la marca (para SEO/AEO y para que las IAs la citen bien)
- Nombre exacto:
- Qué ofrece (1 línea clara):
- Ciudad / zona de servicio:
- Diferencial único:
- Contacto oficial:

## Habilidades/estilo a usar al construir
- Referencias de diseño aprobadas:
- Componentes/animaciones deseados:
`;

const DOC_GUIA_ADMIN = `# Guía de Uso / Administrador — _______________________

> Entregar al cliente al final. Que pueda usar lo que le hicimos sin depender de nosotros.

## Acceso al panel (si aplica)
- URL del admin:
- Usuario:
- Cómo recuperar contraseña:

## Cómo editar contenido
- (pasos)

## Cómo ver los mensajes / leads del formulario
- (pasos)

## Preguntas frecuentes
- ¿Cómo cambio una foto?
- ¿Cómo agrego un testimonio?

## Soporte
- Ante cualquier duda, escribir a: __________
- Mantenimiento mensual disponible (consultar).
`;

const DOC_FEEDBACK = `# Feedback del Proyecto — _______________________

> Enviar al cliente al entregar. Sirve para mejorar y para el testimonio.

1. Del 1 al 10, ¿qué tan conforme estás con el resultado final?
2. ¿Qué fue lo que más te gustó del proceso?
3. ¿Algo que mejorarías de cómo trabajamos?
4. ¿La comunicación fue clara y a tiempo?
5. ¿Nos recomendarías a alguien? ¿A quién?
6. Comentario libre:
`;

const DOC_TESTIMONIOS = `# Testimonios — _______________________

> Pedir SIEMPRE al cerrar. Es el activo de marketing más valioso.

## Testimonio en texto
"___________________________________________"
— Nombre, cargo / negocio

## Pedido de video (opcional, vale oro)
Guion sugerido para el cliente:
1. Quién sos y a qué te dedicás.
2. Cómo estabas antes de la web / cuál era el problema.
3. Cómo fue trabajar con MYB Digitals.
4. Qué resultado tuviste.

## Permiso de uso
- [ ] El cliente autoriza usar su testimonio y logo en nuestras redes y web.
`;

const DOC_CREDENCIALES = `# Accesos y Credenciales — _______________________

> ⚠️ INFORMACIÓN SENSIBLE. No compartir fuera del equipo.
> (Recomendado: migrar a un gestor de contraseñas. Ver mejoras de seguridad de Fase 2.)

| Servicio | Usuario | Contraseña | Notas |
|----------|---------|------------|-------|
| Dominio (registrador) | | | |
| Hosting / Deploy | | | |
| Email | | | |
| Redes sociales | | | |
| Otros | | | |
`;

// ─── PLAYBOOK: LANDING PAGE ───

const LANDING_PAGE: Playbook = {
  serviceType: 'landing',
  payments: [
    { label: 'Seña inicial (50%)', percentage: 50 },
    { label: 'Pago final (50%)', percentage: 50 },
  ],
  documents: [
    { docType: 'acuerdo', title: 'Acuerdo de buena fe', content: DOC_ACUERDO },
    { docType: 'brief', title: 'Brief de marca', content: DOC_BRIEF },
    { docType: 'kb_ia', title: 'Base de conocimiento IA', content: DOC_KB_IA },
    { docType: 'guia_admin', title: 'Guía de uso / Admin', content: DOC_GUIA_ADMIN },
    { docType: 'feedback', title: 'Feedback del cliente', content: DOC_FEEDBACK },
    { docType: 'testimonios', title: 'Testimonios', content: DOC_TESTIMONIOS },
    { docType: 'credenciales', title: 'Accesos y credenciales', content: DOC_CREDENCIALES },
  ],
  steps: [
    // FASE 0 — Cierre & Pago
    { phase: 0, phaseName: 'Cierre & Pago', owner: 'client', title: 'Recibir seña del 50%', description: 'Confirmar el pago de la seña inicial antes de arrancar. Registrar el hito de pago.' },
    { phase: 0, phaseName: 'Cierre & Pago', owner: 'myb', title: 'Registrar el proyecto en el CRM', description: 'Dar de alta al cliente y el servicio en la sección Clientes con su valor y moneda.' },
    { phase: 0, phaseName: 'Cierre & Pago', owner: 'both', title: 'Agendar llamada de kickoff', description: 'Reunión de arranque para alinear expectativas, plazos y completar el brief en vivo.' },

    // FASE 1 — Setup & Organización
    { phase: 1, phaseName: 'Setup & Organización', owner: 'myb', title: 'Crear carpeta raíz en Google Drive', description: 'Carpeta del cliente con subcarpetas: "01 Fotos y Videos" (sube el cliente) y "02 Documentación". Pegar el link en el slot de Drive.' },
    { phase: 1, phaseName: 'Setup & Organización', owner: 'myb', title: 'Crear grupo de WhatsApp', description: 'Grupo con el cliente para centralizar la comunicación. Pegar el link de invitación en el slot de WhatsApp.' },
    { phase: 1, phaseName: 'Setup & Organización', owner: 'myb', title: 'Enviar Acuerdo de buena fe', description: 'Compartir el documento de Acuerdo para que el cliente lo lea y confirme.' },
    { phase: 1, phaseName: 'Setup & Organización', owner: 'client', title: 'Solicitar accesos y credenciales', description: 'Pedir los accesos necesarios (dominio, redes, etc.) y guardarlos en el documento de Credenciales.' },

    // FASE 2 — Discovery & Brief
    { phase: 2, phaseName: 'Discovery & Brief', owner: 'both', title: 'Completar el Brief de marca', description: 'Llenar el brief con el cliente: objetivo, público, competencia, identidad visual.' },
    { phase: 2, phaseName: 'Discovery & Brief', owner: 'myb', title: 'Armar la Base de conocimiento IA', description: 'Definir tono, do/don\'ts y qué evitar para que el contenido NO parezca IA genérica.' },
    { phase: 2, phaseName: 'Discovery & Brief', owner: 'client', title: 'Recolectar fotos, videos y logos', description: 'El cliente sube todo el material a la carpeta "01 Fotos y Videos".' },

    // FASE 3 — Diseño
    { phase: 3, phaseName: 'Diseño', owner: 'client', title: 'Cliente envía referencias de diseño', description: 'Webs/estilos que le gusten como referencia visual.' },
    { phase: 3, phaseName: 'Diseño', owner: 'myb', title: 'Construir el diseño', description: 'Desarrollar el diseño tomando las referencias (pasarlas a Claude Code para lograr algo parecido y a medida).' },
    { phase: 3, phaseName: 'Diseño', owner: 'both', title: 'Revisión de diseño con el cliente', description: 'Mostrar el diseño y aplicar correcciones (hasta 2 rondas).' },

    // FASE 4 — Desarrollo
    { phase: 4, phaseName: 'Desarrollo', owner: 'myb', title: 'Desarrollo frontend', description: 'Maquetar la landing responsive y con buenas animaciones.' },
    { phase: 4, phaseName: 'Desarrollo', owner: 'myb', title: 'Desarrollo backend (funciones + seguridad)', description: 'Formularios, lógica y seguridad. Validaciones y protección de datos.' },
    { phase: 4, phaseName: 'Desarrollo', owner: 'myb', title: 'Integración email marketing / base de datos', description: 'Conectar con Supabase / MailerLite u otro si el cliente lo necesita.', isOptional: true },

    // FASE 5 — SEO & AEO
    { phase: 5, phaseName: 'SEO & AEO', owner: 'myb', title: 'SEO técnico', description: 'Meta tags, Open Graph, sitemap.xml, robots.txt, performance y Core Web Vitals.' },
    { phase: 5, phaseName: 'SEO & AEO', owner: 'myb', title: 'AEO/GEO — que las IAs la recomienden', description: 'Crear llms.txt, escribir "answer blocks" (regla de 50 palabras), FAQ + HowTo schema, datos estructurados (JSON-LD) y permitir crawlers de IA. Diferencial clave.' },
    { phase: 5, phaseName: 'SEO & AEO', owner: 'myb', title: 'Test de velocidad y accesibilidad', description: 'Correr Lighthouse / PageSpeed y corregir lo que baje el puntaje.' },

    // FASE 6 — Lanzamiento
    { phase: 6, phaseName: 'Lanzamiento', owner: 'myb', title: 'Comprar / configurar el dominio', description: 'Registrar o conectar el dominio y apuntar DNS. Pegar el dominio en el slot correspondiente.' },
    { phase: 6, phaseName: 'Lanzamiento', owner: 'myb', title: 'Setup de analítica', description: 'Instalar GA4 o Plausible para medir visitas y conversiones desde el día 1.' },
    { phase: 6, phaseName: 'Lanzamiento', owner: 'myb', title: 'Deploy a producción', description: 'Publicar la landing en el dominio final.' },
    { phase: 6, phaseName: 'Lanzamiento', owner: 'myb', title: 'QA final en producción', description: 'Revisar en móvil y desktop: links, formularios, velocidad, ortografía.' },

    // FASE 7 — Cierre & Retención
    { phase: 7, phaseName: 'Cierre & Retención', owner: 'myb', title: 'Grabar video walkthrough (Loom)', description: 'Video corto mostrando la entrega y cómo usar/editar la landing.' },
    { phase: 7, phaseName: 'Cierre & Retención', owner: 'myb', title: 'Entregar guía de uso / admin', description: 'Compartir el documento de Guía de uso completado.' },
    { phase: 7, phaseName: 'Cierre & Retención', owner: 'client', title: 'Cobrar el 50% restante', description: 'Confirmar el pago final antes/al momento de la entrega. Registrar el hito de pago.' },
    { phase: 7, phaseName: 'Cierre & Retención', owner: 'myb', title: 'Enviar documento de Feedback', description: 'Pedir feedback al cliente para mejorar y para el testimonio.' },
    { phase: 7, phaseName: 'Cierre & Retención', owner: 'myb', title: 'Pedir testimonio', description: 'Solicitar testimonio (idealmente en video) y permiso de uso para marketing.' },
    { phase: 7, phaseName: 'Cierre & Retención', owner: 'myb', title: 'Check-in a 30 días', description: 'Contactar al mes para ver resultados y ofrecer mantenimiento / mejoras (retención y upsell).' },
  ],
};

// ─── REGISTRO DE PLAYBOOKS ───
export const PLAYBOOKS: Partial<Record<ServiceType, Playbook>> = {
  landing: LANDING_PAGE,
  // web_pro, automation, consulting → Fase 2
};

export const getPlaybook = (service: ServiceType): Playbook | undefined => PLAYBOOKS[service];

// ─── Armado del Acuerdo por plantilla (sin IA) ───
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

export function buildAcuerdo(d: Partial<Discovery>): string {
  const now = new Date();
  const mesAnio = `${MESES[now.getMonth()]} de ${now.getFullYear()}`;
  const has = (s?: string) => !!(s && s.trim());
  let t = DOC_ACUERDO;
  const set = (placeholder: string, val?: string) => { if (has(val)) t = t.split(placeholder).join(val!.trim()); };

  set('[Tipo de proyecto — ej: Desarrollo de Landing Page Profesional]', d.tipoProyecto);
  set('[Producto principal — ej: Landing Page Profesional]', d.tipoProyecto);
  set('[el proyecto]', d.tipoProyecto);
  set('[Cliente]', d.marca);
  set('[Nombre / Marca]', d.marca);
  set('[rubro]', d.sector);
  set('[palabras clave del rubro]', d.sector);
  set('[teléfono · email]', d.contacto);
  set('[objetivo principal]', d.objetivos || d.queQuiere);
  set('[Describir la brecha que cierra el proyecto entre la autoridad/realidad del cliente y su presencia digital actual, y para qué va a usar el entregable.]', d.queQuiere);
  set('[monto]', d.monto);
  set('[moneda]', d.moneda);
  t = t.split('[mes y año]').join(mesAnio);
  return t;
}
