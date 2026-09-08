// Supabase Edge Function: delete-account
//
// Permanently deletes the calling user's account and everything belonging to
// it. Google Play requires this for any app that lets people create an
// account, and the privacy policy at park-next.in/privacy promises it, so
// "permanently" has to be literally true — including the photo files, which
// nothing else cleans up.
//
// Deploy:  supabase functions deploy delete-account
//
// Runs with the service role key (injected automatically as
// SUPABASE_SERVICE_ROLE_KEY) because deleting a row from `auth.users` is an
// admin operation that no client key can perform.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/** Both buckets store every file under a `<userId>/` prefix, enforced by the
 * insert policies in migration 0013 — so that prefix is exactly the set of
 * files this user has ever uploaded. */
const PHOTO_BUCKETS = ['listing-photos', 'avatars'] as const;

/** Storage's `list` caps a page at 100 by default; ask for the maximum and
 * page until it runs dry, because a prolific host can easily exceed one page
 * across all their listings. */
const PAGE_SIZE = 1000;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // The user id comes from the caller's own verified JWT and never from the
  // request body. Trusting a body parameter here would turn this function
  // into "delete any account by id" for anyone who can reach the URL.
  const authorization = req.headers.get('Authorization') ?? '';
  const jwt = authorization.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) {
    return json({ error: 'Missing Authorization header' }, 401);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const { data: caller, error: callerError } = await admin.auth.getUser(jwt);
  if (callerError || !caller.user) {
    return json({ error: 'Invalid or expired session' }, 401);
  }
  const userId = caller.user.id;

  // Storage goes first, deliberately.
  //
  // The database cleans itself up: deleting the `auth.users` row cascades to
  // `profiles`, and from there to listings, bookings, reviews and reports
  // (migrations 0002-0005). Storage objects are outside that graph — no
  // cascade reaches them — so without this loop the account would vanish
  // while its photos stayed live on public URLs forever.
  //
  // Doing it before `deleteUser` means a storage failure aborts the whole
  // thing with nothing deleted, and the person can simply try again. The
  // other order would leave orphaned public photos that nobody has the
  // credentials to find or remove.
  for (const bucket of PHOTO_BUCKETS) {
    // Collect every path first, paging by offset, then remove in one call.
    //
    // The tempting shape — list a page, delete it, list again until empty —
    // only terminates if every delete actually succeeds. A `remove` that
    // reports no error but leaves a file behind would make the next `list`
    // return it again, forever. Advancing an offset instead means the loop
    // ends whatever storage does.
    const paths: string[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data: files, error: listError } = await admin.storage
        .from(bucket)
        .list(userId, { limit: PAGE_SIZE, offset });

      if (listError) {
        return json({ error: `Could not read ${bucket}: ${listError.message}` }, 500);
      }
      if (!files || files.length === 0) {
        break;
      }
      for (const file of files) {
        paths.push(`${userId}/${file.name}`);
      }
      if (files.length < PAGE_SIZE) {
        break;
      }
    }

    if (paths.length > 0) {
      const { error: removeError } = await admin.storage.from(bucket).remove(paths);
      if (removeError) {
        return json({ error: `Could not delete from ${bucket}: ${removeError.message}` }, 500);
      }
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return json({ error: deleteError.message }, 500);
  }

  return json({ deleted: true }, 200);
});
