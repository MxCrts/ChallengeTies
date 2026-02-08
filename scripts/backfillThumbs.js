const { Storage } = require("@google-cloud/storage");

const BUCKET = "challengeme-d7fef.firebasestorage.app"; // si erreur → appspot.com
const PREFIX = "Challenges-Image/";

const storage = new Storage();
const bucket = storage.bucket(BUCKET);

const isThumb = (name) => /_200x200\.[a-z0-9]+$/i.test(name);
const makeThumbName = (name) => name.replace(/(\.[a-z0-9]+)$/i, "_200x200$1");

async function exists(name) {
  const [e] = await bucket.file(name).exists();
  return e;
}

async function refinalize(name) {
  const tmp = name.replace(/(\.[a-z0-9]+)$/i, "__tmp$1");
  const file = bucket.file(name);

  await file.copy(bucket.file(tmp));
  await file.delete({ ignoreNotFound: true });
  await bucket.file(tmp).copy(bucket.file(name));
  await bucket.file(tmp).delete({ ignoreNotFound: true });
}

(async () => {
  console.log("Backfill thumbs…");

  const [files] = await bucket.getFiles({ prefix: PREFIX });
  const originals = files
    .map((f) => f.name)
    .filter((n) => n.startsWith(PREFIX))
    .filter((n) => !isThumb(n));

  console.log("Images found:", originals.length);

  let done = 0;
  let skipped = 0;

  for (const name of originals) {
    const thumb = makeThumbName(name);
    if (await exists(thumb)) {
      skipped++;
      continue;
    }

    console.log("→ trigger resize:", name);
    await refinalize(name);
    done++;
  }

  console.log("DONE — generated:", done, "skipped:", skipped);
})();
