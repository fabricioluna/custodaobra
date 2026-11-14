"use client";

import { Eye, EyeOff } from "lucide-react";
import { type ComponentProps, useState } from "react";

import { Input } from "@/components/ui/input";

import { authCopy } from "../copy";

const copy = authCopy.login;

/** Campo de senha com o botão de mostrar e esconder (útil no celular, no sol). */
export function PasswordInput(
  props: Omit<ComponentProps<typeof Input>, "type">,
) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="pr-14"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? copy.hidePassword : copy.showPassword}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-md text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        {visible ? (
          <EyeOff className="size-5" aria-hidden />
        ) : (
          <Eye className="size-5" aria-hidden />
        )}
      </button>
    </div>
  );
}
