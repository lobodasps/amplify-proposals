import AppLayout from "@/components/AppLayout";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Building2, Users, Shield, Bell, Palette, Database, Link2,
  Key, Globe, FileText, Zap, ChevronRight, Check
} from "lucide-react";

const ROLES = [
  { role: "Administrator", users: 1, color: "bg-gray-100 text-gray-700", desc: "Full platform access, user management, system config" },
  { role: "Executive", users: 2, color: "bg-amber-100 text-amber-700", desc: "Read-only analytics, pipeline overview, contract summaries" },
  { role: "Business Development", users: 2, color: "bg-blue-100 text-blue-700", desc: "Pursuits, opportunities, pipeline, proposals (create/edit)" },
  { role: "Proposal Coordinator", users: 2, color: "bg-rose-100 text-rose-700", desc: "Full proposal workspace, assignments, asset management" },
  { role: "Project Manager / Seller-Doer", users: 3, color: "bg-teal-100 text-teal-700", desc: "Proposals (contribute), projects, resumes, contracts (view)" },
  { role: "Technical Reviewer", users: 3, color: "bg-violet-100 text-violet-700", desc: "Proposals (review/comment), knowledge hub, assets" },
  { role: "Designer", users: 1, color: "bg-pink-100 text-pink-700", desc: "Assets, InDesign export, proposals (design sections only)" },
  { role: "Contract Manager", users: 1, color: "bg-indigo-100 text-indigo-700", desc: "Contracts (full), proposals (view), projects (view)" },
  { role: "Read-Only Contributor", users: 4, color: "bg-gray-100 text-gray-500", desc: "View-only access across all modules" },
];

const INTEGRATIONS = [
  { name: "Adobe InDesign (API Export)", status: "configured", icon: "🎨", desc: "JSON/XML/CSV export packages for InDesign Data Merge" },
  { name: "Supabase / Postgres", status: "configured", icon: "🗄️", desc: "Primary database — portable Postgres schema" },
  { name: "NJDOT Procurement Portal", status: "configured", icon: "🌐", desc: "Auto-ingests RFQs/RFPs from NJDOT procurement" },
  { name: "NYC DDC Vendor Portal", status: "configured", icon: "🌐", desc: "Monitors NYC DDC solicitations" },
  { name: "NYC DOT Procurement", status: "configured", icon: "🌐", desc: "Monitors NYCDOT solicitations" },
  { name: "NJDEP eBid", status: "pending", icon: "🌐", desc: "NJDEP electronic bidding portal — pending API key" },
  { name: "SAM.gov / Federal", status: "pending", icon: "🏛️", desc: "Federal opportunity monitoring — optional" },
  { name: "Microsoft Word Export", status: "configured", icon: "📄", desc: "DOCX export for proposals and resumes" },
  { name: "PowerPoint Export", status: "configured", icon: "📊", desc: "PPTX export for pitch decks" },
  { name: "SF 330 Generator", status: "configured", icon: "📋", desc: "Auto-populates SF 330 forms from firm data" },
];

const SERVICE_LINES = [
  "Special Inspections",
  "Construction Management",
  "Traffic Engineering",
  "Landscape / Streetscape",
  "Environmental",
];

const TABS = ["Firm Profile", "Roles & Permissions", "Integrations", "Service Lines", "Notifications", "API & Security"];

