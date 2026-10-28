/**
 * ATOM funnel — copied from the ManyChat flows on 28-10-2026:
 *  - «ATOM - Ecosistema de ventas» (comments)
 *  - «ATOM - Continuar si responde con texto» (reply after a comment opening)
 *  - «ATOM - Ventas DM e historias v3» (DM / story reply with ATOM)
 *  - «ATOM - Socios (story SOCIO)»
 *  - «Instagram Default Reply» (AI step)
 *
 * Texts are kept exactly as in ManyChat. Edit here to change the funnel.
 */

export const TAGS = {
  compro: "compro_atom",
  noPorAhora: "no_por_ahora",
  califica: "paso_califica",
  socioRevisar: "socio_por_revisar",
  socioInteresado: "socio_interesado",
} as const;

/** Comment keywords («Post or Reel Comments #2»). Matched as whole words, case and accent insensitive. */
export const COMMENT_KEYWORDS = [
  "ATOM", "Atún", "Atun", "Átomo", "Atomo", "Aton", "Atón", "Ayón", "Átom", "Ayom",
];
/** DM / story reply keyword («Ventas DM e historias v3»). */
export const DM_KEYWORDS = ["ATOM"];
/** Story reply keywords («Socios (story SOCIO)»). */
export const SOCIO_KEYWORDS = ["SOCIO", "SOCIOS"];

export const PUBLIC_REPLIES = [
  "te dejé un DM 📩 si no te sale, escríbeme ATOM por mensaje y te cuento",
  "listo, te escribí 👀 si no lo ves, mándame ATOM por DM y te respondo al toque",
  "te mandé la info por DM 🙌 si no aparece (a veces se va a solicitudes ocultas) escríbeme ATOM por DM",
];

/** «Aleatorizador» A / B / C — sent as the private reply to the comment. */
export const COMMENT_OPENINGS = [
  "Ey, vi tu comentario 👀\n\nTodos mis videos los hace ATOM. Yo no grabo ni edito nada, solo elijo el tema 🤯\n\n¿Te muestro cómo funciona?",
  "ey, gracias por comentar 👀\n\nte cuento rápido: no grabo ni edito nada, todos mis reels los hace ATOM con IA. yo solo elijo el tema\n\n¿te explico cómo funciona?",
  "hola! vi que comentaste 🙌\n\nestos videos los hace una IA con un sistema que armé, se llama ATOM. con eso esta cuenta pasó los 20 mil seguidores y los 6 millones de vistas en poco más de 1 semana\n\n¿quieres que te cuente cómo funciona?",
];

const LANDING = "https://proyectoatom.lat/";
const utm = (campaign: string) =>
  `${LANDING}?utm_source=instagram&utm_medium=dm&utm_campaign=${campaign}&utm_content=openreply`;

export const LINKS = {
  pro: utm("ecosistema_pro"),
  elite: utm("ecosistema_elite"),
  ver: utm("ecosistema_ver"),
  socios: utm("socios_story"),
  calendly: "https://calendly.com/negociosdellasierra/llamada-socios-atom",
};

/** Public files served by the web app (public/audios). */
export const AUDIOS = {
  seguimiento2h: "/audios/seguimiento-2h.m4a",
  cupon: "/audios/seguimiento-cupon.m4a",
};

export type QuickReply = { title: string; go: NodeId };
export type PostbackButton = { title: string; go: NodeId };
export type UrlButton = { title: string; url: string; tag?: string };

export type NodeId =
  | "continuar"
  | "open_dm"
  | "follow"
  | "sigueme"
  | "califica"
  | "sin_ia"
  | "celular"
  | "pregunta"
  | "pro"
  | "elite"
  | "ver"
  | "seg1"
  | "seg2"
  | "seg3"
  | "compro"
  | "precio"
  | "duda"
  | "compu"
  | "ahora_no"
  | "socio_q"
  | "socio_si"
  | "socio_handle"
  | "socio_done"
  | "socio_no"
  | "socio_skip";

export type FunnelMessage =
  | { kind: "text"; text: string; quickReplies?: QuickReply[] }
  | { kind: "buttons"; text: string; buttons: PostbackButton[] }
  | { kind: "links"; text: string; links: UrlButton[] }
  | { kind: "audio"; path: string };

