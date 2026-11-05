import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { EMAIL_TEMPLATES } from "../src/lib/email-templates";

const exec = promisify(execFile);
const project = process.argv[2];

async function main() {
  if (!project?.startsWith("prj_")) throw new Error("Pass the SendPanda project/environment ID explicitly.");
  const directory = await mkdtemp(join(tmpdir(), "upstep-email-templates-"));
  async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
    const args = ["-y", "@sendpanda/cli", "api", method, path, "--env", project!];
    if (body !== undefined) {
      const file = join(directory, "request.json");
      await writeFile(file, JSON.stringify(body), { mode: 0o600 });
      args.push("--data", `@${file}`);
    }
    const { stdout } = await exec("npx", args, { maxBuffer: 2 * 1024 * 1024 });
    return JSON.parse(stdout) as T;
  }
  try {
    const { data: existing } = await api<{ data: { id: string; name: string }[] }>("GET", "/v1/templates");
    const envFile = new URL("../.env", import.meta.url);
    let env = await readFile(envFile, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return "";
      throw error;
    });
    for (const [kind, template] of Object.entries(EMAIL_TEMPLATES)) {
      const found = existing.find(({ name }) => name === template.name);
      const id = found?.id ?? (await api<{ id: string }>("POST", "/v1/templates", template)).id;
      const saved = await api<{
        published_version: number | null;
        versions: { version: number; subject: string; text: string; html: string }[];
      }>("GET", `/v1/templates/${id}`);
      const same = saved.versions.find((v) => v.subject === template.subject && v.text === template.text && v.html === template.html);
      const version = same?.version ?? (await api<{ version: number }>("POST", `/v1/templates/${id}/versions`, template)).version;
      if (saved.published_version !== version) {
        await api("POST", `/v1/templates/${id}/publish`, { version });
      }
      const name = `SENDPANDA_${kind.toUpperCase()}_TEMPLATE_ID`;
      const line = `${name}=${JSON.stringify(id)}`;
      const pattern = new RegExp(`^${name}=.*$`, "m");
      env = pattern.test(env) ? env.replace(pattern, () => line) : `${env.trimEnd()}\n${line}\n`;
      // Save each ID immediately so a subsequent CLI failure cannot lose progress.
      await writeFile(envFile, env.trimStart(), { mode: 0o600 });
      console.log(`${template.name}: published version ${version} (${id})`);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