export default function Settings() {
  const [activeTab, setActiveTab] = useState("Firm Profile");
  const [firmName, setFirmName] = useState("Amplify Engineering Group");
  const [firmState, setFirmState] = useState("NJ, NY");

  return (
    <AppLayout title="Settings">
      <div className="p-6">
        <div className="flex gap-6">
          {/* Sidebar Nav */}
          <div className="w-48 flex-shrink-0 space-y-1">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-between group ${
                  activeTab === tab
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {tab}
                <ChevronRight className={`w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity ${activeTab === tab ? "opacity-100" : ""}`} />
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-5">
            {activeTab === "Firm Profile" && (
              <>
                <Card className="border-border/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2"><Building2 className="w-4 h-4 text-primary" />Firm Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Firm Name</label>
                        <Input value={firmName} onChange={e => setFirmName(e.target.value)} className="h-9 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Primary Markets</label>
                        <Input value={firmState} onChange={e => setFirmState(e.target.value)} className="h-9 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">Primary Office</label>
                        <Input defaultValue="Newark, NJ" className="h-9 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">DUNS / UEI</label>
                        <Input defaultValue="079-XXXXXXX" className="h-9 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">NJDOT Prequalification #</label>
                        <Input defaultValue="NJ-PREQ-XXXX" className="h-9 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1 block">NYC Vendor ID</label>
                        <Input defaultValue="NYC-VEND-XXXX" className="h-9 text-sm" />
                      </div>
                    </div>
                    <Button
                      className="bg-gradient-to-r from-amplify-blue to-amplify-violet text-white font-semibold"
                      onClick={() => toast.success("Firm profile saved")}
                    >
                      Save Changes
                    </Button>
                  </CardContent>
                </Card>
              </>
            )}

            {activeTab === "Roles & Permissions" && (
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2"><Shield className="w-4 h-4 text-primary" />Role-Based Access Control</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {ROLES.map(r => (
                      <div key={r.role} className="flex items-start gap-3 p-3 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${r.color}`}>{r.role}</span>
                            <span className="text-xs text-muted-foreground">{r.users} user{r.users !== 1 ? "s" : ""}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{r.desc}</p>
                        </div>
                        <Button size="sm" variant="outline" className="h-7 text-xs flex-shrink-0" onClick={() => toast.info(`Editing permissions for: ${r.role}`)}>
                          Edit
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === "Integrations" && (
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2"><Link2 className="w-4 h-4 text-primary" />Platform Integrations</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {INTEGRATIONS.map(i => (
                      <div key={i.name} className="flex items-center gap-3 p-3 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors">
                        <span className="text-xl flex-shrink-0">{i.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-foreground">{i.name}</div>
                          <div className="text-xs text-muted-foreground">{i.desc}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {i.status === "configured" ? (
                            <Badge className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200 gap-1">
                              <Check className="w-2.5 h-2.5" />Active
                            </Badge>
                          ) : (
                            <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200">Pending</Badge>
                          )}
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => toast.info(`Configuring: ${i.name}`)}>
                            Configure
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === "Service Lines" && (
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-primary" />Service Line Configuration</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground mb-4">Configure service line taxonomy, keywords, and AI matching criteria for each practice area.</p>
                  <div className="space-y-3">
                    {SERVICE_LINES.map(s => (
                      <div key={s} className="flex items-center gap-3 p-3 rounded-lg border border-border/60">
                        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                        <div className="flex-1 font-medium text-sm text-foreground">{s}</div>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => toast.info(`Configuring: ${s}`)}>
                          Configure
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" className="w-full gap-2 text-sm" onClick={() => toast.info("Add service line")}>
                      + Add Service Line
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === "Notifications" && (
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2"><Bell className="w-4 h-4 text-primary" />Notification Preferences</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      "New opportunity matched (AI score ≥ 80)",
                      "Proposal deadline within 7 days",
                      "Assignment received",
                      "Review requested",
                      "Contract milestone due",
                      "Contract expiring within 30 days",
                      "Win/Loss recorded",
                      "New team member added",
                    ].map(n => (
                      <div key={n} className="flex items-center justify-between p-3 rounded-lg border border-border/60">
                        <span className="text-sm text-foreground">{n}</span>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => toast.info(`Toggle: ${n}`)}>
                          Enabled
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === "API & Security" && (
              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2"><Key className="w-4 h-4 text-primary" />API Keys & Security</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">All API keys and secrets are stored as environment variables and never exposed in the UI. Configure them in your deployment environment.</p>
                  <div className="space-y-3">
                    {[
                      { label: "Database URL (Supabase/Postgres)", key: "DATABASE_URL", status: "set" },
                      { label: "AI Provider API Key", key: "AI_API_KEY", status: "set" },
                      { label: "Storage Bucket", key: "STORAGE_BUCKET", status: "set" },
                      { label: "NJDOT Portal API Key", key: "NJDOT_API_KEY", status: "pending" },
                      { label: "NYC Vendor Portal Token", key: "NYC_VENDOR_TOKEN", status: "set" },
                    ].map(k => (
                      <div key={k.key} className="flex items-center gap-3 p-3 rounded-lg border border-border/60">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-foreground">{k.label}</div>
                          <div className="text-xs font-mono text-muted-foreground">{k.key}</div>
                        </div>
                        <Badge className={`text-xs ${k.status === "set" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-amber-100 text-amber-700 border-amber-200"}`}>
                          {k.status === "set" ? "Configured" : "Pending"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
