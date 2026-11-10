import { describe, expect, it } from "vitest";

import { parseAction } from "@/lib/whatsapp/actions";
import { projectListMessage } from "@/lib/whatsapp/messages";

const project = (i: number) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  name: `Obra ${i}`,
  orgName: i % 2 ? "Construtora" : "Pessoal",
});

const rowsOf = (message: ReturnType<typeof projectListMessage>) =>
  message.type === "list" ? message.rows : [];

describe("projectListMessage", () => {
  it("até 10 obras cabem numa lista só, com a ativa marcada", () => {
    const projects = Array.from({ length: 10 }, (_, i) => project(i + 1));
    const rows = rowsOf(
      projectListMessage(projects, true, { activeId: projects[2]!.id }),
    );
    expect(rows).toHaveLength(10);
    expect(rows[2]?.description).toBe("Obra ativa · Construtora");
    expect(rows[1]?.description).toBe("Pessoal");
  });

  it("com mais de 10, pagina de 9 em 9 e nenhuma obra some", () => {
    const projects = Array.from({ length: 20 }, (_, i) => project(i + 1));
    const seen = new Set<string>();
    for (let page = 0; page < 3; page++) {
      const rows = rowsOf(projectListMessage(projects, false, { page }));
      expect(rows.length).toBeLessThanOrEqual(10);
      const more = rows.at(-1)!;
      expect(parseAction(more.id)).toEqual({
        type: "project_page",
        page: (page + 1) % 3,
      });
      for (const row of rows.slice(0, -1)) seen.add(row.title);
    }
    expect(seen.size).toBe(20);
  });
});
