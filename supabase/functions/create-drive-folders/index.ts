// Edge Function: crea la estructura de carpetas de un cliente en el Drive de MYB.
// Usa una cuenta de servicio de Google (JWT -> access token) y la Drive API v3.
// Secrets requeridos:
//   GOOGLE_SA_KEY_B64       -> el JSON de la cuenta de servicio, en base64
//   DRIVE_PARENT_FOLDER_ID  -> ID de la carpeta "Clientes MYB" (compartida con el robot)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SA = JSON.parse(atob(Deno.env.get('GOOGLE_SA_KEY_B64')!));
const PARENT_FOLDER_ID = Deno.env.get('DRIVE_PARENT_FOLDER_ID')!;

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function base64url(input: Uint8Array | string): string {
  const str = typeof input === 'string' ? btoa(input) : btoa(String.fromCharCode(...input));
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: SA.client_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(SA.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  const jwt = `${signingInput}.${base64url(new Uint8Array(sig))}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('No se pudo autenticar con Google: ' + JSON.stringify(data));
  return data.access_token;
}

async function createFolder(token: string, name: string, parentId: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,webViewLink&supportsAllDrives=true', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  });
  const data = await res.json();
  if (!data.id) throw new Error(`No se pudo crear la carpeta "${name}": ` + JSON.stringify(data));
  return data.id;
}

// Crea un Google Doc con contenido (sube el texto y Drive lo convierte a Documento)
async function createDoc(token: string, name: string, content: string, parentId: string): Promise<void> {
  const boundary = 'mybdigitals' + crypto.randomUUID();
  const metadata = {
    name,
    parents: [parentId],
    mimeType: 'application/vnd.google-apps.document',
  };
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify(metadata) + `\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/plain; charset=UTF-8\r\n\r\n` +
    (content || '') + `\r\n` +
    `--${boundary}--`;

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`No se pudo crear el documento "${name}": ${err}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { clientName, documents } = await req.json();
    if (!clientName) throw new Error('Falta el nombre del cliente (clientName)');

    const token = await getAccessToken();
    const rootId = await createFolder(token, clientName, PARENT_FOLDER_ID);
    // Subcarpetas estándar
    await createFolder(token, '01 Fotos y Videos', rootId);
    const docsFolderId = await createFolder(token, '02 Documentación', rootId);

    // Crear cada documento como Google Doc dentro de "02 Documentación".
    // Si falla (ej: cuota del robot en Gmail personal), seguimos: las carpetas ya quedaron.
    const docs: { title: string; content: string }[] = Array.isArray(documents) ? documents : [];
    let docsCreated = 0;
    let docsWarning = '';
    for (const d of docs) {
      if (!d?.title) continue;
      try {
        await createDoc(token, d.title, d.content || '', docsFolderId);
        docsCreated++;
      } catch (e) {
        docsWarning = String((e as Error)?.message || e);
        break; // si uno falla por cuota, los demás también -> cortamos
      }
    }

    const link = `https://drive.google.com/drive/folders/${rootId}`;
    return new Response(JSON.stringify({ ok: true, folderId: rootId, link, docsCreated, docsWarning }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
