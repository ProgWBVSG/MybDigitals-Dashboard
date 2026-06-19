// ─── MOTOR DE PLAYBOOKS ───
// Cada servicio define su proceso: fases → pasos, hitos de pago y documentos
// con contenido base editable. Al crear un onboarding, el hook "materializa"
// este template en filas reales de Supabase para poder tildar y personalizar.

import type { ServiceType, StepOwner, DocType } from './utils';

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

const DOC_ACUERDO = `# Acuerdo de Buena Fe — MYB Digitals

**Cliente:** _______________________
**Servicio:** Landing Page
**Fecha:** ___ / ___ / _____

## 1. Alcance del proyecto
- Diseño y desarrollo de una (1) Landing Page profesional.
- Optimización SEO + AEO (preparada para ser recomendada por buscadores e IAs).
- Hasta 2 rondas de revisión de diseño incluidas.

## 2. Plazos estimados
- Inicio: al recibir el 50% inicial y el material del cliente.
- Entrega estimada: ___ días hábiles.

## 3. Inversión y forma de pago
- Total: $__________
- 50% al inicio (seña, no reembolsable una vez comenzado el trabajo).
- 50% restante contra entrega / antes del lanzamiento.

## 4. Responsabilidades del cliente
- Entregar textos, fotos, logos y accesos en tiempo y forma.
- Responder revisiones dentro de las 48 hs.

## 5. Lo que NO incluye
- Producción de fotos/videos profesionales.
- Mantenimiento mensual (se cotiza aparte).
- Costos de dominio y hosting (a cargo del cliente salvo acuerdo).

## 6. Propiedad
- Al completar el pago total, el cliente recibe los archivos y accesos finales.

_Firmado de buena fe entre ambas partes._
`;

const DOC_BRIEF = `# Brief de Marca — _______________________

> Completar junto al cliente en la llamada de kickoff. Cuanto mejor el brief, mejor el resultado.

## 1. Sobre el negocio
- ¿A qué se dedican? (en una frase)
- ¿Cuánto hace que existen?
- ¿Qué los hace diferentes de la competencia?

## 2. Objetivo de la landing
- ¿Qué acción queremos que haga el visitante? (comprar / agendar / escribir por WhatsApp / suscribirse)
- ¿Cómo medimos el éxito?

## 3. Público objetivo
- ¿Quién es el cliente ideal? (edad, ubicación, qué problema tiene)
- ¿Qué objeción suele frenar la compra?

## 4. Competencia y referencias
- 2-3 webs que les gusten (y por qué)
- 1-2 competidores directos

## 5. Identidad visual
- Colores de marca: __________
- Tipografía (si tienen): __________
- ¿Tienen logo en alta? (sí / no)
- Estilo: (minimalista / elegante / divertido / corporativo / otro)

## 6. Contenido
- ¿Tienen textos o los redactamos nosotros?
- ¿Tienen fotos/videos propios?
- Testimonios de clientes (sí / no)

## 7. Técnico
- ¿Necesitan formulario? ¿A dónde llegan los datos? (email / WhatsApp / base de datos)
- ¿Email marketing? (MailerLite, etc.)
- ¿Dominio ya comprado? ¿Cuál?
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