export type FunnelNode = {
  /** Messages per source; "default" when the text is the same everywhere. */
  messages: { default: FunnelMessage[]; dm?: FunnelMessage[] };
  addTags?: string[];
  /** Run this node right after sending (no wait). */
  then?: NodeId;
  /** Start the 2 h / 4 h / 6 h follow-up sequence after this node. */
  startFollowUps?: boolean;
  /** Wait for free input from the user. */
  awaiting?: "socio_img" | "socio_handle";
};

const QR_SEG1: QuickReply[] = [
  { title: "Ya lo compré ✅", go: "compro" },
  { title: "El precio", go: "precio" },
  { title: "No sé si me funciona", go: "duda" },
  { title: "Lo veo en la compu", go: "compu" },
  { title: "Ahora no 🙏", go: "ahora_no" },
];

export const NODES: Record<NodeId, FunnelNode> = {
  // «Continuar si responde con texto» — the reply after a comment opening.
  continuar: {
    messages: { default: [{ kind: "text", text: "te cuento rápido cómo funciona 👇" }] },
    addTags: [TAGS.califica],
    then: "follow",
  },
  // «Ventas DM e historias v3» — opening with a button.
  open_dm: {
    messages: {
      default: [
        {
          kind: "buttons",
          text: "ey, vi tu mensaje y por eso te escribo 👀\n\nte cuento: empecé esta cuenta como un experimento y en poco más de 1 semana ya voy por más de 20 mil seguidores y 6 millones de vistas, sin grabarme ni editar nada 🤯\n\n¿quieres saber cómo lo hice para que tú también puedas hacerlo con tu cuenta?",
          buttons: [{ title: "sí, cuéntame 🙌", go: "follow" }],
        },
      ],
    },
  },
  // «Condición #3»: follows the account? → califica, else sigueme (handled in engine).
  follow: { messages: { default: [] } },
  sigueme: {
    messages: {
      default: [
        {
          kind: "buttons",
          text: "Te lo paso ya mismo bro 🙌\n\nSolo sígueme en @proyecto_atom (lo estoy compartiendo primero con los que me siguen) y dale al botón 👇",
          buttons: [{ title: "Ya te sigo ✅", go: "follow" }],
        },
      ],
    },
  },
  califica: {
    messages: {
      default: [
        {
          kind: "buttons",
          text: "todos mis videos los hace una IA con un sistema que armé, se llama ATOM. yo solo elijo el tema 🎬\n\nfunciona en la compu, dentro de Claude o ChatGPT. antes de seguir, ¿ya pagas alguno de los dos?",
          buttons: [
            { title: "Sí, ya pago uno ✅", go: "pregunta" },
            { title: "No, pero tengo compu", go: "sin_ia" },
            { title: "Solo tengo celular 📱", go: "celular" },
          ],
        },
      ],
      dm: [
        {
          kind: "buttons",
          text: "va, te cuento 🙌 todos mis videos los hace una IA con un sistema que armé, se llama ATOM. yo solo elijo el tema 🎬\n\nfunciona en la compu, dentro de Claude o ChatGPT. antes de seguir, ¿ya pagas alguno de los dos?",
          buttons: [
            { title: "Sí, ya pago uno ✅", go: "pregunta" },
            { title: "No, pero tengo compu", go: "sin_ia" },
            { title: "Solo tengo celular 📱", go: "celular" },
          ],
        },
      ],
    },
  },
  sin_ia: {
    messages: {
      default: [
        {
          kind: "buttons",
          text: "Va, todo bien 🙌 Para que lo sepas desde ya y sin sorpresas:\n\nATOM se paga una sola vez, pero trabaja dentro de Claude Pro o ChatGPT Plus, que cuestan unos $20 al mes y se pagan aparte. Si vas a subir videos seguido, sale mucho más barato que pagarle a un editor.\n\n¿Te sigo contando?",
          buttons: [{ title: "Dale, cuéntame 👉", go: "pregunta" }],
        },
      ],
    },
  },
  celular: {
    messages: {
      default: [
        {
          kind: "text",
          text: "Te soy honesto bro: hoy ATOM necesita una compu (Mac o Windows) 🙏\n\nTe dejo el link para que lo veas cuando estés en una 👇\nhttps://proyectoatom.lat\n\nCualquier duda me escribes por aquí 🤙",
        },
      ],
    },
  },
  pregunta: {
    messages: {
      default: [
        {
          kind: "buttons",
          text: "perfecto, con eso ya puedes usarlo 🙌\n\ny cuéntame, ¿para qué lo usarías? así te explico lo que de verdad te sirve",
          buttons: [
            { title: "Para mi cuenta", go: "pro" },
            { title: "Vender a negocios", go: "elite" },
            { title: "Solo quiero verlo", go: "ver" },
          ],
        },
      ],
    },
  },
  pro: {
    messages: {
      default: [
        {
          kind: "links",
          text: "buenísimo 🙌 entonces te va a servir full: tú eliges el tema, la IA arma el video completo y tú solo lo subes 🎬\n\naquí te dejo la página con videos reales y lo que trae cada versión, mírala con calma 👇",
          links: [{ title: "Ver ATOM 👀", url: LINKS.pro }],
        },
      ],
    },
    startFollowUps: true,
  },
  elite: {
    messages: {
      default: [
        {
          kind: "links",
          text: "Bien ahí 💼 Con ATOM le haces videos a negocios sin grabar ni editar: tú eliges el tema, la IA hace el video y tú lo entregas.\n\nEn la página ves ejemplos y lo que trae cada versión, incluido el kit para vender (a quién ofrecer, qué decir y cuánto cobrar) 👇",
          links: [{ title: "Ver ATOM 👀", url: LINKS.elite }],
        },
      ],
    },
    startFollowUps: true,
  },
  ver: {
    messages: {
      default: [
        {
          kind: "links",
          text: "Va, te lo resumo rápido 👀\n\nATOM es una carpeta que abres en Claude o ChatGPT. Le dices el tema y la IA te hace el video completo: guion, dibujos, voz y subtítulos. Sin grabarte y sin editar.\n\nEl del brazo que sube solo ya pasa los 4 millones de vistas, y salió así 😮\n\nAquí ves ejemplos y cómo conseguirlo 👇\n\nPagas una sola vez y es tuyo para siempre, nada de mensualidades 🙌",
          links: [{ title: "Ver ATOM 👀", url: LINKS.ver }],
        },
      ],
    },
    startFollowUps: true,
  },
  // «5 Seguimiento 1 (2 h)»
  seg1: {
    messages: {
      default: [
        { kind: "audio", path: AUDIOS.seguimiento2h },
        { kind: "text", text: "¿Qué te frena? 👇", quickReplies: QR_SEG1 },
      ],
    },
  },
  // «6 Seguimiento 2 (4 h)»
  seg2: {
    messages: {
      default: [
        {
          kind: "text",
          text: "Por si te quedó alguna duda, esto es lo que más me preguntan 👇\n\n🤖 ¿Qué necesito? Claude Pro o ChatGPT Plus (unos $20 al mes) y una compu Mac o Windows. Nada más.\n\n⏱ ¿Cuánto tarda? Entre 20 min y 1 hora por video. Tú solo eliges el tema y apruebas el guion.\n\n🛡 ¿Y si no me sirve? Tienes 7 días de garantía y te devuelven todo.\n\nSi tienes otra duda, escríbeme y te ayudo 🤙\n\nhttps://proyectoatom.lat\n\nSi ya lo compraste, dale al botón 👇",
          quickReplies: [
            { title: "Ya lo compré ✅", go: "compro" },
            { title: "Ahora no 🙏", go: "ahora_no" },
          ],
        },
      ],
    },
  },
  // «8 Seguimiento 3 cupón (6 h)»
  seg3: {
    messages: {
      default: [
        { kind: "audio", path: AUDIOS.cupon },
        {
          kind: "text",
          text: "Tu cupón 🎁 QUEDATE10\n\nTe da 10% de descuento. Lo pegas al pagar en Hotmart, donde dice «¿Tienes un cupón?».\n\n👉 https://proyectoatom.lat",
        },
      ],
    },
  },
  compro: {
    messages: {
      default: [
        {
          kind: "text",
          text: "¡Bienvenido bro! 🎉\n\nRevisa tu correo: Hotmart ya te mandó el acceso. Descarga los archivos de «Descarga tu ATOM» y abre EMPIEZA-AQUI.html.\n\nSi te trabas en algo me escribes y lo sacamos juntos 🚀",
        },
      ],
    },
    addTags: [TAGS.compro],
  },
  precio: {
    messages: {
      default: [
        {
          kind: "text",
          text: "Te entiendo bro, nadie quiere tirar su plata 🙌\n\nMira: ATOM lo pagas una sola vez y nunca más vuelves a pagar. Si ya tienes ChatGPT o Claude de pago, no gastas nada más. Y con un solo video que vendas o que te traiga clientes, ya lo recuperaste.\n\nAdemás tienes 7 días de garantía: si no es para ti, te devuelven todo 🤙\n\n👉 https://proyectoatom.lat",
        },
      ],
    },
  },
  duda: {
    messages: {
      default: [
        {
          kind: "text",
          text: "Normal dudar bro, yo también dudaría 😅\n\nTe hago una promesa: si te trabas instalándolo o haciendo tu primer video, me escribes por aquí y te ayudo yo hasta que salga.\n\nY si aun así no te sirve, en los primeros 7 días te devuelven el 100% desde Hotmart. No pierdes nada 🤙\n\n👉 https://proyectoatom.lat",
        },
      ],
    },
  },
  compu: {
    messages: {
      default: [
        {
          kind: "text",
          text: "Dale bro, tranqui 🙌\n\nTe dejo el link aquí para que lo abras desde la compu cuando puedas 👇\nhttps://proyectoatom.lat\n\nAhí ves el video de cómo funciona y los ejemplos. Cualquier duda me escribes 🤙",
        },
      ],
    },
  },
  ahora_no: {
    messages: {
      default: [
        {
          kind: "text",
          text: "Todo bien bro, cero presión 🙌 No te escribo más de esto.\n\nSi algún día te animas, me escribes ATOM y te ayudo 🤙",
        },
      ],
    },
    addTags: [TAGS.noPorAhora],
  },
  // «ATOM - Socios (story SOCIO)»
  socio_q: {
    messages: {
      default: [
        {
          kind: "buttons",
          text: "¡Ey! Qué bueno que respondiste 🙌\nAntes de agendar, una preguntita rápida: ¿ya tienes ATOM Élite?",
          buttons: [
            { title: "Sí, lo tengo 🔥", go: "socio_si" },
            { title: "Todavía no", go: "socio_no" },
          ],
        },
      ],
    },
  },
  socio_si: {
    messages: {
      default: [
        { kind: "text", text: "¡Buenísimo! 🙌 Antes de agendar necesito confirmar 2 cositas rápidas 👇" },
        {
          kind: "text",
          text: "1️⃣ Primero mándame la captura de tu compra de ATOM Élite (el correo de Hotmart sirve) 📸",
          quickReplies: [{ title: "Omitir", go: "socio_skip" }],
        },
      ],
    },
    awaiting: "socio_img",
  },
  // Skipping the screenshot jumps straight to the @ question.
  socio_skip: { messages: { default: [] }, then: "socio_handle" },
  socio_handle: {
    messages: {
      default: [
        { kind: "text", text: "2️⃣ ¡Gracias! Ahora pásame el @ de la cuenta donde estás subiendo tus videos 👇" },
      ],
    },
    awaiting: "socio_handle",
  },
  socio_done: {
    messages: {
      default: [
        {
          kind: "links",
          text: "¡Listo, ya me llegó todo! 🙌\n\nAgendemos una llamada cortita (20 min) y te cuento cómo funciona lo de socios. Ojo que solo son 4 lugares 👀",
          links: [{ title: "Agendar llamada 📅", url: LINKS.calendly, tag: TAGS.socioInteresado }],
        },
      ],
    },
    addTags: [TAGS.socioRevisar],
  },
  socio_no: {
    messages: {
      default: [
        {
          kind: "links",
          text: "Todo bien 🙌 Por ahora estoy buscando socios que ya usen ATOM Élite, porque así pueden mostrar sus propios videos.\n\nSi quieres verlo primero, aquí te lo dejo 👇 y cualquier duda me escribes por aquí.",
          links: [{ title: "Ver ATOM 👀", url: LINKS.socios }],
        },
      ],
    },
  },
};

