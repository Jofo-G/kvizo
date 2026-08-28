import { Button } from '@/shared/components/Button'
import { Card } from '@/shared/components/Card'
import { Input } from '@/shared/components/Input'
import { LoadingSpinner } from '@/shared/components/LoadingSpinner'
import type { PlayerProfile } from '@/shared/types'
import { supabase } from '@/supabase/client'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'

async function fetchAllProfiles(): Promise<PlayerProfile[]> {
  const { data, error } = await supabase
    .from('player_profiles')
    .select('*')
    .order('name')
  if (error) throw error
  return data as PlayerProfile[]
}

async function uploadAvatar(file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from('player-avatars')
    .upload(path, file, { contentType: file.type })
  if (error) throw error
  const { data } = supabase.storage.from('player-avatars').getPublicUrl(path)
  return data.publicUrl
}

async function createProfile(name: string, avatarFile: File | null): Promise<PlayerProfile> {
  let avatar_url: string | null = null
  if (avatarFile) avatar_url = await uploadAvatar(avatarFile)
  const { data, error } = await supabase
    .from('player_profiles')
    .insert({ name, avatar_url })
    .select()
    .single()
  if (error) throw error
  return data as PlayerProfile
}

async function deleteProfile(id: string): Promise<void> {
  const { error } = await supabase.from('player_profiles').delete().eq('id', id)
  if (error) throw error
}

export function AdminUsersPage() {
  const queryClient = useQueryClient()
  const { data: profiles, isLoading } = useQuery({
    queryKey: ['player_profiles'],
    queryFn: fetchAllProfiles,
  })

  const createMutation = useMutation({
    mutationFn: ({ name, file }: { name: string; file: File | null }) =>
      createProfile(name, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['player_profiles'] })
      setNewName('')
      setAvatarFile(null)
      setAvatarPreview(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteProfile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['player_profiles'] }),
  })

  const [newName, setNewName] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setAvatarFile(file)
    setAvatarPreview(file ? URL.createObjectURL(file) : null)
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    createMutation.mutate({ name: newName.trim(), file: avatarFile })
  }

  return (
    <div className="min-h-screen bg-wow-bg">
      <header className="border-b border-[#7a5c1c] bg-[#0c0f18] shadow-[0_2px_15px_rgba(200,168,75,0.1)]">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-4">
          <Link
            to="/dashboard"
            className="text-sm text-[#c8a84b] hover:text-[#f0c040] transition-colors"
          >
            ← Dashboard
          </Link>
          <h1 className="text-xl font-bold text-[#c8a84b]" style={{ fontFamily: 'Cinzel, serif' }}>Manage Players</h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <Card className="mb-8">
          <h2 className="mb-4 text-lg font-bold text-[#c8a84b]" style={{ fontFamily: 'Cinzel, serif' }}>Add New Player</h2>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <Input
              label="Player name"
              placeholder="Enter name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
            />

            <div>
              <p className="mb-1 block text-sm font-medium text-[#9d8a5e] uppercase tracking-wider">
                Avatar picture
              </p>
              <div className="flex items-center gap-4">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Preview"
                    className="h-16 w-16 rounded-full object-cover border-2 border-[#c8a84b]"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#10131e] text-2xl text-[#6b5e42] border-2 border-[#7a5c1c]">
                    ?
                  </div>
                )}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {avatarFile ? 'Change picture' : 'Choose picture'}
                </Button>
                {avatarFile && (
                  <button
                    type="button"
                    onClick={() => { setAvatarFile(null); setAvatarPreview(null) }}
                    className="text-sm text-red-400 hover:underline transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {createMutation.error && (
              <p className="text-sm text-red-400">
                {createMutation.error instanceof Error
                  ? createMutation.error.message
                  : 'Failed to create player'}
              </p>
            )}

            <Button
              type="submit"
              disabled={createMutation.isPending || !newName.trim()}
              className="self-start"
            >
              {createMutation.isPending ? 'Creating…' : 'Add Player'}
            </Button>
          </form>
        </Card>

        <h2 className="mb-4 text-lg font-bold text-[#c8a84b]" style={{ fontFamily: 'Cinzel, serif' }}>
          All Players {profiles && `(${profiles.length})`}
        </h2>

        {isLoading ? (
          <LoadingSpinner />
        ) : profiles?.length === 0 ? (
          <Card className="py-8 text-center text-[#9d8a5e]">
            No players yet. Add one above.
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {profiles?.map((p) => (
              <Card key={p.id} className="flex flex-col items-center gap-2 py-4">
                {p.avatar_url ? (
                  <img
                    src={p.avatar_url}
                    alt={p.name}
                    className="h-20 w-20 rounded-full object-cover border-2 border-[#c8a84b]"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#10131e] text-3xl font-bold text-[#c8a84b] border-2 border-[#7a5c1c]">
                    {p.name[0]?.toUpperCase()}
                  </div>
                )}
                <p className="text-center font-semibold text-[#e8d5a0]">
                  {p.name}
                </p>
                <button
                  onClick={() => {
                    if (confirm(`Remove player "${p.name}"?`)) deleteMutation.mutate(p.id)
                  }}
                  disabled={deleteMutation.isPending}
                  className="mt-1 text-xs text-red-400 hover:underline disabled:opacity-40 transition-colors"
                >
                  Remove
                </button>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
