"use client";

import { useActionState, useState } from "react";

import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import type { FormState } from "@/lib/forms";

import { membersCopy } from "../copy";
import { Choice } from "./choice";

const copy = membersCopy.member;
const { roles, roleHints } = membersCopy;

type ProjectAccess = "none" | "editor" | "viewer";

/** Papel na conta e, para quem não é administrador, o acesso a cada obra. */
export function MemberAccessForm({
  action,
  role,
  projects,
}: {
  action: (
    state: FormState<never>,
    formData: FormData,
  ) => Promise<FormState<never>>;
  role: "admin" | "member";
  projects: { id: string; name: string; access: ProjectAccess }[];
}) {
  const [state, formAction, pending] = useActionState<
    FormState<never>,
    FormData
  >(action, { status: "idle" });
  const [selectedRole, setSelectedRole] = useState(role);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-6">
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-lg heading">{copy.roleTitle}</legend>
        <Choice
          name="role"
          value="member"
          checked={selectedRole === "member"}
          onChange={() => setSelectedRole("member")}
          title={copy.makeMember}
        />
        <Choice
          name="role"
          value="admin"
          checked={selectedRole === "admin"}
          onChange={() => setSelectedRole("admin")}
          title={roles.admin}
          hint={roleHints.admin}
        />
      </fieldset>

      {selectedRole === "member" ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="text-lg heading">{copy.projectsTitle}</legend>
          <p className="-mt-1 text-sm text-muted-foreground">
            {copy.projectsDescription}
          </p>
          {projects.map((project) => (
            <div
              key={project.id}
              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <label htmlFor={`project-${project.id}`} className="font-medium">
                {project.name}
              </label>
              <div className="sm:w-56">
                <NativeSelect
                  id={`project-${project.id}`}
                  name={`project:${project.id}`}
                  defaultValue={project.access}
                >
                  <option value="none">{copy.noAccess}</option>
                  <option value="editor">{roles.editor}</option>
                  <option value="viewer">{roles.viewer}</option>
                </NativeSelect>
              </div>
            </div>
          ))}
        </fieldset>
      ) : null}

      {state.status === "error" && state.message ? (
        <FormMessage>{state.message}</FormMessage>
      ) : null}
      {state.status === "success" && state.message ? (
        <FormMessage tone="success">{state.message}</FormMessage>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="self-start rounded-xl"
      >
        {pending ? copy.saving : copy.save}
      </Button>
    </form>
  );
}
