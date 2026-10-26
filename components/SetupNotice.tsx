export function SetupNotice() {
  return (
    <div className="paper max-w-2xl p-6">
      <h1 className="text-xl font-semibold text-[#1a365d]">Connect Supabase</h1>
      <p className="mt-3 text-[0.95rem] leading-6 text-slate-700">
        This app is not connected yet. One teammate creates the Supabase project
        and pastes <code className="rounded bg-slate-100 px-1">supabase/schema.sql</code>{" "}
        in the SQL editor. Then every teammate copies{" "}
        <code className="rounded bg-slate-100 px-1">.env.example</code> to{" "}
        <code className="rounded bg-slate-100 px-1">.env.local</code> and puts in
        the same Project URL and anon key.
      </p>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-[0.95rem] leading-6 text-slate-700">
        <li>Create the project at supabase.com</li>
        <li>Run the SQL file once</li>
        <li>Fill .env.local with the two values from Project Settings → API</li>
        <li>
          Stop the server and run <code className="rounded bg-slate-100 px-1">npm run dev</code>{" "}
          again
        </li>
      </ol>
      <p className="mt-4 text-sm text-slate-600">
        There is no login. Anyone with those keys can enter data. Keep them off
        GitHub. Full steps are in the README.
      </p>
    </div>
  );
}
