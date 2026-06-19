// Edge Function: crea la estructura de carpetas + documentos de un cliente
// en el Drive de MYB, actuando COMO la cuenta de MYB (OAuth refresh token).
// Así los archivos son propiedad de MYB y usan su espacio de Drive.
//
// Secrets requeridos:
//   GOOGLE_OAUTH_CLIENT_ID
//   GOOGLE_OAUTH_CLIENT_SECRET
//   GOOGLE_OAUTH_REFRESH_TOKEN
//   DRIVE_PARENT_FOLDER_ID   -> ID de la carpeta "Clientes MyB Digitals"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CLIENT_ID = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!;
const CLIENT_SECRET = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!;
const REFRESH_TOKEN = Deno.env.get('GOOGLE_OAUTH_REFRESH_TOKEN')!;
const PARENT_FOLDER_ID = Deno.env.get('DRIVE_PARENT_FOLDER_ID')!;

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('No se pudo renovar el token de Google: ' + JSON.stringify(data));
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
    await createFolder(token, '01 Fotos y Videos', rootId);
    const docsFolderId = await createFolder(token, '02 Documentación', rootId);

    // Crear cada documento como Google Doc dentro de "02 Documentación".
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
        break;
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
