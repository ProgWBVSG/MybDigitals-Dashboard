// Edge Function: crea/actualiza la estructura de carpetas + documentos de un
// cliente en el Drive de MYB, actuando COMO la cuenta de MYB (OAuth refresh token).
// Es IDEMPOTENTE: si la carpeta/doc ya existe, lo reutiliza y ACTUALIZA su contenido
// (no duplica). Así se puede llamar al crear el onboarding y de nuevo al generar
// el brief/acuerdo, y el Drive queda siempre con el contenido más nuevo.
//
// Secrets: GOOGLE_OAUTH_CLIENT_ID / _SECRET / _REFRESH_TOKEN / DRIVE_PARENT_FOLDER_ID

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const CLIENT_ID = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID')!;
const CLIENT_SECRET = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET')!;
const REFRESH_TOKEN = Deno.env.get('GOOGLE_OAUTH_REFRESH_TOKEN')!;
const PARENT_FOLDER_ID = Deno.env.get('DRIVE_PARENT_FOLDER_ID')!;
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const DOC_MIME = 'application/vnd.google-apps.document';

async function getAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN, grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('No se pudo renovar el token de Google: ' + JSON.stringify(data));
  return data.access_token;
}

// Busca un hijo por nombre dentro de un parent (carpeta o doc)
async function findChild(token: string, name: string, parentId: string, folder: boolean): Promise<string | null> {
  const safe = name.replace(/'/g, "\\'");
  const mime = folder ? ` and mimeType='${FOLDER_MIME}'` : ` and mimeType!='${FOLDER_MIME}'`;
  const q = `name='${safe}' and '${parentId}' in parents and trashed=false${mime}`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  return data?.files?.[0]?.id || null;
}

async function createFolder(token: string, name: string, parentId: string): Promise<string> {
  const res = await fetch('https://www.googleapis.com/drive/v3/files?fields=id&supportsAllDrives=true', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  });
  const data = await res.json();
  if (!data.id) throw new Error(`No se pudo crear la carpeta "${name}": ` + JSON.stringify(data));
  return data.id;
}

async function upsertFolder(token: string, name: string, parentId: string): Promise<string> {
  return (await findChild(token, name, parentId, true)) || (await createFolder(token, name, parentId));
}

// Crea o actualiza un Google Doc con contenido de texto
async function upsertDoc(token: string, name: string, content: string, parentId: string): Promise<void> {
  const existing = await findChild(token, name, parentId, false);
  if (existing) {
    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existing}?uploadType=media&supportsAllDrives=true`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain; charset=UTF-8' },
      body: content || ' ',
    });
    if (!res.ok) throw new Error(`No se pudo actualizar "${name}": ${await res.text()}`);
    return;
  }
  const boundary = 'mybdigitals' + crypto.randomUUID();
  const metadata = { name, parents: [parentId], mimeType: DOC_MIME };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${content || ' '}\r\n--${boundary}--`;
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!res.ok) throw new Error(`No se pudo crear el documento "${name}": ${await res.text()}`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { clientName, documents, rootFolderId } = await req.json();
    if (!clientName && !rootFolderId) throw new Error('Falta clientName o rootFolderId');

    const token = await getAccessToken();
    // Si ya conocemos la carpeta raíz, la reutilizamos (evita duplicados por latencia de búsqueda)
    const rootId = rootFolderId || await upsertFolder(token, clientName, PARENT_FOLDER_ID);
    await upsertFolder(token, '01 Fotos y Videos', rootId);
    const docsFolderId = await upsertFolder(token, '02 Documentación', rootId);

    // Cada documento = una subcarpeta con su Google Doc adentro (crea o actualiza)
    const docs: { title: string; content: string }[] = Array.isArray(documents) ? documents : [];
    let docsOk = 0;
    let docsWarning = '';
    for (const d of docs) {
      if (!d?.title) continue;
      try {
        const sub = await upsertFolder(token, d.title, docsFolderId);
        await upsertDoc(token, d.title, d.content || '', sub);
        docsOk++;
      } catch (e) {
        docsWarning = String((e as Error)?.message || e);
        break;
      }
    }

    const link = `https://drive.google.com/drive/folders/${rootId}`;
    return new Response(JSON.stringify({ ok: true, folderId: rootId, link, docsOk, docsWarning }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error)?.message || e) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
