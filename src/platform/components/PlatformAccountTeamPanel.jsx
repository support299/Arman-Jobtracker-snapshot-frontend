import { useMemo, useState } from "react"
import { Pencil, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
  useCreatePlatformTeamMemberMutation,
  useDeletePlatformTeamMemberMutation,
  useGetPlatformAccountTeamQuery,
  useUpdatePlatformTeamMemberMutation,
} from "../../store/api/platformApi"
import { USER_PASSWORD } from "../../store/axios/axios"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TableSkeleton } from "@/components/ui/skeletons"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import StatusBadge from "./StatusBadge"
import { formatDateTime } from "../utils/formatters"

const ROLE_LABELS = {
  manager: "Manager",
  supervisor: "Supervisor",
  worker: "Worker",
}

const EMPTY_FORM = {
  first_name: "",
  last_name: "",
  email: "",
  role: "worker",
  is_active: true,
}

export default function PlatformAccountTeamPanel({ accountId }) {
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [role, setRole] = useState("")
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editingMember, setEditingMember] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const params = useMemo(() => {
    const p = { id: accountId, page }
    if (search) p.search = search
    if (role) p.role = role
    return p
  }, [accountId, search, role, page])

  const { data, isLoading, isError, error } = useGetPlatformAccountTeamQuery(params, {
    skip: !accountId,
  })
  const [createMember, { isLoading: creating }] = useCreatePlatformTeamMemberMutation()
  const [updateMember, { isLoading: updating }] = useUpdatePlatformTeamMemberMutation()
  const [deleteMember, { isLoading: deleting }] = useDeletePlatformTeamMemberMutation()

  const members = data?.results || []
  const total = data?.count || 0
  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const openCreate = () => {
    setEditingMember(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  const openEdit = (member) => {
    setEditingMember(member)
    setForm({
      first_name: member.first_name || "",
      last_name: member.last_name || "",
      email: member.email || "",
      role: member.role || "worker",
      is_active: member.is_active !== false,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!form.email.trim() || !form.first_name.trim()) {
      toast.error("First name and email are required")
      return
    }
    try {
      if (editingMember) {
        await updateMember({
          accountId,
          userId: editingMember.id,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim(),
          role: form.role,
          is_active: form.is_active,
        }).unwrap()
        toast.success("Team member updated")
      } else {
        await createMember({
          id: accountId,
          username: form.email.trim(),
          email: form.email.trim(),
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          role: form.role,
          password: USER_PASSWORD,
          is_active: form.is_active,
        }).unwrap()
        toast.success("Team member created")
      }
      setDialogOpen(false)
    } catch (err) {
      toast.error(err?.data?.detail || err?.data?.email?.[0] || "Failed to save team member")
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMember({ accountId, userId: deleteTarget.id }).unwrap()
      toast.success("Team member removed")
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err?.data?.detail || "Failed to delete team member")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Team members</h3>
          <p className="text-sm text-muted-foreground">Account staff only — agency users are excluded</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />Add member
        </Button>
      </div>

      <Card className="p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setSearch(searchInput.trim())
            setPage(1)
          }}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by name or email…"
              className="pl-9"
            />
          </div>
          <div className="w-full sm:w-40">
            <Select value={role || "all"} onValueChange={(v) => { setRole(v === "all" ? "" : v); setPage(1) }}>
              <SelectTrigger><SelectValue placeholder="All roles" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="worker">Worker</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit">Search</Button>
        </form>
      </Card>

      {isError && (
        <Alert variant="destructive">
          <AlertDescription>{error?.data?.detail || "Failed to load team members"}</AlertDescription>
        </Alert>
      )}

      {isLoading ? (
        <TableSkeleton rows={6} columns={7} />
      ) : members.length === 0 ? (
        <Card className="py-12 text-center">
          <p className="text-muted-foreground">No team members found for this account.</p>
          <Button className="mt-4" variant="outline" onClick={openCreate}>Add first member</Button>
        </Card>
      ) : (
        <>
          <div className="overflow-hidden rounded-lg border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>GHL user ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="font-medium">{member.full_name || member.username}</div>
                    </TableCell>
                    <TableCell className="text-sm">{member.email || "—"}</TableCell>
                    <TableCell>
                      <StatusBadge
                        status="active"
                        label={ROLE_LABELS[member.role] || member.role || "Unknown"}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{member.ghl_user_id || "—"}</TableCell>
                    <TableCell>
                      <StatusBadge
                        status={member.is_active ? "healthy" : "inactive"}
                        label={member.is_active ? "Active" : "Inactive"}
                      />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDateTime(member.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(member)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(member)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{total} team member{total === 1 ? "" : "s"}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <span className="flex items-center px-2">Page {page} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMember ? "Edit team member" : "Add team member"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>First name</Label>
                <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Last name</Label>
                <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={!!editingMember} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="supervisor">Supervisor</SelectItem>
                  <SelectItem value="worker">Worker</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>Active</Label>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
            {!editingMember && (
              <p className="text-xs text-muted-foreground">
                A default password will be assigned (same as tenant team onboarding).
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={creating || updating}>
              {editingMember ? "Save changes" : "Create member"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove team member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {deleteTarget?.email || "this user"} from the account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