export const SOCIO_IMAGE_RETRY =
  "Necesito la captura como imagen 📸 Mándamela por aquí tocándole al ícono de la foto";
export const SOCIO_IMAGE_MAX_RETRIES = 4;

/**
 * Follow-up sequence after pro / elite / ver: 2 h, 4 h and 6 h.
 * `skipIfTags`: ManyChat conditions before each follow-up.
 */
export const FOLLOW_UPS: Array<{ node: NodeId; afterHours: number; skipIfTags: string[] }> = [
  { node: "seg1", afterHours: 2, skipIfTags: [TAGS.compro] },
  { node: "seg2", afterHours: 4, skipIfTags: [TAGS.compro, TAGS.noPorAhora] },
  { node: "seg3", afterHours: 6, skipIfTags: [TAGS.compro, TAGS.noPorAhora] },
];

/** Bot pauses for a contact this long after a human replies from Instagram (ManyChat: 1 day). */
export const HUMAN_PAUSE_HOURS = 24;

// «Instagram Default Reply» → «AI Step»
export const AI_GREETING = "ey, qué tal 👋";
export const AI_GOAL =
  "resuelve dudas sobre ATOM breve y cercano, como si charlaran por dm, sin presionar.";
export const AI_CONTEXT =
  "ATOM es un producto digital (una carpeta ZIP con instrucciones y herramientas) que se abre en Claude o en ChatGPT en la computadora. La persona elige el tema y su IA hace el reel completo: guion, dibujos animados, voz y subtítulos, listo para subir. No hay que grabarse, editar ni saber programar. Funciona en Mac o Windows (recomendado 8 GB de RAM). Versiones (pago único en Hotmart, acceso de por vida): Esencial $12.90 (el sistema; actualizaciones congeladas). Pro $19.90 (todo lo de Esencial + actualizaciones de por vida, calendario de 30 temas virales, pack de nichos, 100 temas probados, modo series). Élite $24.90 (todo lo de Pro + portadas clickbait, descripciones para cada red, repurposing, 2 estilos extra Cine Nocturno y Datos Neón, y kit Vende videos a negocios). Requisitos: una cuenta de pago de Claude Pro o ChatGPT Plus (unos 20 dólares al mes, se paga aparte) y una clave de ElevenLabs para la voz (tiene plan gratis para empezar). Cada video tarda entre 20 minutos y 1 hora; la persona solo elige el tema y aprueba el guion. Garantía de 7 días: reembolso del 100% desde Hotmart. Pagos: tarjeta, PayPal y métodos locales según el país (Yape y PagoEfectivo en Perú, PSE, Nequi y Bancolombia en Colombia, Mercado Pago y OXXO en México, Mercado Pago en Argentina, Servipag o MACH en Chile). Los videos son de la persona, también para clientes. Soporte: negociosdellasierra@gmail.com. Resultados: la cuenta @proyecto_atom empezó de cero el 18 de octubre de 2026 y en poco más de una semana sus reels hechos con ATOM pasaron los 20 mil seguidores y los 6 millones de vistas. El mejor video es el del brazo que sube solo («tu brazo va a subir solo»): pasa los 4 millones de vistas; cuando hables de resultados, usa ese de ejemplo. Los resultados dependen del tema, el nicho y la constancia: no prometas vistas ni ingresos. Landing: https://proyectoatom.lat Cupón: QUEDATE10 da 10% de descuento en cualquier versión. Se aplica al pagar en Hotmart: en el formulario de pago está el campo «¿Tienes un cupón?», ahí se pega QUEDATE10 y se toca aplicar; el precio baja antes de pagar. Si alguien pregunta por el cupón, explícale eso.";
export const AI_RULES = [
  "responde justo lo que te preguntó en 1 a 3 frases cortas. no asumas a qué se dedica; si no sabes, habla en general. escribe como un chico de 22 por dm: casual, casi todo en minúsculas (solo ATOM en mayúscula), sin ¿ ni ¡, máximo 1 emoji, no digas bro siempre. no des precios salvo que pregunte. no recomiendes versión: en la página ve cada una. no ruegues ni vendas. no saludes de nuevo. nunca digas plan ni suscripción: es pago único.",
  "si no sabes la respuesta, está molesto, pide reembolso o quiere hablar con alguien, dile tranqui que el equipo le responde por aquí muy pronto. el link https://proyectoatom.lat pásalo solo si pide verlo, comprar o precios, nunca en cada mensaje. si solo responde sí, ok o algo corto, pregúntale para qué lo usaría o qué quiere saber",
];
/** ManyChat AI step limit. */
export const AI_MAX_CHARS = 512;
