import type { ConnectionInfo } from "@/components/terminal/use-terminal"
import type { ConnectionProfile } from "@/lib/profile-store"
import type { FormEvent } from "react"

import NiceModal, { useModal } from "@ebay/nice-modal-react"
import { ChevronDownIcon, PlusIcon, ServerIcon, Trash2Icon } from "lucide-react"
import { useEffect, useState } from "react"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { listProfiles, removeProfile, saveProfile, updateProfile } from "@/lib/profile-store"

type AuthMethod = "password" | "privateKey"

interface ProfileFormState {
  name: string
  serverUrl: string
  host: string
  port: string
  username: string
  authMethod: AuthMethod
  password: string
  privateKey: string
}

const emptyForm: ProfileFormState = {
  name: "",
  serverUrl: "ws://localhost:3001",
  host: "",
  port: "22",
  username: "",
  authMethod: "password",
  password: "",
  privateKey: "",
}

function formToConnectionInfo(form: ProfileFormState): ConnectionInfo {
  return {
    serverUrl: form.serverUrl,
    host: form.host,
    port: Number(form.port),
    username: form.username,
    password: form.authMethod === "password" ? form.password : "",
    privateKey: form.authMethod === "privateKey" ? form.privateKey : undefined,
  }
}

function profileToForm(profile: ConnectionProfile): ProfileFormState {
  const info = profile.connectionInfo
  return {
    name: profile.name,
    serverUrl: info.serverUrl,
    host: info.host,
    port: String(info.port),
    username: info.username,
    authMethod: info.privateKey ? "privateKey" : "password",
    password: info.password,
    privateKey: info.privateKey ?? "",
  }
}

function ProfileForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial: ProfileFormState
  submitLabel: string
  onSubmit: (form: ProfileFormState) => void
}) {
  const [form, setForm] = useState(initial)

  const updateField = <K extends keyof ProfileFormState>(key: K, value: ProfileFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.host.trim()) return
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-2">
      <div className="grid gap-2">
        <Label>프로필 이름</Label>
        <Input
          value={form.name}
          onChange={(e) => updateField("name", e.target.value)}
          placeholder="프로덕션 서버"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label>서버 URL</Label>
        <Input
          value={form.serverUrl}
          onChange={(e) => updateField("serverUrl", e.target.value)}
          placeholder="ws://localhost:3001"
          required
        />
      </div>
      <Separator />
      <div className="flex gap-3">
        <div className="grid flex-1 gap-2">
          <Label>호스트</Label>
          <Input
            value={form.host}
            onChange={(e) => updateField("host", e.target.value)}
            placeholder="192.168.1.100"
            required
          />
        </div>
        <div className="grid w-24 gap-2">
          <Label>포트</Label>
          <Input type="number" value={form.port} onChange={(e) => updateField("port", e.target.value)} required />
        </div>
      </div>
      <div className="grid gap-2">
        <Label>사용자명</Label>
        <Input
          value={form.username}
          onChange={(e) => updateField("username", e.target.value)}
          placeholder="root"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label>인증 방식</Label>
        <RadioGroup
          value={form.authMethod}
          onValueChange={(v) => updateField("authMethod", v as AuthMethod)}
          className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="password" id={`pw-${initial.name}`} />
            <Label htmlFor={`pw-${initial.name}`} className="font-normal">
              비밀번호
            </Label>
          </div>
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="privateKey" id={`key-${initial.name}`} />
            <Label htmlFor={`key-${initial.name}`} className="font-normal">
              SSH 키
            </Label>
          </div>
        </RadioGroup>
      </div>
      {form.authMethod === "password" ? (
        <div className="grid gap-2">
          <Label>비밀번호</Label>
          <Input type="password" value={form.password} onChange={(e) => updateField("password", e.target.value)} />
        </div>
      ) : (
        <div className="grid gap-2">
          <Label>Private Key (PEM)</Label>
          <Textarea
            value={form.privateKey}
            onChange={(e) => updateField("privateKey", e.target.value)}
            placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\n..."}
            rows={5}
            className="resize-y font-mono text-xs"
          />
        </div>
      )}
      <Button type="submit" className="w-full" size="sm">
        {submitLabel}
      </Button>
    </form>
  )
}

export const SettingsDialog = NiceModal.create(() => {
  const modal = useModal()
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([])
  const [addingNew, setAddingNew] = useState(false)

  useEffect(() => {
    if (modal.visible) {
      listProfiles().then(setProfiles)
      setAddingNew(false)
    }
  }, [modal.visible])

  const handleDelete = (profile: ConnectionProfile) => {
    NiceModal.show(ConfirmDialog, {
      title: "프로필 삭제",
      description: `"${profile.name}" 프로필을 삭제하시겠습니까?`,
      onConfirm: async () => {
        await removeProfile(profile.id)
        setProfiles((prev) => prev.filter((p) => p.id !== profile.id))
      },
    })
  }

  const handleUpdate = async (profileId: string, form: ProfileFormState) => {
    await updateProfile(profileId, form.name.trim(), formToConnectionInfo(form))
    const updated = await listProfiles()
    setProfiles(updated)
  }

  const handleCreate = async (form: ProfileFormState) => {
    await saveProfile(form.name.trim(), formToConnectionInfo(form))
    const updated = await listProfiles()
    setProfiles(updated)
    setAddingNew(false)
  }

  return (
    <Dialog open={modal.visible} onOpenChange={(open) => !open && modal.hide()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>설정</DialogTitle>
          <DialogDescription>SSH 접속 프로필을 관리합니다</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">프로필</h3>
            <Button variant="outline" size="sm" onClick={() => setAddingNew(!addingNew)}>
              <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
              추가
            </Button>
          </div>

          {addingNew && (
            <div className="border-primary/20 bg-primary/5 rounded-md border p-3">
              <ProfileForm initial={emptyForm} submitLabel="추가" onSubmit={handleCreate} />
            </div>
          )}

          {profiles.length === 0 && !addingNew ? (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-8 text-center">
              <ServerIcon className="size-8 opacity-40" />
              <p className="text-sm">저장된 프로필이 없습니다</p>
            </div>
          ) : (
            <div className="space-y-2">
              {profiles.map((p) => (
                <Collapsible key={p.id} className="rounded-md border">
                  <div className="flex items-center px-3 py-2">
                    <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-left [&[data-state=closed]>svg]:-rotate-90">
                      <ChevronDownIcon className="text-muted-foreground h-4 w-4 shrink-0 transition-transform" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{p.name}</div>
                        <div className="text-muted-foreground truncate text-xs">
                          {p.connectionInfo.username}@{p.connectionInfo.host}:{p.connectionInfo.port}
                        </div>
                      </div>
                    </CollapsibleTrigger>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground ml-1 h-7 w-7 shrink-0 hover:text-destructive"
                      onClick={() => handleDelete(p)}>
                      <Trash2Icon className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <CollapsibleContent>
                    <div className="border-t px-3 pb-3">
                      <ProfileForm
                        initial={profileToForm(p)}
                        submitLabel="저장"
                        onSubmit={(form) => handleUpdate(p.id, form)}
                      />
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
})
