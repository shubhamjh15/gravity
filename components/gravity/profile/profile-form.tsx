"use client";

/**
 * Profile edit form — public identity fields. Wires to the updateProfile server
 * action, shows field-level errors + a success toast. Production: client
 * validation mirrors the Zod server schema, but the server is the source of
 * truth (it re-validates).
 */
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { User } from "lucide-react";
import { updateProfile } from "@/app/(player)/profile/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldError } from "@/components/gravity/profile/field-error";

type ProfileData = {
  display_name: string | null;
  age: number | null;
  gender: string | null;
};

export function ProfileForm({ initial }: { initial: ProfileData }) {
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [gender, setGender] = useState<string>(initial.gender ?? "undisclosed");

  function onSubmit(formData: FormData) {
    setErrors({});
    const ageRaw = String(formData.get("age") ?? "").trim();
    const input = {
      display_name: String(formData.get("display_name") ?? "").trim(),
      age: ageRaw === "" ? null : Number(ageRaw),
      gender: gender as ProfileData["gender"],
    };

    startTransition(async () => {
      const res = await updateProfile(input);
      if (res.success) {
        toast.success(res.message);
      } else {
        if (res.errors) setErrors(res.errors);
        toast.error(res.message);
      }
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-5">
      <div className="flex items-center gap-2 text-sm font-medium text-text-muted">
        <User className="size-4 text-crimson-400" />
        Public identity
      </div>

      <div className="grid gap-2">
        <Label htmlFor="display_name">Display name</Label>
        <Input
          id="display_name"
          name="display_name"
          defaultValue={initial.display_name ?? ""}
          placeholder="Your gamer name"
          aria-invalid={Boolean(errors.display_name)}
        />
        <FieldError message={errors.display_name} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="age">Age</Label>
          <Input
            id="age"
            name="age"
            type="number"
            min={13}
            max={100}
            defaultValue={initial.age ?? ""}
            placeholder="18"
            aria-invalid={Boolean(errors.age)}
          />
          <FieldError message={errors.age} />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="gender">Gender</Label>
          <Select value={gender} onValueChange={setGender}>
            <SelectTrigger id="gender">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
              <SelectItem value="other">Other</SelectItem>
              <SelectItem value="undisclosed">Prefer not to say</SelectItem>
            </SelectContent>
          </Select>
          <FieldError message={errors.gender} />
        </div>
      </div>

      <div>
        <Button type="submit" variant="gradient" disabled={pending}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
