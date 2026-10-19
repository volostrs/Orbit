// Uploaded Dashboard images live in this browser's IndexedDB (a Blob per image), referenced from the layout by id.
// Nothing is sent to a server. Each upload is decoded and re-encoded through a canvas, so only real raster image data
// is kept (SVG and anything scriptable is rejected) and large photos are scaled down.

const DB_NAME = "orbit-dashboard";
const STORE = "images";
export const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_EDGE = 1600;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(req.result);
        };
        tx.onerror = tx.onabort = () => {
          db.close();
          reject(tx.error);
        };
      })
  );
}

export const getImage = (id: string) => run<Blob | undefined>("readonly", (s) => s.get(id));
export const putImage = (id: string, blob: Blob) => run("readwrite", (s) => s.put(blob, id));

// Drops stored images that the saved layout no longer references (replaced, removed or cancelled uploads).
export async function pruneImages(keep: Set<string>) {
  const keys = (await run<IDBValidKey[]>("readonly", (s) => s.getAllKeys())) as string[];
  for (const k of keys) if (!keep.has(k)) await run("readwrite", (s) => s.delete(k));
}

export async function storeUploadedImage(file: File): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type)) throw new Error("Use a PNG, JPEG or WebP image.");
  if (file.size > MAX_UPLOAD_BYTES) throw new Error("That image is over 10 MB. Try a smaller one.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("That file couldn't be read as an image.");
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, file.type === "image/png" ? "image/png" : "image/webp", 0.85));
  if (!blob) throw new Error("That image couldn't be processed.");
  const id = crypto.randomUUID();
  try {
    await putImage(id, blob);
  } catch {
    throw new Error("This browser couldn't store the image (private mode or storage is full).");
  }
  return id;
}
