import type { ConnectionInfo } from "@/components/terminal/use-terminal"
import type { ConnectionProfile } from "@/lib/profile-store"
import type { FormEvent } from "react"

import NiceModal, { useModal } from "@ebay/nice-modal-react"
import { Trash2Icon } from "lucide-react"
import { useEffect, useState } from "react"

import { ConfirmDialog } from "@/components/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { listProfiles, removeProfile, saveProfile } from "@/lib/profile-store"

interface SshDialogProps {
  onConnect: (info: ConnectionInfo) => void
}

type AuthMethod = "password" | "privateKey"

export const SshDialog = NiceModal.create(({ onConnect }: SshDialogProps) => {
  const modal = useModal()
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([])
  const [serverUrl, setServerUrl] = useState("ws://localhost:3001")
  const [host, setHost] = useState("")
  const [port, setPort] = useState("22")
  const [username, setUsername] = useState("")
  const [authMethod, setAuthMethod] = useState<AuthMethod>("password")
  const [password, setPassword] = useState("")
  const [privateKey, setPrivateKey] = useState("")
  const [shouldSave, setShouldSave] = useState(false)
  const [profileName, setProfileName] = useState("")

  useEffect(() => {
    if (modal.visible) {
      listProfiles().then(setProfiles)
    }
  }, [modal.visible])

  const handleSelectProfile = (profileId: string) => {
    const profile = profiles.find((p) => p.id === profileId)
    if (!profile) return
    const info = profile.connectionInfo
    setServerUrl(info.serverUrl)
    setHost(info.host)
    setPort(String(info.port))
    setUsername(info.username)
    setPassword(info.password)
    setPrivateKey(info.privateKey ?? "")
    setAuthMethod(info.privateKey ? "privateKey" : "password")
  }

  const handleDeleteProfile = (profileId: string) => {
    const profile = profiles.find((p) => p.id === profileId)
    NiceModal.show(ConfirmDialog, {
      title: "프로필 삭제",
      description: `"${profile?.name ?? ""}" 프로필을 삭제하시겠습니까?`,
      onConfirm: async () => {
        await removeProfile(profileId)
        setProfiles((prev) => prev.filter((p) => p.id !== profileId))
      },
    })
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const info: ConnectionInfo = {
      serverUrl,
      host,
      port: Number(port),
      username,
      password: authMethod === "password" ? password : "",
      privateKey: authMethod === "privateKey" ? privateKey : undefined,
    }

    if (shouldSave && profileName.trim()) {
      await saveProfile(profileName.trim(), info)
    }

    onConnect(info)
    modal.hide()
  }

  return (
    <Dialog open={modal.visible} onOpenChange={(open) => !open && modal.hide()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>SSH 접속</DialogTitle>
          <DialogDescription>저장된 프로필을 선택하거나 새 접속 정보를 입력하세요</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {profiles.length > 0 && (
            <>
              <div className="grid gap-2">
                <Label>저장된 프로필</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="w-full justify-start font-normal">
                      프로필 선택...
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
                    {profiles.map((p) => (
                      <DropdownMenuItem
                        key={p.id}
                        className="flex items-center justify-between"
                        onSelect={() => handleSelectProfile(p.id)}>
                        <span className="flex flex-col">
                          <span className="text-sm">{p.name}</span>
                          <span className="text-muted-foreground text-xs">
                            {p.connectionInfo.username}@{p.connectionInfo.host}
                          </span>
                        </span>
                        <button
                          type="button"
                          className="text-muted-foreground ml-2 shrink-0 rounded-sm p-1 transition-colors hover:bg-destructive/10 hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteProfile(p.id)
                          }}>
                          <Trash2Icon className="h-3.5 w-3.5" />
                        </button>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <Separator />
            </>
          )}

          <div className="grid gap-2">
            <Label htmlFor="ssh-server-url">서버 URL</Label>
            <Input
              id="ssh-server-url"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="ws://localhost:3001"
              required
            />
          </div>

          <Separator />

          <div className="flex gap-3">
            <div className="grid flex-1 gap-2">
              <Label htmlFor="ssh-host">호스트</Label>
              <Input
                id="ssh-host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                placeholder="192.168.1.100"
                required
              />
            </div>
            <div className="grid w-24 gap-2">
              <Label htmlFor="ssh-port">포트</Label>
              <Input id="ssh-port" type="number" value={port} onChange={(e) => setPort(e.target.value)} required />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ssh-username">사용자명</Label>
            <Input
              id="ssh-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="root"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label>인증 방식</Label>
            <RadioGroup value={authMethod} onValueChange={(v) => setAuthMethod(v as AuthMethod)} className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="password" id="auth-password" />
                <Label htmlFor="auth-password" className="font-normal">
                  비밀번호
                </Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="privateKey" id="auth-key" />
                <Label htmlFor="auth-key" className="font-normal">
                  SSH 키
                </Label>
              </div>
            </RadioGroup>
          </div>

          {authMethod === "password" ? (
            <div className="grid gap-2">
              <Label htmlFor="ssh-password">비밀번호</Label>
              <Input id="ssh-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="ssh-private-key">Private Key (PEM)</Label>
              <Textarea
                id="ssh-private-key"
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder={"-----BEGIN OPENSSH PRIVATE KEY-----\n..."}
                rows={6}
                className="resize-y font-mono text-xs"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox id="save-profile" checked={shouldSave} onCheckedChange={(v) => setShouldSave(v === true)} />
            <Label htmlFor="save-profile" className="font-normal">
              접속 정보 저장
            </Label>
          </div>

          {shouldSave && (
            <div className="grid gap-2">
              <Label htmlFor="profile-name">프로필 이름</Label>
              <Input
                id="profile-name"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="프로덕션 서버"
              />
            </div>
          )}

          <Button type="submit" className="w-full">
            연결
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
})
