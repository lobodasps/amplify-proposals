import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Download, Loader2, Building2, Users, Tag, Briefcase, BookOpen, Settings2, Bell, User, Brain, ChevronDown, ChevronUp, Eye, EyeOff, RotateCcw, Play, CheckCircle2, XCircle, Upload } from "lucide-react";
import { ImportTab } from "@/components/ImportTab";
import AppLayout from "@/components/AppLayout";

interface Column { key: string; label: string; render?: (row: any) => React.ReactNode; }

function CrudTable({ title, icon, columns, rows, isLoading, onAdd, onEdit, onDelete, csvExport }: {
  title: string; icon?: React.ReactNode; columns: Column[]; rows: any[]; isLoading: boolean;
  onAdd: () => void; onEdit: (row: any) => void; onDelete: (id: string) => void; csvExport?: () => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">{icon}{title}<span className="text-xs font-normal text-muted-foreground ml-1">({rows.length})</span></CardTitle>
        <div className="flex gap-2">
          {csvExport && <Button size="sm" variant="outline" onClick={csvExport}><Download className="h-3 w-3 mr-1" />Export CSV</Button>}
          <Button size="sm" onClick={onAdd}><Plus className="h-3 w-3 mr-1" />Add</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No {title.toLowerCase()} yet. Click "Add" to create one.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-muted/30">{columns.map(col => <th key={col.key} className="text-left p-3 font-medium text-muted-foreground">{col.label}</th>)}<th className="text-right p-3 font-medium text-muted-foreground w-20">Actions</th></tr></thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                    {columns.map(col => <td key={col.key} className="p-3">{col.render ? col.render(row) : (row[col.key] ?? "—")}</td>)}
                    <td className="p-3 text-right">
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(row)}><Pencil className="h-3 w-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => onDelete(row.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EntitiesTab() {
  const utils = trpc.useUtils();
  const { data: entities = [], isLoading } = trpc.entities.list.useQuery();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", shortName: "", badgeColor: "blue", supabaseCompanyId: "", isDefault: false });
  const create = trpc.entities.create.useMutation({ onSuccess: () => { toast.success("Entity created"); utils.entities.list.invalidate(); setOpen(false); }, onError: e => toast.error(e.message) });
  const update = trpc.entities.update.useMutation({ onSuccess: () => { toast.success("Entity updated"); utils.entities.list.invalidate(); setOpen(false); }, onError: e => toast.error(e.message) });
  const del = trpc.entities.delete.useMutation({ onSuccess: () => { toast.success("Entity deleted"); utils.entities.list.invalidate(); }, onError: e => toast.error(e.message) });
  const openAdd = () => { setEditing(null); setForm({ name: "", shortName: "", badgeColor: "blue", supabaseCompanyId: "", isDefault: false }); setOpen(true); };
  const openEdit = (row: any) => { setEditing(row); setForm({ name: row.name, shortName: row.shortName ?? "", badgeColor: row.badgeColor ?? "blue", supabaseCompanyId: row.supabaseCompanyId ?? "", isDefault: !!row.isDefault }); setOpen(true); };
  const BADGE_COLORS = ["blue","emerald","purple","amber","rose","slate"];
  return (
    <>
      <CrudTable title="Entities" icon={<Building2 className="h-4 w-4" />}
        columns={[
          { key: "name", label: "Name" },
          { key: "shortName", label: "Short Name" },
          { key: "badgeColor", label: "Badge", render: row => <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${row.badgeColor==="emerald"?"border-emerald-500 text-emerald-700 bg-emerald-50":row.badgeColor==="purple"?"border-purple-500 text-purple-700 bg-purple-50":row.badgeColor==="amber"?"border-amber-500 text-amber-700 bg-amber-50":row.badgeColor==="rose"?"border-rose-500 text-rose-700 bg-rose-50":"border-blue-500 text-blue-700 bg-blue-50"}`}>{row.shortName??row.name}</span> },
          { key: "isDefault", label: "Default", render: row => row.isDefault ? <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Default</Badge> : null },
          { key: "active", label: "Active", render: row => <span className={`text-xs ${row.active?"text-green-600":"text-muted-foreground"}`}>{row.active?"Yes":"No"}</span> },
        ]}
        rows={entities as any[]} isLoading={isLoading} onAdd={openAdd} onEdit={openEdit} onDelete={id => del.mutate({ id })} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Edit Entity" : "Add Entity"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} /></div>
            <div><Label>Short Name</Label><Input value={form.shortName} onChange={e => setForm(f=>({...f,shortName:e.target.value}))} placeholder="e.g. JPCL" /></div>
            <div><Label>Badge Color</Label><Select value={form.badgeColor} onValueChange={v=>setForm(f=>({...f,badgeColor:v}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BADGE_COLORS.map(c=><SelectItem key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Supabase Company ID</Label><Input value={form.supabaseCompanyId} onChange={e=>setForm(f=>({...f,supabaseCompanyId:e.target.value}))} placeholder="UUID" /></div>
            <div className="flex items-center gap-2"><Switch checked={form.isDefault} onCheckedChange={v=>setForm(f=>({...f,isDefault:v}))} /><Label>Default Entity</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button disabled={!form.name||create.isPending||update.isPending} onClick={()=>editing?update.mutate({id:editing.id,...form}):create.mutate(form)}>
              {(create.isPending||update.isPending)&&<Loader2 className="h-4 w-4 mr-2 animate-spin" />}{editing?"Save Changes":"Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SimpleListTab({ routerKey, title, icon, columns, formFields }: {
  routerKey: "orderTypes"|"departments"|"serviceTypes"|"form254Codes"; title: string; icon: React.ReactNode;
  columns: Column[]; formFields: { key: string; label: string; type?: string; placeholder?: string }[];
}) {
  const utils = trpc.useUtils();
  const { data: rows = [], isLoading } = (trpc as any)[routerKey].list.useQuery();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string,string>>({});
  const create = (trpc as any)[routerKey].create.useMutation({ onSuccess: () => { toast.success(`Created`); (utils as any)[routerKey].list.invalidate(); setOpen(false); }, onError: (e:any) => toast.error(e.message) });
  const update = (trpc as any)[routerKey].update.useMutation({ onSuccess: () => { toast.success(`Updated`); (utils as any)[routerKey].list.invalidate(); setOpen(false); }, onError: (e:any) => toast.error(e.message) });
  const del = (trpc as any)[routerKey].delete.useMutation({ onSuccess: () => { toast.success(`Deleted`); (utils as any)[routerKey].list.invalidate(); }, onError: (e:any) => toast.error(e.message) });
  const openAdd = () => { setEditing(null); setForm(Object.fromEntries(formFields.map(f=>[f.key,""]))); setOpen(true); };
  const openEdit = (row: any) => { setEditing(row); setForm(Object.fromEntries(formFields.map(f=>[f.key,row[f.key]??""]))); setOpen(true); };
  const csvExport = () => {
    const header = columns.map(c=>c.label).join(",");
    const body = (rows as any[]).map((r:any)=>columns.map(c=>`"${(r[c.key]??"").toString().replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([header+"\n"+body],{type:"text/csv"});
    const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=`${title.toLowerCase().replace(/ /g,"-")}.csv`; a.click(); URL.revokeObjectURL(url);
  };
  return (
    <>
      <CrudTable title={title} icon={icon} columns={columns} rows={rows as any[]} isLoading={isLoading} onAdd={openAdd} onEdit={openEdit} onDelete={id=>del.mutate({id})} csvExport={csvExport} />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing?`Edit ${title.slice(0,-1)}`:`Add ${title.slice(0,-1)}`}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            {formFields.map(f=>(
              <div key={f.key}><Label>{f.label}</Label>
                {f.type==="textarea"?<Textarea value={form[f.key]??""} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder} rows={2}/>:<Input value={form[f.key]??""} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))} placeholder={f.placeholder}/>}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button disabled={!form[formFields[0].key]||create.isPending||update.isPending} onClick={()=>editing?update.mutate({id:editing.id,...form}):create.mutate(form)}>
              {(create.isPending||update.isPending)&&<Loader2 className="h-4 w-4 mr-2 animate-spin" />}{editing?"Save Changes":"Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function OrganizationsTab() {
  const utils = trpc.useUtils();
  const { data: orgs = [], isLoading } = trpc.organizations.list.useQuery({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name:"",type:"client",city:"",state:"",phone:"",email:"",website:"",notes:"" });
  const create = trpc.organizations.create.useMutation({ onSuccess: () => { toast.success("Organization created"); utils.organizations.list.invalidate({}); setOpen(false); }, onError: e=>toast.error(e.message) });
  const update = trpc.organizations.update.useMutation({ onSuccess: () => { toast.success("Organization updated"); utils.organizations.list.invalidate({}); setOpen(false); }, onError: e=>toast.error(e.message) });
  const del = trpc.organizations.delete.useMutation({ onSuccess: () => { toast.success("Organization deleted"); utils.organizations.list.invalidate({}); }, onError: e=>toast.error(e.message) });
  const openAdd = () => { setEditing(null); setForm({name:"",type:"client",city:"",state:"",phone:"",email:"",website:"",notes:""}); setOpen(true); };
  const openEdit = (row:any) => { setEditing(row); setForm({name:row.name,type:row.type??"client",city:row.city??"",state:row.state??"",phone:row.phone??"",email:row.email??"",website:row.website??"",notes:row.notes??""}); setOpen(true); };
  const ORG_TYPES = ["client","agency","prime","subconsultant","vendor","other"];
  return (
    <>
      <CrudTable title="Organizations" icon={<Building2 className="h-4 w-4" />}
        columns={[{key:"name",label:"Name"},{key:"type",label:"Type",render:row=><Badge variant="outline" className="text-xs capitalize">{row.type??"—"}</Badge>},{key:"city",label:"City"},{key:"state",label:"State"},{key:"email",label:"Email"},{key:"phone",label:"Phone"}]}
        rows={orgs as any[]} isLoading={isLoading} onAdd={openAdd} onEdit={openEdit} onDelete={id=>del.mutate({id})}
        csvExport={()=>{const r2=orgs as any[];const h="Name,Type,City,State,Email,Phone";const b=r2.map((r:any)=>`"${r.name}","${r.type??''}","${r.city??''}","${r.state??''}","${r.email??''}","${r.phone??''}"`).join("\n");const blob=new Blob([h+"\n"+b],{type:"text/csv"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="organizations.csv";a.click();URL.revokeObjectURL(url);}}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?"Edit Organization":"Add Organization"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div><Label>Name *</Label><Input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} /></div>
            <div><Label>Type</Label><Select value={form.type} onValueChange={v=>setForm(f=>({...f,type:v}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ORG_TYPES.map(t=><SelectItem key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid grid-cols-2 gap-3"><div><Label>City</Label><Input value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))} /></div><div><Label>State</Label><Input value={form.state} onChange={e=>setForm(f=>({...f,state:e.target.value}))} placeholder="NJ" /></div></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} /></div>
            <div><Label>Website</Label><Input value={form.website} onChange={e=>setForm(f=>({...f,website:e.target.value}))} /></div>
            <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button disabled={!form.name||create.isPending||update.isPending} onClick={()=>editing?update.mutate({id:editing.id,...form}):create.mutate(form)}>
              {(create.isPending||update.isPending)&&<Loader2 className="h-4 w-4 mr-2 animate-spin" />}{editing?"Save Changes":"Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PeopleTab() {
  const utils = trpc.useUtils();
  const { data: people = [], isLoading } = trpc.people.list.useQuery({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ firstName:"",lastName:"",title:"",email:"",phone:"",notes:"" });
  const create = trpc.people.create.useMutation({ onSuccess: () => { toast.success("Person created"); utils.people.list.invalidate({}); setOpen(false); }, onError: e=>toast.error(e.message) });
  const update = trpc.people.update.useMutation({ onSuccess: () => { toast.success("Person updated"); utils.people.list.invalidate({}); setOpen(false); }, onError: e=>toast.error(e.message) });
  const del = trpc.people.delete.useMutation({ onSuccess: () => { toast.success("Person deleted"); utils.people.list.invalidate({}); }, onError: e=>toast.error(e.message) });
  const openAdd = () => { setEditing(null); setForm({firstName:"",lastName:"",title:"",email:"",phone:"",notes:""}); setOpen(true); };
  const openEdit = (row:any) => { setEditing(row); setForm({firstName:row.firstName,lastName:row.lastName??"",title:row.title??"",email:row.email??"",phone:row.phone??"",notes:row.notes??""}); setOpen(true); };
  return (
    <>
      <CrudTable title="People" icon={<Users className="h-4 w-4" />}
        columns={[{key:"firstName",label:"First Name"},{key:"lastName",label:"Last Name"},{key:"title",label:"Title"},{key:"email",label:"Email"},{key:"phone",label:"Phone"}]}
        rows={people as any[]} isLoading={isLoading} onAdd={openAdd} onEdit={openEdit} onDelete={id=>del.mutate({id})}
        csvExport={()=>{const r2=people as any[];const h="First Name,Last Name,Title,Email,Phone";const b=r2.map((r:any)=>`"${r.firstName}","${r.lastName??''}","${r.title??''}","${r.email??''}","${r.phone??''}"`).join("\n");const blob=new Blob([h+"\n"+b],{type:"text/csv"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="people.csv";a.click();URL.revokeObjectURL(url);}}
      />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?"Edit Person":"Add Person"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3"><div><Label>First Name *</Label><Input value={form.firstName} onChange={e=>setForm(f=>({...f,firstName:e.target.value}))} /></div><div><Label>Last Name</Label><Input value={form.lastName} onChange={e=>setForm(f=>({...f,lastName:e.target.value}))} /></div></div>
            <div><Label>Title</Label><Input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} /></div>
            <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button disabled={!form.firstName||create.isPending||update.isPending} onClick={()=>editing?update.mutate({id:editing.id,...form}):create.mutate(form)}>
              {(create.isPending||update.isPending)&&<Loader2 className="h-4 w-4 mr-2 animate-spin" />}{editing?"Save Changes":"Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function GlossaryTab() {
  const utils = trpc.useUtils();
  const { data: terms = [], isLoading } = trpc.glossary.list.useQuery({});
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ term:"",definition:"",category:"",source:"" });
  const create = trpc.glossary.create.useMutation({ onSuccess: () => { toast.success("Term created"); utils.glossary.list.invalidate({}); setOpen(false); }, onError: e=>toast.error(e.message) });
  const update = trpc.glossary.update.useMutation({ onSuccess: () => { toast.success("Term updated"); utils.glossary.list.invalidate({}); setOpen(false); }, onError: e=>toast.error(e.message) });
  const del = trpc.glossary.delete.useMutation({ onSuccess: () => { toast.success("Term deleted"); utils.glossary.list.invalidate({}); }, onError: e=>toast.error(e.message) });
  const seed = trpc.glossary.seed.useMutation({ onSuccess: () => { toast.success("Glossary seeded"); utils.glossary.list.invalidate({}); }, onError: e=>toast.error(e.message) });
  const openAdd = () => { setEditing(null); setForm({term:"",definition:"",category:"",source:""}); setOpen(true); };
  const openEdit = (row:any) => { setEditing(row); setForm({term:row.term,definition:row.definition??"",category:row.category??"",source:row.source??""}); setOpen(true); };
  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4" />Glossary<span className="text-xs font-normal text-muted-foreground ml-1">({(terms as any[]).length})</span></CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={()=>seed.mutate()} disabled={seed.isPending}>{seed.isPending?<Loader2 className="h-3 w-3 mr-1 animate-spin"/>:<Plus className="h-3 w-3 mr-1"/>}Seed AEC Terms</Button>
            <Button size="sm" onClick={openAdd}><Plus className="h-3 w-3 mr-1"/>Add Term</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground"/></div>
          : (terms as any[]).length===0 ? <div className="text-center py-12 text-muted-foreground text-sm">No glossary terms yet. Click "Seed AEC Terms" to add common terms.</div>
          : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-muted/30"><th className="text-left p-3 font-medium text-muted-foreground">Term</th><th className="text-left p-3 font-medium text-muted-foreground">Definition</th><th className="text-left p-3 font-medium text-muted-foreground">Category</th><th className="text-right p-3 font-medium text-muted-foreground w-20">Actions</th></tr></thead>
            <tbody>{(terms as any[]).map((row:any)=><tr key={row.id} className="border-b last:border-0 hover:bg-muted/20"><td className="p-3 font-medium">{row.term}</td><td className="p-3 text-muted-foreground max-w-sm truncate">{row.definition??"—"}</td><td className="p-3"><Badge variant="outline" className="text-xs">{row.category??"General"}</Badge></td><td className="p-3 text-right"><div className="flex gap-1 justify-end"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={()=>openEdit(row)}><Pencil className="h-3 w-3"/></Button><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={()=>del.mutate({id:row.id})}><Trash2 className="h-3 w-3"/></Button></div></td></tr>)}</tbody>
          </table></div>}
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?"Edit Term":"Add Term"}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label>Term *</Label><Input value={form.term} onChange={e=>setForm(f=>({...f,term:e.target.value}))} /></div>
            <div><Label>Definition</Label><Textarea rows={3} value={form.definition} onChange={e=>setForm(f=>({...f,definition:e.target.value}))} /></div>
            <div><Label>Category</Label><Input value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} placeholder="e.g. Contract, Billing, Compliance" /></div>
            <div><Label>Source</Label><Input value={form.source} onChange={e=>setForm(f=>({...f,source:e.target.value}))} placeholder="e.g. FAR, AIA, Internal" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button disabled={!form.term||create.isPending||update.isPending} onClick={()=>editing?update.mutate({id:editing.id,...form}):create.mutate(form)}>
              {(create.isPending||update.isPending)&&<Loader2 className="h-4 w-4 mr-2 animate-spin"/>}{editing?"Save Changes":"Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AppSettingsTab() {
  const utils = trpc.useUtils();
  const { data: settings = [], isLoading } = trpc.appSettings.list.useQuery();
  const set = trpc.appSettings.set.useMutation({ onSuccess: () => { toast.success("Setting saved"); utils.appSettings.list.invalidate(); }, onError: e=>toast.error(e.message) });
  const getValue = (key: string) => (settings as any[]).find((s:any)=>s.key===key)?.value??"";
  const GROUPS = [
    { group:"Company", items:[{key:"company_name",label:"Company Name",placeholder:"e.g. JPCL"},{key:"company_address",label:"Company Address",placeholder:"123 Main St"},{key:"company_phone",label:"Company Phone",placeholder:"(973) 555-0100"},{key:"company_email",label:"Company Email",placeholder:"info@jpcl.com"}] },
    { group:"Contract Defaults", items:[{key:"default_contract_vehicle",label:"Default Contract Vehicle",placeholder:"standalone"},{key:"default_billing_basis",label:"Default Billing Basis",placeholder:"authorized | nte_ceiling"},{key:"contract_number_prefix_jpcl",label:"JPCL Number Prefix",placeholder:"YY-NNN"},{key:"contract_number_prefix_strans",label:"Strans Number Prefix",placeholder:"STR-YY-NNN"}] },
    { group:"Compliance Reminders", items:[{key:"coi_reminder_days",label:"COI Expiration Reminder (days before)",placeholder:"30"},{key:"contract_end_reminder_days",label:"Contract End Reminder (days before)",placeholder:"60"}] },
  ];
  return (
    <div className="space-y-6">
      {isLoading ? <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground"/></div>
      : GROUPS.map(group=>(
        <Card key={group.group}>
          <CardHeader><CardTitle className="text-base">{group.group}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {group.items.map(item=>(
              <div key={item.key} className="flex items-center gap-4">
                <Label className="w-56 shrink-0 text-sm">{item.label}</Label>
                <Input className="max-w-sm" defaultValue={getValue(item.key)} placeholder={item.placeholder}
                  onBlur={e=>{ if(e.target.value!==getValue(item.key)) set.mutate({key:item.key,value:e.target.value}); }} />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function Settings() {
  return (
    <AppLayout>
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage entities, lookup tables, organizations, people, and application settings.</p>
      </div>
      <Tabs defaultValue="entities">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="entities">Entities</TabsTrigger>
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="orderTypes">Order Types</TabsTrigger>
          <TabsTrigger value="departments">Departments</TabsTrigger>
          <TabsTrigger value="serviceTypes">Service Types</TabsTrigger>
          <TabsTrigger value="form254">Form 254 Codes</TabsTrigger>
          <TabsTrigger value="glossary">Glossary</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="reminders">Reminders</TabsTrigger>
          <TabsTrigger value="appSettings">App Settings</TabsTrigger>
          <TabsTrigger value="aiSkills" className="flex items-center gap-1"><Brain className="h-3 w-3" />AI Skills</TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-1"><Upload className="h-3 w-3" />Import</TabsTrigger>
        </TabsList>
        <TabsContent value="entities" className="mt-4"><EntitiesTab /></TabsContent>
        <TabsContent value="organizations" className="mt-4"><OrganizationsTab /></TabsContent>
        <TabsContent value="people" className="mt-4"><PeopleTab /></TabsContent>
        <TabsContent value="orderTypes" className="mt-4">
          <SimpleListTab routerKey="orderTypes" title="Order Types" icon={<Tag className="h-4 w-4"/>}
            columns={[{key:"name",label:"Name"},{key:"description",label:"Description"}]}
            formFields={[{key:"name",label:"Name *"},{key:"description",label:"Description",type:"textarea"}]} />
        </TabsContent>
        <TabsContent value="departments" className="mt-4">
          <SimpleListTab routerKey="departments" title="Departments" icon={<Briefcase className="h-4 w-4"/>}
            columns={[{key:"name",label:"Name"},{key:"code",label:"Code"},{key:"description",label:"Description"}]}
            formFields={[{key:"name",label:"Name *"},{key:"code",label:"Code",placeholder:"e.g. STRUCT"},{key:"description",label:"Description",type:"textarea"}]} />
        </TabsContent>
        <TabsContent value="serviceTypes" className="mt-4">
          <SimpleListTab routerKey="serviceTypes" title="Service Types" icon={<Settings2 className="h-4 w-4"/>}
            columns={[{key:"name",label:"Name"},{key:"code",label:"Code"},{key:"description",label:"Description"}]}
            formFields={[{key:"name",label:"Name *"},{key:"code",label:"Code",placeholder:"e.g. ARCH"},{key:"description",label:"Description",type:"textarea"}]} />
        </TabsContent>
        <TabsContent value="form254" className="mt-4">
          <SimpleListTab routerKey="form254Codes" title="Form 254 Codes" icon={<Tag className="h-4 w-4"/>}
            columns={[{key:"code",label:"Code"},{key:"description",label:"Description"}]}
            formFields={[{key:"code",label:"Code *",placeholder:"e.g. 01"},{key:"description",label:"Description",type:"textarea"}]} />
        </TabsContent>
        <TabsContent value="glossary" className="mt-4"><GlossaryTab /></TabsContent>
        <TabsContent value="users" className="mt-4">
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><User className="h-4 w-4"/>Users</CardTitle></CardHeader>
          <CardContent className="py-8 text-center text-muted-foreground"><p className="text-sm">User management is handled through the Manus platform authentication system.</p><p className="text-sm mt-1">All authenticated users can access Amplify-Proposals based on their Manus login.</p></CardContent></Card>
        </TabsContent>
        <TabsContent value="reminders" className="mt-4">
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Bell className="h-4 w-4"/>Reminders</CardTitle></CardHeader>
          <CardContent className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">Reminders are automatically generated based on contract end dates and COI expiration dates. Configure reminder lead times in the App Settings tab.</p>
            <div className="space-y-3">
              {[{label:"COI Expiration Reminders",desc:"Alerts when COI is expiring within the configured window"},{label:"Contract End Date Reminders",desc:"Alerts when contracts are approaching their end date"},{label:"Compliance Flags",desc:"Automatic flags for missing executed contracts, prime agreements, etc."}].map(item=>(
                <div key={item.label} className="flex items-start gap-3 p-3 rounded-lg border"><Bell className="h-4 w-4 text-primary mt-0.5 shrink-0"/><div><p className="text-sm font-medium">{item.label}</p><p className="text-xs text-muted-foreground">{item.desc}</p></div></div>
              ))}
            </div>
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="appSettings" className="mt-4"><AppSettingsTab /></TabsContent>
        <TabsContent value="aiSkills" className="mt-4"><AiSkillsTab /></TabsContent>
        <TabsContent value="import" className="mt-4"><ImportTab /></TabsContent>
      </Tabs>
    </div>
    </AppLayout>
  );
}

// ─── AI Skills Tab ─────────────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<string, string> = {
  manus_builtin: "Manus Built-in",
  openai: "OpenAI",
  anthropic: "Anthropic",
  google_gemini: "Google Gemini",
  azure_openai: "Azure OpenAI",
};

const PROVIDER_MODELS: Record<string, string[]> = {
  manus_builtin: ["gemini-2.5-flash", "gemini-2.5-pro"],
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o3", "o4-mini"],
  anthropic: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
  google_gemini: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-1.5-pro"],
  azure_openai: ["gpt-4o", "gpt-4-turbo"],
};

const SKILL_ICONS: Record<string, string> = {
  rfp_shredder: "📄",
  resume_tailor: "👤",
  go_no_go_advisor: "🎯",
  opportunity_scorer: "⭐",
  contract_analyzer: "📋",
  asset_tagger: "🏷️",
  proposal_writer: "✍️",
  proposal_scorer: "📊",
  opportunity_ingestion: "🔍",
};

function SkillCard({ skill }: { skill: any }) {
  const utils = trpc.useUtils();
  const [expanded, setExpanded] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; provider: string; model: string; response: string } | null>(null);
  const [form, setForm] = useState({
    provider: skill.provider ?? "manus_builtin",
    model: skill.model ?? "",
    apiKey: "",
    baseUrl: skill.baseUrl ?? "",
    systemPrompt: skill.systemPrompt ?? "",
    userPromptTemplate: skill.userPromptTemplate ?? "",
    enabled: skill.enabled ?? true,
  });
  const [dirty, setDirty] = useState(false);

  const update = (patch: Partial<typeof form>) => {
    setForm(f => ({ ...f, ...patch }));
    setDirty(true);
  };

  const upsert = trpc.aiSkills.upsert.useMutation({
    onSuccess: () => { toast.success("Skill saved"); utils.aiSkills.list.invalidate(); setDirty(false); },
    onError: e => toast.error(e.message),
  });

  const reset = trpc.aiSkills.resetToDefaults.useMutation({
    onSuccess: (_, vars) => {
      toast.success("Prompts reset to defaults");
      utils.aiSkills.list.invalidate();
      setDirty(false);
    },
    onError: e => toast.error(e.message),
  });

  const test = trpc.aiSkills.test.useMutation({
    onSuccess: (data) => {
      setTestResult(data);
    },
    onError: e => toast.error(e.message),
  });

  const templateVars: string[] = (() => {
    try { return JSON.parse(skill.templateVariables ?? "[]"); } catch { return []; }
  })();

  const suggestedModels = PROVIDER_MODELS[form.provider] ?? [];

  return (
    <Card className={`transition-all ${!form.enabled ? "opacity-60" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{SKILL_ICONS[skill.skillType] ?? "🤖"}</span>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {skill.displayName}
                {dirty && <Badge variant="outline" className="text-xs text-amber-600 border-amber-400">Unsaved</Badge>}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">{skill.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <Switch
                checked={form.enabled}
                onCheckedChange={v => {
                  update({ enabled: v });
                  upsert.mutate({ skillType: skill.skillType, provider: form.provider, model: form.model, systemPrompt: form.systemPrompt, userPromptTemplate: form.userPromptTemplate, enabled: v });
                }}
              />
              <span className="text-xs text-muted-foreground">{form.enabled ? "On" : "Off"}</span>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setExpanded(e => !e)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Collapsed summary row */}
        {!expanded && (
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <Badge variant="secondary" className="text-xs">{PROVIDER_LABELS[form.provider] ?? form.provider}</Badge>
            {form.model && <span className="text-xs text-muted-foreground font-mono">{form.model}</span>}
            {form.provider !== "manus_builtin" && (
              <span className="text-xs text-muted-foreground">{skill.apiKey ? "🔑 Key configured" : "⚠️ No API key"}</span>
            )}
          </div>
        )}
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-5 pt-0">
          {/* Provider + Model */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs mb-1.5 block">Provider</Label>
              <Select value={form.provider} onValueChange={v => update({ provider: v, model: PROVIDER_MODELS[v]?.[0] ?? "" })}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PROVIDER_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Model</Label>
              <div className="flex gap-1">
                <Input
                  className="h-8 text-sm font-mono"
                  value={form.model}
                  onChange={e => update({ model: e.target.value })}
                  placeholder={suggestedModels[0] ?? "e.g. gpt-4o"}
                  list={`models-${skill.skillType}`}
                />
                <datalist id={`models-${skill.skillType}`}>
                  {suggestedModels.map(m => <option key={m} value={m} />)}
                </datalist>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Suggestions: {suggestedModels.slice(0, 3).join(", ")}</p>
            </div>
          </div>

          {/* API Key (hidden for manus_builtin) */}
          {form.provider !== "manus_builtin" && (
            <div>
              <Label className="text-xs mb-1.5 block">API Key</Label>
              <div className="flex gap-1">
                <Input
                  className="h-8 text-sm font-mono"
                  type={showKey ? "text" : "password"}
                  value={form.apiKey}
                  onChange={e => update({ apiKey: e.target.value })}
                  placeholder={skill.apiKey ? "••••••••••••••••  (stored — enter to replace)" : "sk-..."}
                />
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => setShowKey(s => !s)}>
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Stored encrypted. Leave blank to keep the existing key.</p>
            </div>
          )}

          {/* Azure Base URL */}
          {form.provider === "azure_openai" && (
            <div>
              <Label className="text-xs mb-1.5 block">Azure Endpoint Base URL</Label>
              <Input
                className="h-8 text-sm"
                value={form.baseUrl}
                onChange={e => update({ baseUrl: e.target.value })}
                placeholder="https://your-resource.openai.azure.com/openai/deployments/gpt-4o"
              />
            </div>
          )}

          {/* System Prompt */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs">System Prompt</Label>
              <Button size="sm" variant="ghost" className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground"
                onClick={() => reset.mutate({ skillType: skill.skillType })}>
                <RotateCcw className="h-3 w-3" />Reset to default
              </Button>
            </div>
            <Textarea
              className="text-xs font-mono min-h-[120px] resize-y"
              value={form.systemPrompt}
              onChange={e => update({ systemPrompt: e.target.value })}
            />
          </div>

          {/* User Prompt Template */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs">User Prompt Template</Label>
              <div className="flex gap-1 flex-wrap">
                {templateVars.map(v => (
                  <code key={v} className="text-xs bg-muted px-1.5 py-0.5 rounded border font-mono text-muted-foreground">
                    {`{{${v}}}`}
                  </code>
                ))}
              </div>
            </div>
            <Textarea
              className="text-xs font-mono min-h-[140px] resize-y"
              value={form.userPromptTemplate}
              onChange={e => update({ userPromptTemplate: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use <code className="bg-muted px-1 rounded">{`{{variableName}}`}</code> placeholders — they are filled at runtime from the relevant record.
            </p>
          </div>

          {/* Test result */}
          {testResult && (
            <div className={`rounded-lg border p-3 text-xs ${testResult.success ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}>
              <div className="flex items-center gap-2 mb-2 font-medium">
                {testResult.success
                  ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                  : <XCircle className="h-4 w-4 text-red-600" />}
                {testResult.success ? `Success — ${testResult.provider} / ${testResult.model}` : "Test Failed"}
              </div>
              <pre className="whitespace-pre-wrap break-words text-xs font-mono max-h-48 overflow-y-auto">
                {testResult.response}
              </pre>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-1">
            <Button
              size="sm" variant="outline"
              disabled={test.isPending}
              onClick={() => { setTestResult(null); test.mutate({ skillType: skill.skillType }); }}
            >
              {test.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
              Test with Sample Data
            </Button>
            <Button
              size="sm"
              disabled={!dirty || upsert.isPending}
              onClick={() => upsert.mutate({
                skillType: skill.skillType,
                provider: form.provider as any,
                model: form.model || undefined,
                apiKey: form.apiKey || undefined,
                baseUrl: form.baseUrl || undefined,
                systemPrompt: form.systemPrompt,
                userPromptTemplate: form.userPromptTemplate,
                enabled: form.enabled,
              })}
            >
              {upsert.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
              Save Changes
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

function AiSkillsTab() {
  const { data: skills = [], isLoading } = trpc.aiSkills.list.useQuery();

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Brain className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-base">AI Skills Configuration</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Each skill is an AI task with its own provider, model, API key, and editable prompts.
            Choose from Manus Built-in (no key needed), OpenAI, Anthropic, or Google Gemini for each task independently.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 text-xs text-muted-foreground bg-muted/40 rounded-lg p-3 border">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Object.entries(PROVIDER_LABELS).map(([k, v]) => (
            <div key={k} className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${k === "manus_builtin" ? "bg-blue-500" : k === "openai" ? "bg-green-500" : k === "anthropic" ? "bg-orange-500" : k === "google_gemini" ? "bg-purple-500" : "bg-slate-500"}`} />
              <span>{v}</span>
            </div>
          ))}
        </div>
        <p>Manus Built-in requires no API key. All other providers require you to enter your own key — stored encrypted per skill.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {(skills as any[]).map((skill: any) => (
            <SkillCard key={skill.skillType} skill={skill} />
          ))}
        </div>
      )}
    </div>
  );
}
